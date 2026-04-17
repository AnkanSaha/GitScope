const API_BASE = "https://api.github.com";
const DEFAULT_ACCEPT = "application/vnd.github+json";
const API_VERSION = "2022-11-28";

export class GitHubApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "GitHubApiError";
    Object.assign(this, details);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodePath(path) {
  return path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseRateLimit(headers) {
  const remaining = headers.get("x-ratelimit-remaining");
  const limit = headers.get("x-ratelimit-limit");
  const reset = headers.get("x-ratelimit-reset");

  if (!remaining && !limit && !reset) {
    return null;
  }

  return {
    remaining: remaining ? Number(remaining) : null,
    limit: limit ? Number(limit) : null,
    resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null
  };
}

function parseErrorCategory(status, payload, rateLimit) {
  if (status === 401) {
    return "bad_credentials";
  }

  if (status === 403 && rateLimit?.remaining === 0) {
    return "rate_limited";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "private_or_inaccessible";
  }

  if (status === 422) {
    return "unprocessable";
  }

  if (status === 202) {
    return "accepted";
  }

  return payload?.message ? "api_error" : "network_error";
}

function decodeContent(content) {
  if (!content) {
    return "";
  }

  const normalized = content.replace(/\n/g, "");

  try {
    return decodeURIComponent(
      Array.from(atob(normalized), (char) =>
        `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
      ).join("")
    );
  } catch {
    return atob(normalized);
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export function createGitHubClient(token = "") {
  let latestRateLimit = null;

  async function graphqlRequest(query, variables = {}) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify({ query, variables })
    });

    const result = await response.json();

    if (result.errors) {
      throw new GitHubApiError(
        result.errors[0]?.message || "GraphQL request failed",
        {
          status: response.status,
          category: "api_error",
          payload: result.errors
        }
      );
    }

    return result.data;
  }

  async function request(pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API_BASE}${pathOrUrl}`;
    const response = await fetch(url, {
      headers: {
        Accept: options.accept ?? DEFAULT_ACCEPT,
        "X-GitHub-Api-Version": API_VERSION,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const rateLimit = parseRateLimit(response.headers);
    latestRateLimit = rateLimit ?? latestRateLimit;

    if (response.status === 204) {
      return { data: null, status: response.status, rateLimit };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json") || contentType.includes("+json");
    const payload = isJson ? await response.json().catch(() => null) : await response.text().catch(() => "");

    if (!response.ok) {
      throw new GitHubApiError(
        typeof payload === "object" && payload?.message ? payload.message : `GitHub API error (${response.status})`,
        {
          status: response.status,
          category: parseErrorCategory(response.status, payload, rateLimit),
          rateLimit,
          payload
        }
      );
    }

    return { data: payload, status: response.status, rateLimit };
  }

  async function requestOptional(pathOrUrl, options = {}) {
    try {
      return await request(pathOrUrl, options);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return { data: null, status: 404, rateLimit: error.rateLimit };
      }

      throw error;
    }
  }

  async function requestContents(owner, repo, path = "") {
    const suffix = path ? `/${encodePath(path)}` : "";
    return request(`/repos/${owner}/${repo}/contents${suffix}`);
  }

  async function requestOptionalContents(owner, repo, path = "") {
    const suffix = path ? `/${encodePath(path)}` : "";
    return requestOptional(`/repos/${owner}/${repo}/contents${suffix}`);
  }

  async function fetchParticipationStats(owner, repo) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await request(`/repos/${owner}/${repo}/stats/participation`);
        return response.data;
      } catch (error) {
        if (error instanceof GitHubApiError && error.status === 202) {
          await sleep(750 * (attempt + 1));
          continue;
        }

        if (error instanceof GitHubApiError && error.category === "rate_limited") {
          throw error;
        }

        return null;
      }
    }

    return null;
  }

  async function fetchDecodedFile(owner, repo, path) {
    const response = await requestOptionalContents(owner, repo, path);

    if (!response.data || Array.isArray(response.data)) {
      return null;
    }

    return {
      ...response.data,
      decoded: decodeContent(response.data.content)
    };
  }

  async function fetchRepositorySnapshotGraphQL(owner, repo) {
    if (!token) {
      return fetchRepositorySnapshot(owner, repo);
    }

    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          name
          nameWithOwner
          description
          url
          isPrivate
          stargazerCount
          forkCount
          watchers { totalCount }
          issues(states: OPEN) { totalCount }
          licenseInfo {
            spdxId
            name
          }
          defaultBranchRef {
            target {
              ... on Commit {
                history(first: 1) {
                  nodes {
                    committedDate
                    author {
                      name
                      email
                      date
                    }
                  }
                }
              }
            }
          }
          object(expression: "HEAD:") {
            ... on Tree {
              entries {
                name
                type
              }
            }
          }
          githubFolder: object(expression: "HEAD:.github") {
            ... on Tree {
              entries {
                name
                type
              }
            }
          }
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                name
              }
            }
          }
          contributors: mentionableUsers(first: 100) {
            nodes {
              login
              avatarUrl
            }
          }
          closedIssues: issues(states: CLOSED, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              createdAt
              closedAt
            }
          }
          mergedPulls: pullRequests(states: MERGED, first: 20, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              createdAt
              mergedAt
            }
          }
          readme: object(expression: "HEAD:README.md") {
            ... on Blob {
              text
              byteSize
            }
          }
          packageJson: object(expression: "HEAD:package.json") {
            ... on Blob {
              text
            }
          }
          requirementsTxt: object(expression: "HEAD:requirements.txt") {
            ... on Blob {
              text
            }
          }
        }
      }
    `;

    try {
      const data = await graphqlRequest(query, { owner, repo });
      const repoData = data.repository;

      if (!repoData) {
        throw new GitHubApiError("Repository not found", {
          status: 404,
          category: "private_or_inaccessible"
        });
      }

      const rootContents = repoData.object?.entries || [];
      const githubDirectoryContents = repoData.githubFolder?.entries || [];

      const languages = {};
      repoData.languages.edges.forEach(edge => {
        languages[edge.node.name] = edge.size;
      });

      const transformedRepo = {
        full_name: repoData.nameWithOwner,
        html_url: repoData.url,
        description: repoData.description,
        private: repoData.isPrivate,
        stargazers_count: repoData.stargazerCount,
        forks_count: repoData.forkCount,
        subscribers_count: repoData.watchers.totalCount,
        watchers_count: repoData.watchers.totalCount,
        open_issues_count: repoData.issues.totalCount,
        license: repoData.licenseInfo ? {
          spdx_id: repoData.licenseInfo.spdxId,
          name: repoData.licenseInfo.name
        } : null
      };

      const lastCommitNode = repoData.defaultBranchRef?.target?.history?.nodes?.[0];
      const lastCommit = lastCommitNode ? {
        commit: {
          author: {
            date: lastCommitNode.committedDate
          }
        }
      } : null;

      const closedIssues = repoData.closedIssues.nodes.map(node => ({
        created_at: node.createdAt,
        closed_at: node.closedAt,
        pull_request: false
      }));

      const mergedPulls = repoData.mergedPulls.nodes.map(node => ({
        created_at: node.createdAt,
        merged_at: node.mergedAt
      }));

      const contributors = repoData.contributors.nodes.map((node, index) => ({
        login: node.login,
        avatar_url: node.avatarUrl
      }));

      const readme = repoData.readme ? {
        size: repoData.readme.byteSize,
        content: btoa(repoData.readme.text || "")
      } : null;

      const packageJson = repoData.packageJson ? {
        decoded: repoData.packageJson.text
      } : null;

      const requirementsTxt = repoData.requirementsTxt ? {
        decoded: repoData.requirementsTxt.text
      } : null;

      const rootNames = new Set(rootContents.map(item => item.name.toLowerCase()));
      const participation = await fetchParticipationStats(owner, repo);

      return {
        repo: transformedRepo,
        rootContents: rootContents.map(entry => ({
          name: entry.name,
          type: entry.type.toLowerCase()
        })),
        githubDirectoryContents: githubDirectoryContents.map(entry => ({
          name: entry.name,
          type: entry.type.toLowerCase()
        })),
        languages,
        participation,
        lastCommit,
        contributors,
        closedIssues,
        mergedPulls,
        readme,
        packageJson,
        requirementsTxt
      };
    } catch (error) {
      console.warn("GraphQL fetch failed, falling back to REST API:", error.message);
      return fetchRepositorySnapshot(owner, repo);
    }
  }

  async function fetchRepositorySnapshot(owner, repo) {
    const repoResponse = await request(`/repos/${owner}/${repo}`);
    const rootContentsResponse = await requestContents(owner, repo);

    const repoData = repoResponse.data;
    const rootContents = Array.isArray(rootContentsResponse.data) ? rootContentsResponse.data : [];
    const rootNames = new Set(rootContents.map((item) => item.name.toLowerCase()));
    const hasGithubDirectory = rootContents.some((item) => item.type === "dir" && item.name === ".github");

    const [
      languagesResponse,
      participation,
      lastCommitResponse,
      contributorsResponse,
      issuesResponse,
      pullsResponse,
      readmeResponse,
      githubDirectoryResponse,
      packageJsonFile,
      requirementsFile
    ] = await Promise.all([
      request(`/repos/${owner}/${repo}/languages`),
      fetchParticipationStats(owner, repo),
      request(`/repos/${owner}/${repo}/commits?per_page=1`),
      request(`/repos/${owner}/${repo}/contributors?per_page=100&anon=1`),
      request(`/repos/${owner}/${repo}/issues?state=closed&per_page=40&sort=updated&direction=desc`),
      request(`/repos/${owner}/${repo}/pulls?state=closed&per_page=50&sort=updated&direction=desc`),
      requestOptional(`/repos/${owner}/${repo}/readme`),
      hasGithubDirectory ? requestOptionalContents(owner, repo, ".github") : Promise.resolve({ data: null }),
      rootNames.has("package.json")
        ? fetchDecodedFile(owner, repo, "package.json")
        : Promise.resolve(null),
      rootNames.has("requirements.txt")
        ? fetchDecodedFile(owner, repo, "requirements.txt")
        : Promise.resolve(null)
    ]);

    return {
      repo: repoData,
      rootContents,
      githubDirectoryContents: Array.isArray(githubDirectoryResponse.data) ? githubDirectoryResponse.data : [],
      languages: languagesResponse.data ?? {},
      participation,
      lastCommit: Array.isArray(lastCommitResponse.data) ? lastCommitResponse.data[0] ?? null : null,
      contributors: Array.isArray(contributorsResponse.data) ? contributorsResponse.data : [],
      closedIssues: Array.isArray(issuesResponse.data)
        ? issuesResponse.data.filter((item) => !item.pull_request).slice(0, 20)
        : [],
      mergedPulls: Array.isArray(pullsResponse.data)
        ? pullsResponse.data.filter((item) => item.merged_at).slice(0, 20)
        : [],
      readme: readmeResponse.data,
      packageJson: packageJsonFile,
      requirementsTxt: requirementsFile
    };
  }

  async function fetchProfileSnapshotGraphQL(username) {
    if (!token) {
      return fetchProfileSnapshot(username);
    }

    const query = `
      query($username: String!) {
        user(login: $username) {
          login
          name
          bio
          avatarUrl
          url
          createdAt
          followers { totalCount }
          following { totalCount }
          repositories(first: 30, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes {
              name
              nameWithOwner
              description
              url
              stargazerCount
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node {
                    name
                  }
                }
              }
            }
            totalCount
          }
        }
      }
    `;

    try {
      const data = await graphqlRequest(query, { username });
      const userData = data.user;

      if (!userData) {
        throw new GitHubApiError("User not found", {
          status: 404,
          category: "private_or_inaccessible"
        });
      }

      const repos = userData.repositories.nodes.map(repo => {
        const languages = {};
        repo.languages.edges.forEach(edge => {
          languages[edge.node.name] = edge.size;
        });

        return {
          name: repo.name,
          full_name: repo.nameWithOwner,
          description: repo.description,
          html_url: repo.url,
          stargazers_count: repo.stargazerCount,
          languages_url: `https://api.github.com/repos/${repo.nameWithOwner}/languages`
        };
      });

      const repoLanguages = userData.repositories.nodes.map(repo => {
        const languages = {};
        repo.languages.edges.forEach(edge => {
          languages[edge.node.name] = edge.size;
        });

        return {
          repo: repo.name,
          languages
        };
      });

      const eventsResponse = await requestOptional(`/users/${username}/events/public?per_page=30`);
      const events = Array.isArray(eventsResponse.data) ? eventsResponse.data : [];

      return {
        user: {
          login: userData.login,
          name: userData.name,
          bio: userData.bio,
          avatar_url: userData.avatarUrl,
          html_url: userData.url,
          created_at: userData.createdAt,
          followers: userData.followers.totalCount,
          following: userData.following.totalCount,
          public_repos: userData.repositories.totalCount
        },
        repos,
        events,
        repoLanguages
      };
    } catch (error) {
      console.warn("GraphQL fetch failed, falling back to REST API:", error.message);
      return fetchProfileSnapshot(username);
    }
  }

  async function fetchProfileSnapshot(username) {
    const [userResponse, reposResponse, eventsResponse] = await Promise.all([
      request(`/users/${username}`),
      request(`/users/${username}/repos?per_page=30&type=owner&sort=updated`),
      requestOptional(`/users/${username}/events/public?per_page=30`)
    ]);

    const repos = Array.isArray(reposResponse.data) ? reposResponse.data : [];
    const repoLanguages = await mapWithConcurrency(repos, 5, async (repoItem) => {
      try {
        const response = await request(repoItem.languages_url);
        return {
          repo: repoItem.name,
          languages: response.data ?? {}
        };
      } catch (error) {
        if (error instanceof GitHubApiError && error.status === 404) {
          return {
            repo: repoItem.name,
            languages: {}
          };
        }

        throw error;
      }
    });

    return {
      user: userResponse.data,
      repos,
      events: Array.isArray(eventsResponse.data) ? eventsResponse.data : [],
      repoLanguages
    };
  }

  return {
    fetchRepositorySnapshot: token ? fetchRepositorySnapshotGraphQL : fetchRepositorySnapshot,
    fetchProfileSnapshot: token ? fetchProfileSnapshotGraphQL : fetchProfileSnapshot,
    getLatestRateLimit() {
      return latestRateLimit;
    }
  };
}
