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

function detectPageContext(rawUrl = window.location.href) {
  const url = new URL(rawUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  const [owner, repo] = segments;

  if (url.hostname !== "github.com") {
    return { type: "external", url: rawUrl };
  }

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

let lastContextKey = "";

function notifyPageContext() {
  const context = detectPageContext();
  const contextKey = JSON.stringify(context);

  if (contextKey === lastContextKey) {
    return;
  }

  lastContextKey = contextKey;
  chrome.runtime.sendMessage({
    type: "PAGE_CONTEXT_UPDATE",
    context
  });
}

function wrapHistoryMethod(methodName) {
  const original = history[methodName];

  history[methodName] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    queueMicrotask(notifyPageContext);
    return result;
  };
}

wrapHistoryMethod("pushState");
wrapHistoryMethod("replaceState");

window.addEventListener("popstate", notifyPageContext);
window.addEventListener("hashchange", notifyPageContext);
document.addEventListener("turbo:load", notifyPageContext);
document.addEventListener("pjax:end", notifyPageContext);

notifyPageContext();
