const RESERVED_ROOT_SEGMENTS = new Set([
  "about",
  "account",
  "apps",
  "collections",
  "contact",
  "customer-stories",
  "enterprise",
  "events",
  "explore",
  "features",
  "gist",
  "github",
  "issues",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "organizations",
  "pricing",
  "pulls",
  "search",
  "security",
  "sessions",
  "settings",
  "signup",
  "site",
  "sponsors",
  "teams",
  "topics",
  "trending"
]);

const pageContexts = new Map();

function parseGitHubUrl(rawUrl) {
  if (!rawUrl) {
    return { type: "unsupported", reason: "no-url" };
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    return { type: "unsupported", reason: "invalid-url", url: rawUrl };
  }

  if (url.hostname !== "github.com") {
    return { type: "external", url: rawUrl };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo] = segments;

  if (!owner) {
    return { type: "unsupported", url: rawUrl, reason: "github-home" };
  }

  if (RESERVED_ROOT_SEGMENTS.has(owner.toLowerCase())) {
    return { type: "unsupported", url: rawUrl, reason: "reserved-root" };
  }

  if (repo) {
    return {
      type: "repo",
      url: rawUrl,
      owner,
      repo
    };
  }

  return {
    type: "profile",
    url: rawUrl,
    username: owner
  };
}

async function safeSendRuntimeMessage(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // The side panel is not guaranteed to be open.
  }
}

async function notifyActiveContext(tabId, explicitContext) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);

  if (!tab?.active) {
    return;
  }

  const context = explicitContext ?? pageContexts.get(tabId) ?? parseGitHubUrl(tab.url);
  await safeSendRuntimeMessage({ type: "CONTEXT_CHANGED", context, tabId });
}

async function syncPanelForTab(tabId, url) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  const enabled = typeof url === "string" && /^https?:\/\//.test(url);

  await chrome.sidePanel
    .setOptions({
      tabId,
      path: "src/sidepanel.html",
      enabled
    })
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) {
    return;
  }

  await syncPanelForTab(tab.id, tab.url);
  await chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  await notifyActiveContext(tab.id);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await syncPanelForTab(tabId, tab?.url);
  await notifyActiveContext(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    pageContexts.delete(tabId);
    await syncPanelForTab(tabId, changeInfo.url);
    await notifyActiveContext(tabId, parseGitHubUrl(changeInfo.url));
    return;
  }

  if (changeInfo.status === "complete") {
    await syncPanelForTab(tabId, tab?.url);
    await notifyActiveContext(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pageContexts.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PAGE_CONTEXT_UPDATE" && sender.tab?.id) {
    pageContexts.set(sender.tab.id, message.context);
    notifyActiveContext(sender.tab.id, message.context);
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_CURRENT_CONTEXT") {
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        const activeTab = tabs[0];
        const context = activeTab?.id
          ? pageContexts.get(activeTab.id) ?? parseGitHubUrl(activeTab.url)
          : { type: "unsupported", reason: "no-active-tab" };

        sendResponse({
          ok: true,
          context,
          tabId: activeTab?.id ?? null
        });
      })
      .catch(() => {
        sendResponse({
          ok: true,
          context: { type: "unsupported", reason: "query-failed" },
          tabId: null
        });
      });

    return true;
  }

  return false;
});
