function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US", { notation: value >= 1000 ? "compact" : "standard" }).format(value);
}

function formatExactNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatRelativeDays(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  const diffDays = Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "1 day ago";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths = Math.round(diffDays / 30);

  if (diffMonths < 12) {
    return `${diffMonths} mo ago`;
  }

  return `${Math.round(diffMonths / 12)} yr ago`;
}

function formatBytes(size) {
  if (typeof size !== "number" || Number.isNaN(size)) {
    return "Not available";
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = size;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const rounded = current >= 10 || unitIndex === 0 ? Math.round(current) : current.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function averageDurationHours(items, startField, endField) {
  const values = items
    .map((item) => {
      const start = new Date(item[startField]).getTime();
      const end = new Date(item[endField]).getTime();

      if (!start || !end || Number.isNaN(start) || Number.isNaN(end) || end < start) {
        return null;
      }

      return (end - start) / 3600000;
    })
    .filter((value) => value !== null);

  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatDuration(hours) {
  if (typeof hours !== "number" || Number.isNaN(hours)) {
    return "Not available";
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }

  const days = hours / 24;

  if (days < 30) {
    return `${days.toFixed(1)} days`;
  }

  return `${(days / 30).toFixed(1)} mos`;
}

function percentageList(languageMap) {
  const entries = Object.entries(languageMap ?? {});
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);

  if (!total) {
    return [];
  }

  return entries
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / total) * 1000) / 10
    }))
    .sort((left, right) => right.bytes - left.bytes);
}

function bucketWeeksToMonths(weeks = []) {
  const chunkSize = Math.ceil(weeks.length / 12) || 1;
  const buckets = [];
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const labels = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (11 - index));
    return formatter.format(date);
  });

  for (let index = 0; index < 12; index += 1) {
    const start = Math.max(0, weeks.length - chunkSize * (12 - index));
    const end = Math.min(weeks.length, start + chunkSize);
    const value = weeks.slice(start, end).reduce((sum, current) => sum + current, 0);

    buckets.push({
      label: labels[index],
      value
    });
  }

  return buckets;
}

function parsePackageJsonDependencies(packageJsonFile) {
  if (!packageJsonFile?.decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(packageJsonFile.decoded);
    const allSections = ["dependencies", "devDependencies", "peerDependencies"];
    const counts = allSections.reduce((sum, section) => {
      const value = parsed[section];
      return sum + (value && typeof value === "object" ? Object.keys(value).length : 0);
    }, 0);

    const dependencyNames = allSections.flatMap((section) =>
      parsed[section] && typeof parsed[section] === "object" ? Object.keys(parsed[section]) : []
    );

    return {
      counts,
      dependencyNames: Array.from(new Set(dependencyNames))
    };
  } catch {
    return null;
  }
}

function parseRequirements(requirementsFile) {
  if (!requirementsFile?.decoded) {
    return null;
  }

  const dependencyNames = requirementsFile.decoded
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("-"))
    .map((line) => line.split(/[<>=!~[\s]/)[0])
    .filter(Boolean);

  return {
    counts: dependencyNames.length,
    dependencyNames: Array.from(new Set(dependencyNames))
  };
}

function collectFrameworks(dependencyNames = [], rootNames = new Set()) {
  const lowerDependencies = new Set(dependencyNames.map((name) => name.toLowerCase()));
  const detected = new Set();

  const dependencyMap = {
    react: "React",
    next: "Next.js",
    vite: "Vite",
    vue: "Vue",
    nuxt: "Nuxt",
    svelte: "Svelte",
    astro: "Astro",
    express: "Express",
    "@nestjs/core": "NestJS",
    angular: "Angular",
    typescript: "TypeScript",
    eslint: "ESLint",
    prettier: "Prettier",
    jest: "Jest",
    vitest: "Vitest",
    cypress: "Cypress",
    playwright: "Playwright",
    flask: "Flask",
    django: "Django",
    fastapi: "FastAPI",
    pytest: "Pytest",
    gin: "Gin",
    fiber: "Fiber",
    axum: "Axum",
    tokio: "Tokio"
  };

  Object.entries(dependencyMap).forEach(([dependency, label]) => {
    if (lowerDependencies.has(dependency)) {
      detected.add(label);
    }
  });

  if (rootNames.has("dockerfile")) {
    detected.add("Docker");
  }

  if (rootNames.has("docker-compose.yml") || rootNames.has("docker-compose.yaml")) {
    detected.add("Docker Compose");
  }

  if (rootNames.has("go.mod")) {
    detected.add("Go Modules");
  }

  if (rootNames.has("cargo.toml")) {
    detected.add("Cargo");
  }

  if (rootNames.has("tsconfig.json")) {
    detected.add("TypeScript");
  }

  ["next.config.js", "next.config.mjs", "next.config.ts"].forEach((file) => {
    if (rootNames.has(file)) {
      detected.add("Next.js");
    }
  });

  ["vite.config.js", "vite.config.ts", "vite.config.mjs"].forEach((file) => {
    if (rootNames.has(file)) {
      detected.add("Vite");
    }
  });

  if (rootNames.has(".github/workflows")) {
    detected.add("GitHub Actions");
  }

  return Array.from(detected);
}

function hasAnyNamedItem(items, candidates) {
  const names = new Set(items.map((item) => item.name.toLowerCase()));
  return candidates.some((candidate) => names.has(candidate.toLowerCase()));
}

function inferCodeHealth(snapshot) {
  const rootContents = snapshot.rootContents ?? [];
  const githubDirectoryContents = snapshot.githubDirectoryContents ?? [];
  const rootNames = new Set(rootContents.map((item) => item.name.toLowerCase()));
  const githubNames = new Set(githubDirectoryContents.map((item) => item.name.toLowerCase()));
  const hasGithubActions = githubNames.has("workflows");
  const hasTests = rootContents.some(
    (item) =>
      item.type === "dir" &&
      ["test", "tests", "spec", "__tests__"].includes(item.name.toLowerCase())
  );
  const hasLinting =
    hasAnyNamedItem(rootContents, [
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.json",
      ".eslintrc.cjs",
      "eslint.config.js",
      "eslint.config.mjs",
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.js",
      "prettier.config.js",
      "prettier.config.mjs"
    ]);
  const hasAutomation =
    githubNames.has("dependabot.yml") ||
    githubNames.has("renovate.json") ||
    githubNames.has("renovate.json5") ||
    rootNames.has("renovate.json") ||
    rootNames.has("renovate.json5");
  const hasContributingGuide = hasAnyNamedItem(rootContents, ["contributing.md", "contributing"]);
  const hasLicense = Boolean(snapshot.repo?.license) || hasAnyNamedItem(rootContents, ["license", "license.md", "license.txt"]);

  return [
    {
      label: "README",
      status: snapshot.readme ? "good" : "bad",
      detail: snapshot.readme ? `Present (${formatBytes(snapshot.readme.size)})` : "README not found"
    },
    {
      label: "CONTRIBUTING guide",
      status: hasContributingGuide ? "good" : "bad",
      detail: hasContributingGuide
        ? "Contribution guide found"
        : "No contribution guide detected"
    },
    {
      label: "LICENSE",
      status: hasLicense ? "good" : "bad",
      detail: hasLicense
        ? snapshot.repo?.license?.spdx_id && snapshot.repo.license.spdx_id !== "NOASSERTION"
          ? snapshot.repo.license.spdx_id
          : "License file detected"
        : "No license detected"
    },
    {
      label: "Tests",
      status: hasTests ? "good" : "bad",
      detail: hasTests ? "Root test directory detected" : "No root test directory detected"
    },
    {
      label: "CI/CD",
      status:
        hasGithubActions ||
        hasAnyNamedItem(rootContents, [".circleci", "jenkinsfile", ".gitlab-ci.yml"])
          ? "good"
          : "bad",
      detail: hasGithubActions
        ? "GitHub Actions workflow directory detected"
        : "No workflow configuration detected"
    },
    {
      label: "Linting / formatting",
      status: hasLinting ? "good" : "bad",
      detail: hasLinting ? "ESLint or Prettier config found" : "No lint or formatter config found"
    },
    {
      label: "Dependency automation",
      status: hasAutomation ? "good" : "warn",
      detail: hasAutomation ? "Dependabot or Renovate config found" : "No Dependabot or Renovate config found"
    }
  ];
}

function buildDependencySummary(snapshot, frameworks) {
  const rootNames = new Set(snapshot.rootContents.map((item) => item.name.toLowerCase()));
  const lockfiles = [
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "poetry.lock",
    "pipfile.lock",
    "cargo.lock",
    "composer.lock",
    "gemfile.lock"
  ];
  const packageJsonSummary = parsePackageJsonDependencies(snapshot.packageJson);
  const requirementsSummary = parseRequirements(snapshot.requirementsTxt);
  const source = packageJsonSummary
    ? "package.json"
    : requirementsSummary
      ? "requirements.txt"
      : "Not available";
  const directCount = packageJsonSummary?.counts ?? requirementsSummary?.counts ?? null;
  const dependencyNames = packageJsonSummary?.dependencyNames ?? requirementsSummary?.dependencyNames ?? [];
  const hasLockfile = lockfiles.some((lockfile) => rootNames.has(lockfile.toLowerCase()));
  const isNodeOrPythonProject =
    rootNames.has("package.json") ||
    rootNames.has("requirements.txt") ||
    rootNames.has("pyproject.toml") ||
    rootNames.has("pipfile");

  return {
    source,
    directCount,
    frameworks: frameworks.filter((framework) =>
      ["React", "Next.js", "Vite", "Vue", "Nuxt", "Svelte", "Astro", "Express", "NestJS", "Flask", "Django", "FastAPI"].includes(framework)
    ),
    hasLockfile,
    missingLockfile: isNodeOrPythonProject && !hasLockfile,
    dependencyNames
  };
}

function generateRecommendations(snapshot, codeHealth, dependencySummary, participation) {
  const recommendations = [];

  // Code Health Recommendations
  const hasReadme = codeHealth.find(item => item.label === "README")?.status === "good";
  const hasTests = codeHealth.find(item => item.label === "Tests")?.status === "good";
  const hasCI = codeHealth.find(item => item.label === "CI/CD")?.status === "good";
  const hasLinting = codeHealth.find(item => item.label === "Linting / formatting")?.status === "good";
  const hasLicense = codeHealth.find(item => item.label === "LICENSE")?.status === "good";
  const hasContributing = codeHealth.find(item => item.label === "CONTRIBUTING guide")?.status === "good";
  const hasAutomation = codeHealth.find(item => item.label === "Dependency automation")?.status === "good";

  if (!hasReadme) {
    recommendations.push({
      category: "Documentation",
      priority: "high",
      title: "Add a comprehensive README",
      description: "A well-written README is crucial for project discoverability and adoption. Include installation steps, usage examples, and contribution guidelines."
    });
  }

  if (!hasTests) {
    recommendations.push({
      category: "Quality",
      priority: "high",
      title: "Implement automated testing",
      description: "Set up a test suite to catch bugs early and improve code reliability. Consider Jest, Pytest, or framework-specific testing tools."
    });
  }

  if (!hasCI) {
    recommendations.push({
      category: "Automation",
      priority: "medium",
      title: "Set up CI/CD pipeline",
      description: "Automate testing and deployment with GitHub Actions, CircleCI, or similar tools to ensure code quality and streamline releases."
    });
  }

  if (!hasLinting) {
    recommendations.push({
      category: "Code Quality",
      priority: "medium",
      title: "Add linting and formatting",
      description: "Set up ESLint/Prettier (JavaScript), Black/Flake8 (Python), or similar tools to maintain consistent code style across the project."
    });
  }

  if (!hasLicense) {
    recommendations.push({
      category: "Legal",
      priority: "high",
      title: "Add an open-source license",
      description: "Choose an appropriate license (MIT, Apache 2.0, GPL) to clarify usage rights and protect your work."
    });
  }

  if (!hasContributing) {
    recommendations.push({
      category: "Community",
      priority: "low",
      title: "Create a CONTRIBUTING guide",
      description: "Help potential contributors by documenting your development workflow, coding standards, and pull request process."
    });
  }

  if (!hasAutomation) {
    recommendations.push({
      category: "Maintenance",
      priority: "medium",
      title: "Enable dependency automation",
      description: "Set up Dependabot or Renovate to automatically keep dependencies up-to-date and secure."
    });
  }

  // Dependency Recommendations
  if (dependencySummary.missingLockfile) {
    recommendations.push({
      category: "Dependencies",
      priority: "high",
      title: "Add a lockfile for reproducible builds",
      description: "Commit your package-lock.json, yarn.lock, or requirements.txt.lock to ensure consistent dependency versions across environments."
    });
  }

  // Activity Recommendations
  const totalCommits12Months = Array.isArray(participation) ? participation.reduce((sum, value) => sum + value, 0) : 0;
  const avgWeeklyCommits = participation.length ? totalCommits12Months / participation.length : 0;

  if (avgWeeklyCommits < 1 && totalCommits12Months > 0) {
    recommendations.push({
      category: "Consistency",
      priority: "low",
      title: "Maintain regular commit cadence",
      description: "Low activity detected. Consider setting a weekly goal for commits to show active maintenance and attract contributors."
    });
  }

  const lastCommit = snapshot.lastCommit?.commit?.author?.date;
  if (lastCommit) {
    const daysSinceLastCommit = Math.round((Date.now() - new Date(lastCommit).getTime()) / 86400000);
    if (daysSinceLastCommit > 90) {
      recommendations.push({
        category: "Maintenance",
        priority: "medium",
        title: "Resume active development",
        description: `Last commit was ${Math.round(daysSinceLastCommit / 30)} months ago. Regular updates signal project health to users and contributors.`
      });
    }
  }

  // Productivity Tips
  const productivityTips = [
    {
      category: "Productivity",
      priority: "tip",
      title: "Use branch protection rules",
      description: "Require PR reviews and passing tests before merging to maintain code quality and prevent bugs."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Leverage GitHub Projects",
      description: "Organize issues and PRs with project boards to track progress and prioritize work effectively."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Write meaningful commit messages",
      description: "Use conventional commits (feat:, fix:, docs:) to make your git history searchable and automate changelog generation."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Set up issue templates",
      description: "Create issue and PR templates to gather necessary information and streamline contributor interactions."
    }
  ];

  // Add 2-3 productivity tips
  const selectedTips = productivityTips.slice(0, 3);
  recommendations.push(...selectedTips);

  return recommendations;
}

export function analyzeRepositorySnapshot(snapshot) {
  const rootNames = new Set(snapshot.rootContents.map((item) => item.name.toLowerCase()));
  const githubNames = new Set(snapshot.githubDirectoryContents.map((item) => item.name.toLowerCase()));

  if (githubNames.has("workflows")) {
    rootNames.add(".github/workflows");
  }

  const packageJsonSummary = parsePackageJsonDependencies(snapshot.packageJson);
  const requirementsSummary = parseRequirements(snapshot.requirementsTxt);
  const dependencyNames = packageJsonSummary?.dependencyNames ?? requirementsSummary?.dependencyNames ?? [];
  const languageBreakdown = percentageList(snapshot.languages);
  const frameworks = collectFrameworks(dependencyNames, rootNames);
  const codeHealth = inferCodeHealth(snapshot);
  const issueCloseHours = averageDurationHours(snapshot.closedIssues, "created_at", "closed_at");
  const prMergeHours = averageDurationHours(snapshot.mergedPulls, "created_at", "merged_at");
  const participation = Array.isArray(snapshot.participation?.all) ? snapshot.participation.all : [];
  const totalCommits12Months = participation.reduce((sum, value) => sum + value, 0);
  const monthlyCommitBuckets = bucketWeeksToMonths(participation);
  const dependencySummary = buildDependencySummary(snapshot, frameworks);
  const healthScore = codeHealth.filter((item) => item.status === "good").length;

  const badges = [
    ...languageBreakdown.slice(0, 5).map((item) => `${item.name} ${item.percentage}%`),
    ...frameworks
  ];

  const recommendations = generateRecommendations(snapshot, codeHealth, dependencySummary, participation);

  const analysis = {
    type: "repo",
    key: snapshot.repo.full_name,
    url: snapshot.repo.html_url,
    title: snapshot.repo.full_name,
    subtitle: snapshot.repo.private ? "Private repository" : "Public repository",
    description: snapshot.repo.description || "No repository description provided.",
    summaryMetrics: [
      { label: "Stars", value: formatNumber(snapshot.repo.stargazers_count) },
      { label: "Forks", value: formatNumber(snapshot.repo.forks_count) },
      { label: "Watchers", value: formatNumber(snapshot.repo.subscribers_count ?? snapshot.repo.watchers_count) },
      { label: "Open issues", value: formatNumber(snapshot.repo.open_issues_count) },
      { label: "License", value: snapshot.repo.license?.spdx_id && snapshot.repo.license.spdx_id !== "NOASSERTION" ? snapshot.repo.license.spdx_id : "Not available" },
      { label: "Contributors", value: formatNumber(snapshot.contributors.length) }
    ],
    techStack: {
      badges: Array.from(new Set(badges)),
      languages: languageBreakdown,
      rootSignals: snapshot.rootContents
        .filter((item) =>
          [
            "package.json",
            "go.mod",
            "cargo.toml",
            "requirements.txt",
            "dockerfile",
            "docker-compose.yml",
            "docker-compose.yaml",
            "tsconfig.json",
            "next.config.js",
            "next.config.ts",
            "vite.config.js",
            "vite.config.ts",
            "pyproject.toml"
          ].includes(item.name.toLowerCase())
        )
        .map((item) => item.name)
    },
    codeHealth,
    activity: {
      lastCommitDate: snapshot.lastCommit?.commit?.author?.date ?? null,
      lastCommitLabel: formatDate(snapshot.lastCommit?.commit?.author?.date),
      lastCommitRelative: formatRelativeDays(snapshot.lastCommit?.commit?.author?.date),
      contributorCount: snapshot.contributors.length,
      totalCommits12Months,
      averageWeeklyCommits: participation.length ? (totalCommits12Months / participation.length).toFixed(1) : "Not available",
      issueCloseHours,
      issueCloseLabel: formatDuration(issueCloseHours),
      prMergeHours,
      prMergeLabel: formatDuration(prMergeHours),
      monthlyCommitBuckets
    },
    dependencies: {
      ...dependencySummary,
      directCountLabel:
        dependencySummary.directCount === null ? "Not available" : formatExactNumber(dependencySummary.directCount)
    },
    recommendations,
    compareSnapshot: {
      key: snapshot.repo.full_name,
      name: snapshot.repo.full_name,
      url: snapshot.repo.html_url,
      savedAt: new Date().toISOString(),
      summary: {
        stars: snapshot.repo.stargazers_count ?? 0,
        forks: snapshot.repo.forks_count ?? 0,
        watchers: snapshot.repo.subscribers_count ?? snapshot.repo.watchers_count ?? 0,
        openIssues: snapshot.repo.open_issues_count ?? 0,
        contributors: snapshot.contributors.length
      },
      languages: languageBreakdown.slice(0, 5),
      health: {
        passed: healthScore,
        total: codeHealth.length,
        readme: Boolean(snapshot.readme),
        contributing: codeHealth.find((item) => item.label === "CONTRIBUTING guide")?.status === "good",
        license: codeHealth.find((item) => item.label === "LICENSE")?.status === "good",
        tests: codeHealth.find((item) => item.label === "Tests")?.status === "good",
        ci: codeHealth.find((item) => item.label === "CI/CD")?.status === "good",
        lint: codeHealth.find((item) => item.label === "Linting / formatting")?.status === "good",
        automation: codeHealth.find((item) => item.label === "Dependency automation")?.status !== "warn"
      },
      activity: {
        lastCommit: snapshot.lastCommit?.commit?.author?.date ?? null,
        commits12Months: totalCommits12Months,
        issueCloseHours,
        prMergeHours
      },
      dependencies: {
        directCount: dependencySummary.directCount,
        hasLockfile: dependencySummary.hasLockfile,
        frameworks: dependencySummary.frameworks
      }
    }
  };

  return analysis;
}

function generateProfileRecommendations(snapshot, topStarredRepos, hasRecentActivity) {
  const recommendations = [];

  // Bio recommendation
  if (!snapshot.user.bio) {
    recommendations.push({
      category: "Profile",
      priority: "medium",
      title: "Add a bio to your profile",
      description: "A compelling bio helps people understand your skills, interests, and what you're working on. Keep it concise and professional."
    });
  }

  // Activity recommendation
  if (!hasRecentActivity) {
    recommendations.push({
      category: "Activity",
      priority: "medium",
      title: "Increase your GitHub activity",
      description: "No recent public commits detected. Regular contributions signal active development and can attract more followers and collaborators."
    });
  }

  // Repository recommendations
  if (topStarredRepos.length === 0 || topStarredRepos.every(r => r.stars === 0)) {
    recommendations.push({
      category: "Visibility",
      priority: "low",
      title: "Build projects that solve real problems",
      description: "Create repositories that demonstrate your skills and solve actual problems. Well-documented, useful projects naturally attract stars."
    });
  }

  // Consistency recommendations
  const publicRepos = snapshot.user.public_repos || 0;
  if (publicRepos < 5) {
    recommendations.push({
      category: "Portfolio",
      priority: "low",
      title: "Expand your repository portfolio",
      description: "Build a diverse portfolio of projects showcasing different skills and technologies. Aim for quality over quantity."
    });
  }

  // Productivity tips
  const productivityTips = [
    {
      category: "Productivity",
      priority: "tip",
      title: "Contribute to open source",
      description: "Contributing to popular open-source projects increases your visibility, builds your network, and improves your coding skills."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Pin your best repositories",
      description: "Use GitHub's pin feature to showcase your top 6 projects on your profile. Choose repos that best represent your skills."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Create a profile README",
      description: "Add a README to a repository named after your username to create a custom profile page with stats, skills, and contact info."
    },
    {
      category: "Productivity",
      priority: "tip",
      title: "Be consistent with commits",
      description: "Regular commits (even small ones) keep your contribution graph active and show sustained engagement to profile visitors."
    }
  ];

  recommendations.push(...productivityTips.slice(0, 3));

  return recommendations;
}

export function analyzeProfileSnapshot(snapshot) {
  const aggregatedLanguages = snapshot.repoLanguages.reduce((accumulator, repoLanguage) => {
    Object.entries(repoLanguage.languages ?? {}).forEach(([language, bytes]) => {
      accumulator[language] = (accumulator[language] ?? 0) + bytes;
    });
    return accumulator;
  }, {});
  const topLanguages = percentageList(aggregatedLanguages).slice(0, 8);
  const topStarredRepos = [...snapshot.repos]
    .sort((left, right) => right.stargazers_count - left.stargazers_count)
    .slice(0, 5)
    .map((repo) => ({
      name: repo.full_name,
      stars: repo.stargazers_count,
      url: repo.html_url,
      description: repo.description || "No repository description provided."
    }));
  const recentPush = snapshot.events.find((event) => event.type === "PushEvent");
  const recentPushDate = recentPush?.created_at ? new Date(recentPush.created_at) : null;
  const hasRecentActivity =
    recentPushDate && !Number.isNaN(recentPushDate.getTime())
      ? Date.now() - recentPushDate.getTime() <= 30 * 86400000
      : false;
  const createdAt = snapshot.user.created_at ? new Date(snapshot.user.created_at) : null;
  const accountAgeYears =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? ((Date.now() - createdAt.getTime()) / (365.25 * 86400000)).toFixed(1)
      : "Not available";
  const accountAgeLabel = accountAgeYears === "Not available" ? accountAgeYears : `${accountAgeYears} yrs`;

  const profileRecommendations = generateProfileRecommendations(snapshot, topStarredRepos, hasRecentActivity);

  return {
    type: "profile",
    key: snapshot.user.login,
    url: snapshot.user.html_url,
    title: snapshot.user.login,
    subtitle: snapshot.user.name || "GitHub user profile",
    description: snapshot.user.bio || "No public profile bio provided.",
    summaryMetrics: [
      { label: "Public repos", value: formatNumber(snapshot.user.public_repos) },
      { label: "Followers", value: formatNumber(snapshot.user.followers) },
      { label: "Following", value: formatNumber(snapshot.user.following) },
      { label: "Account age", value: accountAgeLabel },
      { label: "Recent commits", value: hasRecentActivity ? "Active" : "No recent push activity" },
      { label: "Joined", value: formatDate(snapshot.user.created_at) }
    ],
    topLanguages,
    topStarredRepos,
    activity: {
      hasRecentActivity,
      recentPushDate: recentPush?.created_at ?? null,
      recentPushLabel: recentPush?.created_at ? formatDate(recentPush.created_at) : "Not available",
      recentPushRelative: recentPush?.created_at ? formatRelativeDays(recentPush.created_at) : "Not available"
    },
    recommendations: profileRecommendations
  };
}

function markdownList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildMarkdownReport(analysis, comparisonSnapshots = []) {
  if (!analysis) {
    return "";
  }

  if (analysis.type === "profile") {
    return [
      `# GitScope Report: ${analysis.title}`,
      "",
      `Source: ${analysis.url}`,
      "",
      "## Summary",
      ...analysis.summaryMetrics.map((metric) => `- ${metric.label}: ${metric.value}`),
      "",
      "## Most Used Languages",
      ...(analysis.topLanguages.length
        ? analysis.topLanguages.map((language) => `- ${language.name}: ${language.percentage}%`)
        : ["- Not available"]),
      "",
      "## Top Starred Repositories",
      ...(analysis.topStarredRepos.length
        ? analysis.topStarredRepos.map((repo) => `- ${repo.name} (${repo.stars} stars)`)
        : ["- Not available"]),
      "",
      "## Activity",
      `- Recent public push activity: ${analysis.activity.hasRecentActivity ? "Yes" : "No"}`,
      `- Last public push: ${analysis.activity.recentPushLabel}`
    ].join("\n");
  }

  const comparisonSection =
    comparisonSnapshots.length === 2
      ? [
          "",
          "## Comparison",
          `- ${comparisonSnapshots[0].name} vs ${comparisonSnapshots[1].name}`,
          `- Stars: ${comparisonSnapshots[0].summary.stars} vs ${comparisonSnapshots[1].summary.stars}`,
          `- 12M commits: ${comparisonSnapshots[0].activity.commits12Months} vs ${comparisonSnapshots[1].activity.commits12Months}`,
          `- Direct dependencies: ${comparisonSnapshots[0].dependencies.directCount ?? "N/A"} vs ${comparisonSnapshots[1].dependencies.directCount ?? "N/A"}`
        ]
      : [];

  return [
    `# GitScope Report: ${analysis.title}`,
    "",
    `Source: ${analysis.url}`,
    "",
    "## Repository Summary",
    ...analysis.summaryMetrics.map((metric) => `- ${metric.label}: ${metric.value}`),
    "",
    "## Tech Stack",
    ...(analysis.techStack.badges.length ? markdownList(analysis.techStack.badges).split("\n") : ["- Not available"]),
    "",
    "## Code Health",
    ...analysis.codeHealth.map((item) => `- ${item.label}: ${item.status.toUpperCase()}${item.detail ? ` (${item.detail})` : ""}`),
    "",
    "## Activity",
    `- Last commit: ${analysis.activity.lastCommitLabel}`,
    `- Last 12 months commits: ${formatExactNumber(analysis.activity.totalCommits12Months)}`,
    `- Average issue close time: ${analysis.activity.issueCloseLabel}`,
    `- Average PR merge time: ${analysis.activity.prMergeLabel}`,
    `- Contributors: ${formatExactNumber(analysis.activity.contributorCount)}`,
    "",
    "## Dependencies",
    `- Source: ${analysis.dependencies.source}`,
    `- Direct dependencies: ${analysis.dependencies.directCountLabel}`,
    `- Frameworks: ${analysis.dependencies.frameworks.length ? analysis.dependencies.frameworks.join(", ") : "Not available"}`,
    `- Lockfile present: ${analysis.dependencies.hasLockfile ? "Yes" : "No"}`,
    ...comparisonSection
  ].join("\n");
}
