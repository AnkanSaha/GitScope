function el(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.html !== undefined) {
    element.innerHTML = options.html;
  }

  if (options.href) {
    element.href = options.href;
  }

  if (options.target) {
    element.target = options.target;
  }

  if (options.rel) {
    element.rel = options.rel;
  }

  if (options.type) {
    element.type = options.type;
  }

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(key, value);
      }
    });
  }

  const normalizedChildren = Array.isArray(children) ? children : [children];
  normalizedChildren.filter(Boolean).forEach((child) => element.append(child));
  return element;
}

function iconMarkup(kind) {
  const icons = {
    chevron:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 8 12 12.6 16.6 8 18 9.4 12 15.4 6 9.4 7.4 8Z"></path></svg>',
    check:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.55 16.2-4.1-4.1 1.4-1.4 2.7 2.7 7-7 1.4 1.4-8.4 8.4Z"></path></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z"></path></svg>',
    warning:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6 2.6 20h18.8L12 3.6Zm1 12.4h-2v-2h2v2Zm0-4h-2V8h2v4Z"></path></svg>',
    dot:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5Z"></path></svg>'
  };

  return icons[kind] ?? icons.dot;
}

function metricTile(label, value) {
  return el("div", { className: "metric-tile" }, [
    el("span", { className: "stat-label", text: label }),
    el("strong", { className: "metric-value", text: value })
  ]);
}

function badge(text, muted = false) {
  return el("span", { className: `badge${muted ? " badge-muted" : ""}`, text });
}

function statusRow(item) {
  const iconKind = item.status === "good" ? "check" : item.status === "warn" ? "warning" : "close";

  return el("div", { className: `status-row is-${item.status}` }, [
    el("span", { className: "status-icon", html: iconMarkup(iconKind) }),
    el("div", {}, [
      el("p", { className: "status-title", text: item.label }),
      el("p", { className: "status-detail", text: item.detail ?? "" })
    ])
  ]);
}

function createCollapsibleCard(title, subtitle, bodyContent, collapsed = false) {
  const card = el("section", { className: `card${collapsed ? " is-collapsed" : ""}` });
  const body = el("div", { className: "card-body" }, bodyContent);
  const toggle = el(
    "button",
    {
      className: "card-toggle",
      type: "button",
      attrs: { "aria-expanded": String(!collapsed) }
    },
    [
      el("div", {}, [
        el("h3", { text: title }),
        el("span", { className: "subtle", text: subtitle })
      ]),
      el("span", { html: iconMarkup("chevron") })
    ]
  );

  toggle.addEventListener("click", () => {
    const nextCollapsed = !card.classList.contains("is-collapsed");
    card.classList.toggle("is-collapsed", nextCollapsed);
    toggle.setAttribute("aria-expanded", String(!nextCollapsed));
  });

  card.append(toggle, body);
  return card;
}

function renderHero(analysis, isFromCache = false) {
  return el("section", { className: "hero-card" }, [
    el("div", { className: "hero-head" }, [
      el("div", {}, [
        el("p", { className: "eyebrow", text: analysis.subtitle }),
        el("h2", { className: "hero-title", text: analysis.title }),
        el("p", { className: "hero-description", text: analysis.description })
      ])
    ]),
    ...(isFromCache ? [
      el("div", { className: "cache-badge" }, [
        el("span", { className: "cache-icon", html: iconMarkup("check") }),
        el("span", { text: "Cached Data" })
      ])
    ] : []),
    el(
      "div",
      { className: analysis.type === "profile" ? "profile-grid" : "metrics-grid" },
      analysis.summaryMetrics.map((metric) => metricTile(metric.label, metric.value))
    )
  ]);
}

function renderSparkline(buckets) {
  if (!buckets.length) {
    return el("p", { className: "empty-copy", text: "Commit frequency is not available for this repository." });
  }

  const maxValue = Math.max(...buckets.map((bucket) => bucket.value), 1);
  const barGrid = el(
    "div",
    { className: "spark-grid" },
    buckets.map((bucket) =>
      el("div", {
        className: "spark-bar",
        attrs: {
          title: `${bucket.label}: ${bucket.value} commits`,
          style: `height: ${Math.max(12, Math.round((bucket.value / maxValue) * 88))}px`
        }
      })
    )
  );
  const labelGrid = el(
    "div",
    { className: "spark-labels" },
    buckets.map((bucket) => el("span", { text: bucket.label }))
  );

  return el("div", {}, [barGrid, labelGrid]);
}

function recommendationItem(rec) {
  const priorityColors = {
    high: "var(--danger)",
    medium: "var(--warning)",
    low: "var(--primary)",
    tip: "var(--success)"
  };

  const priorityIcons = {
    high: "warning",
    medium: "warning",
    low: "dot",
    tip: "check"
  };

  return el("div", { className: "recommendation-item" }, [
    el("div", { className: "recommendation-header" }, [
      el("span", {
        className: "recommendation-icon",
        html: iconMarkup(priorityIcons[rec.priority] || "dot"),
        attrs: { style: `color: ${priorityColors[rec.priority] || "var(--muted)"}` }
      }),
      el("div", { className: "recommendation-content" }, [
        el("div", { className: "recommendation-meta" }, [
          el("span", { className: "recommendation-category", text: rec.category }),
          rec.priority !== "tip" ? el("span", {
            className: `recommendation-priority priority-${rec.priority}`,
            text: rec.priority.toUpperCase()
          }) : null
        ]),
        el("h4", { className: "recommendation-title", text: rec.title }),
        el("p", { className: "recommendation-description", text: rec.description })
      ])
    ])
  ]);
}

function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const highPriority = recommendations.filter(r => r.priority === "high");
  const mediumPriority = recommendations.filter(r => r.priority === "medium");
  const lowPriority = recommendations.filter(r => r.priority === "low");
  const tips = recommendations.filter(r => r.priority === "tip");

  const totalIssues = highPriority.length + mediumPriority.length + lowPriority.length;
  const subtitle = totalIssues > 0
    ? `${totalIssues} improvement${totalIssues !== 1 ? 's' : ''} suggested`
    : "Best practices & productivity tips";

  return el("section", { className: "recommendations-card" }, [
    el("p", { className: "eyebrow", text: "Recommendations" }),
    el("h3", { className: "section-title", text: "How to Improve This Repository" }),
    el("p", { className: "table-caption", text: subtitle }),
    el("div", { className: "recommendations-list" }, [
      ...highPriority.map(recommendationItem),
      ...mediumPriority.map(recommendationItem),
      ...lowPriority.map(recommendationItem),
      ...(tips.length > 0 ? [
        el("div", { className: "recommendations-divider" }),
        el("p", { className: "recommendations-section-title", text: "Productivity Tips" }),
        ...tips.map(recommendationItem)
      ] : [])
    ])
  ]);
}

function renderComparisonTable(comparisonSnapshots) {
  if (comparisonSnapshots.length !== 2) {
    return null;
  }

  const [left, right] = comparisonSnapshots;
  const rows = [
    ["Stars", left.summary.stars, right.summary.stars],
    ["Forks", left.summary.forks, right.summary.forks],
    ["Watchers", left.summary.watchers, right.summary.watchers],
    ["Open issues", left.summary.openIssues, right.summary.openIssues],
    ["Contributors", left.summary.contributors, right.summary.contributors],
    ["Last commit", left.activity.lastCommit ? new Date(left.activity.lastCommit).toLocaleDateString("en-US") : "N/A", right.activity.lastCommit ? new Date(right.activity.lastCommit).toLocaleDateString("en-US") : "N/A"],
    ["12M commits", left.activity.commits12Months, right.activity.commits12Months],
    ["Avg issue close", left.activity.issueCloseHours ? `${left.activity.issueCloseHours.toFixed(1)} hrs` : "N/A", right.activity.issueCloseHours ? `${right.activity.issueCloseHours.toFixed(1)} hrs` : "N/A"],
    ["Avg PR merge", left.activity.prMergeHours ? `${left.activity.prMergeHours.toFixed(1)} hrs` : "N/A", right.activity.prMergeHours ? `${right.activity.prMergeHours.toFixed(1)} hrs` : "N/A"],
    ["Direct deps", left.dependencies.directCount ?? "N/A", right.dependencies.directCount ?? "N/A"],
    ["Lockfile", left.dependencies.hasLockfile ? "Yes" : "No", right.dependencies.hasLockfile ? "Yes" : "No"],
    ["Top languages", left.languages.map((item) => `${item.name} ${item.percentage}%`).join(", ") || "N/A", right.languages.map((item) => `${item.name} ${item.percentage}%`).join(", ") || "N/A"],
    ["Code health", `${left.health.passed}/${left.health.total}`, `${right.health.passed}/${right.health.total}`]
  ];

  return el("section", { className: "compare-card" }, [
    el("p", { className: "eyebrow", text: "Saved Comparison" }),
    el("h3", { className: "section-title", text: `${left.name} vs ${right.name}` }),
    el("p", { className: "table-caption", text: "Detailed side-by-side view of the two saved repositories." }),
    el("table", { className: "compare-table" }, [
      el("thead", {}, [
        el("tr", {}, [
          el("th", { text: "Metric" }),
          el("th", { text: left.name }),
          el("th", { text: right.name })
        ])
      ]),
      el(
        "tbody",
        {},
        rows.map((row) =>
          el("tr", {}, [
            el("td", { text: String(row[0]) }),
            el("td", { text: String(row[1]) }),
            el("td", { text: String(row[2]) })
          ])
        )
      )
    ])
  ]);
}

export function renderLoading(container) {
  container.replaceChildren(
    el("div", { className: "summary-stack" }, [
      el("section", { className: "hero-card skeleton-card skeleton" }, [
        el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 32%;" } }),
        el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 72%; height: 22px;" } }),
        el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 92%;" } }),
        el("div", { className: "metrics-grid" }, Array.from({ length: 4 }, () => el("div", { className: "metric-tile skeleton" }))),
        el("div", { className: "badge-row" }, Array.from({ length: 4 }, () => el("div", { className: "skeleton-chip skeleton" })))
      ]),
      ...Array.from({ length: 4 }, () =>
        el("section", { className: "card skeleton-card skeleton" }, [
          el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 40%;" } }),
          el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 88%;" } }),
          el("div", { className: "skeleton-line skeleton", attrs: { style: "width: 70%;" } })
        ])
      )
    ])
  );
}

export function renderMessage(container, { title, body, variant = "empty" }) {
  container.replaceChildren(
    el("section", { className: `message-card is-${variant}` }, [
      el("p", { className: "eyebrow", text: variant === "error" ? "Something went wrong" : "No analysis available" }),
      el("h2", { text: title }),
      el("p", { className: "empty-copy", text: body })
    ])
  );
}

export function renderRepoAnalysis(container, analysis, comparisonSnapshots = [], isFromCache = false) {
  const techCard = createCollapsibleCard(
    "Tech Stack",
    analysis.techStack.badges.length
      ? `${analysis.techStack.badges.length} technologies detected`
      : "No technologies detected",
    [
      analysis.techStack.badges.length
        ? el("div", { className: "badge-row" }, analysis.techStack.badges.map((item) => badge(item)))
        : el("p", { className: "empty-copy", text: "No stack signals were detected from the repository root." }),
      analysis.techStack.languages.length
        ? el("div", { className: "language-list" }, analysis.techStack.languages.map((item) => badge(`${item.name} ${item.percentage}%`, true)))
        : null,
      analysis.techStack.rootSignals.length
        ? el("p", { className: "status-detail", text: `Detected root files: ${analysis.techStack.rootSignals.join(", ")}` })
        : null
    ]
  );

  const codeHealthCard = createCollapsibleCard(
    "Code Health",
    `${analysis.codeHealth.filter((item) => item.status === "good").length}/${analysis.codeHealth.length} checks passing`,
    el("div", { className: "status-list" }, analysis.codeHealth.map(statusRow))
  );

  const activityCard = createCollapsibleCard(
    "Activity",
    `${analysis.activity.totalCommits12Months.toLocaleString("en-US")} commits in the last 12 months`,
    [
      el("div", { className: "metrics-grid" }, [
        metricTile("Last commit", analysis.activity.lastCommitLabel),
        metricTile("Recency", analysis.activity.lastCommitRelative),
        metricTile("Issue close time", analysis.activity.issueCloseLabel),
        metricTile("PR merge time", analysis.activity.prMergeLabel),
        metricTile("Contributors", analysis.activity.contributorCount.toLocaleString("en-US")),
        metricTile("Avg commits / week", String(analysis.activity.averageWeeklyCommits))
      ]),
      renderSparkline(analysis.activity.monthlyCommitBuckets)
    ]
  );

  const dependencyCard = createCollapsibleCard(
    "Dependencies",
    analysis.dependencies.source === "Not available"
      ? "Dependency manifest not found"
      : `Parsed from ${analysis.dependencies.source}`,
    [
      el("div", { className: "dependency-grid" }, [
        metricTile("Direct dependencies", analysis.dependencies.directCountLabel),
        metricTile("Lockfile", analysis.dependencies.hasLockfile ? "Present" : "Missing")
      ]),
      analysis.dependencies.frameworks.length
        ? el("div", { className: "framework-list" }, analysis.dependencies.frameworks.map((framework) => badge(framework)))
        : el("p", { className: "empty-copy", text: "No major frameworks were detected from the dependency manifest." }),
      analysis.dependencies.missingLockfile
        ? statusRow({
            label: "Lockfile status",
            status: "warn",
            detail: "A dependency manifest was detected without a lockfile in the repository root."
          })
        : null
    ]
  );

  const comparisonCard = renderComparisonTable(comparisonSnapshots);
  const recommendationsCard = renderRecommendations(analysis.recommendations);

  container.replaceChildren(
    el("div", { className: "summary-stack" }, [
      renderHero(analysis, isFromCache),
      ...(comparisonCard ? [comparisonCard] : []),
      ...(recommendationsCard ? [recommendationsCard] : []),
      el("div", { className: "section-stack" }, [techCard, codeHealthCard, activityCard, dependencyCard])
    ])
  );
}

export function renderProfileAnalysis(container, analysis, isFromCache = false) {
  const languagesCard = el("section", { className: "compare-card" }, [
    el("p", { className: "eyebrow", text: "Language Breakdown" }),
    el("h3", { className: "section-title", text: "Most Used Languages" }),
    analysis.topLanguages.length
      ? el("div", { className: "language-list" }, analysis.topLanguages.map((item) => badge(`${item.name} ${item.percentage}%`)))
      : el("p", { className: "empty-copy", text: "No language data is available for the fetched repositories." })
  ]);

  const reposCard = el("section", { className: "compare-card" }, [
    el("p", { className: "eyebrow", text: "Highlights" }),
    el("h3", { className: "section-title", text: "Top Starred Repositories" }),
    analysis.topStarredRepos.length
      ? el(
          "div",
          { className: "section-stack" },
          analysis.topStarredRepos.map((repo) =>
            el("div", { className: "list-row" }, [
              el("span", { className: "metric-icon", html: iconMarkup("dot") }),
              el("div", {}, [
                el("a", {
                  text: repo.name,
                  href: repo.url,
                  target: "_blank",
                  rel: "noreferrer"
                }),
                el("p", { className: "repo-meta", text: `${repo.stars} stars` }),
                el("p", { className: "status-detail", text: repo.description })
              ])
            ])
          )
        )
      : el("p", { className: "empty-copy", text: "No starred repository ranking is available." })
  ]);

  const activityCard = el("section", { className: "compare-card" }, [
    el("p", { className: "eyebrow", text: "Contribution Activity" }),
    el("h3", { className: "section-title", text: analysis.activity.hasRecentActivity ? "Recently active" : "No recent public push activity" }),
    el("p", {
      className: "empty-copy",
      text: analysis.activity.hasRecentActivity
        ? `Last public push event was ${analysis.activity.recentPushRelative} (${analysis.activity.recentPushLabel}).`
        : "No public push events were found in the last 30 days."
    })
  ]);

  const recommendationsCard = renderRecommendations(analysis.recommendations);

  container.replaceChildren(
    el("div", { className: "summary-stack" }, [
      renderHero(analysis, isFromCache),
      ...(recommendationsCard ? [recommendationsCard] : []),
      languagesCard,
      reposCard,
      activityCard
    ])
  );
}

export function renderRateLimit(labelElement, rateLimit, isFromCache = false, cacheTimestamp = null) {
  if (!labelElement) {
    return;
  }

  if (isFromCache && cacheTimestamp) {
    const CACHE_DURATION = 5 * 60 * 60 * 1000;
    const expiresAt = new Date(cacheTimestamp + CACHE_DURATION);
    const hoursLeft = Math.floor((expiresAt - Date.now()) / (60 * 60 * 1000));
    const minutesLeft = Math.floor((expiresAt - Date.now()) / (60 * 1000)) % 60;

    const timeLeft = hoursLeft > 0
      ? `${hoursLeft}h ${minutesLeft}m`
      : `${minutesLeft}m`;

    labelElement.textContent = `Cached data • Expires in ${timeLeft}`;
    return;
  }

  if (isFromCache) {
    labelElement.textContent = "Data loaded from cache";
    return;
  }

  if (!rateLimit) {
    labelElement.textContent = "Rate limit: unavailable";
    return;
  }

  const resetText = rateLimit.resetAt
    ? `, resets ${new Date(rateLimit.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";
  labelElement.textContent = `Rate limit: ${rateLimit.remaining ?? "--"} / ${rateLimit.limit ?? "--"}${resetText}`;
}
