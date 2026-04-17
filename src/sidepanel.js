import { createGitHubClient, GitHubApiError } from "./utils/github-api.js";
import {
  analyzeProfileSnapshot,
  analyzeRepositorySnapshot,
  buildMarkdownReport
} from "./utils/analyzer.js";
import {
  renderLoading,
  renderMessage,
  renderProfileAnalysis,
  renderRateLimit,
  renderRepoAnalysis
} from "./utils/renderer.js";

const contentElement = document.getElementById("content");
const copyReportButton = document.getElementById("copy-report-button");
const compareButton = document.getElementById("compare-button");
const settingsButton = document.getElementById("settings-button");
const rateLimitLabel = document.getElementById("rate-limit-label");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsButton = document.getElementById("close-settings-button");
const saveTokenButton = document.getElementById("save-token-button");
const clearTokenButton = document.getElementById("clear-token-button");
const tokenInput = document.getElementById("token-input");

const state = {
  token: "",
  context: null,
  analysis: null,
  compareSnapshots: [],
  rateLimit: null,
  loadId: 0,
  isFromCache: false,
  cacheTimestamp: null
};

const CACHE_DURATION = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const CACHE_PREFIX = "gitscope_cache_";

function cleanExpiredCache() {
  try {
    const now = Date.now();
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const cachedString = localStorage.getItem(key);
        if (cachedString) {
          try {
            const cached = JSON.parse(cachedString);
            if (now - cached.timestamp > CACHE_DURATION) {
              keysToRemove.push(key);
            }
          } catch (e) {
            keysToRemove.push(key);
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (keysToRemove.length > 0) {
      console.log(`Cleaned ${keysToRemove.length} expired cache entries`);
    }
  } catch (error) {
    console.error("Error cleaning expired cache:", error);
  }
}

function clearAllCache() {
  try {
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    console.log(`Cleared all GitScope cache (${keysToRemove.length} entries)`);
    return keysToRemove.length;
  } catch (error) {
    console.error("Error clearing cache:", error);
    return 0;
  }
}

// Expose cache management functions to console for debugging
window.GitScopeCache = {
  clear: clearAllCache,
  cleanExpired: cleanExpiredCache,
  get: getCachedData,
  getDuration: () => CACHE_DURATION,
  getInfo: () => {
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        const cachedString = localStorage.getItem(key);
        if (cachedString) {
          try {
            const cached = JSON.parse(cachedString);
            const ageMinutes = Math.floor((Date.now() - cached.timestamp) / 60000);
            const sizeKB = (cachedString.length / 1024).toFixed(2);
            cacheKeys.push({
              key: key.replace(CACHE_PREFIX, ''),
              ageMinutes,
              sizeKB,
              expiresInMinutes: 300 - ageMinutes
            });
          } catch (e) {
            cacheKeys.push({ key, error: 'Invalid JSON' });
          }
        }
      }
    }
    return cacheKeys;
  }
};

function getCachedData(key) {
  try {
    const cachedString = localStorage.getItem(key);

    if (!cachedString) {
      console.log(`Cache miss for key: ${key}`);
      return null;
    }

    const cached = JSON.parse(cachedString);
    const now = Date.now();

    if (now - cached.timestamp > CACHE_DURATION) {
      // Cache expired, remove it
      localStorage.removeItem(key);
      console.log(`Cache expired for key: ${key}`);
      return null;
    }

    const ageMinutes = Math.floor((now - cached.timestamp) / 60000);
    console.log(`Cache hit for key: ${key} (age: ${ageMinutes} minutes)`);

    return {
      data: cached.data,
      timestamp: cached.timestamp
    };
  } catch (error) {
    console.error("Error reading cache:", error);
    return null;
  }
}

function setCachedData(key, data) {
  try {
    const cacheObject = {
      data,
      timestamp: Date.now()
    };
    const cacheString = JSON.stringify(cacheObject);
    localStorage.setItem(key, cacheString);

    const sizeKB = (cacheString.length / 1024).toFixed(2);
    console.log(`Cache saved for key: ${key} (size: ${sizeKB} KB)`);
  } catch (error) {
    console.error("Error setting cache:", error);
    if (error.name === 'QuotaExceededError') {
      console.warn("localStorage quota exceeded, clearing old cache entries");
      cleanExpiredCache();
    }
  }
}

function getContextIdentity(context) {
  if (!context) {
    return "none";
  }

  if (context.type === "repo") {
    return `repo:${context.owner}/${context.repo}`;
  }

  if (context.type === "profile") {
    return `profile:${context.username}`;
  }

  return context.type;
}

async function getStoredToken() {
  const result = await chrome.storage.sync.get({ githubToken: "" });
  return result.githubToken ?? "";
}

async function getCompareSnapshots() {
  const result = await chrome.storage.local.get({ compareRepos: [] });
  return Array.isArray(result.compareRepos) ? result.compareRepos : [];
}

function setButtonBusy(button, label) {
  button.disabled = true;
  button.dataset.previousLabel = button.textContent;
  button.textContent = label;
}

function restoreButton(button, fallbackLabel) {
  button.disabled = false;
  button.textContent = button.dataset.previousLabel || fallbackLabel;
  delete button.dataset.previousLabel;
}

function showTemporaryButtonLabel(button, label, duration = 1400) {
  const previous = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = previous;
  }, duration);
}

function openSettings() {
  settingsModal.classList.remove("hidden");
  settingsModal.setAttribute("aria-hidden", "false");
  tokenInput.focus();
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.setAttribute("aria-hidden", "true");
}

function getFriendlyError(error, context) {
  if (error instanceof GitHubApiError) {
    if (error.category === "rate_limited") {
      return {
        title: "GitHub API rate limit reached",
        body: "Unauthenticated requests are temporarily exhausted. Add a Personal Access Token in settings to raise the limit, then refresh the analysis."
      };
    }

    if (error.category === "bad_credentials") {
      return {
        title: "GitHub token rejected",
        body: "The saved Personal Access Token is invalid or expired. Update it in settings and try again."
      };
    }

    if (error.category === "private_or_inaccessible" && context?.type === "repo") {
      return {
        title: "Repository data is unavailable",
        body: "This repository is private or inaccessible through the GitHub API with the current credentials."
      };
    }

    if (error.category === "private_or_inaccessible" && context?.type === "profile") {
      return {
        title: "Profile data is unavailable",
        body: "This GitHub profile could not be loaded from the public API."
      };
    }
  }

  return {
    title: "GitHub data could not be loaded",
    body: "GitScope could not complete the analysis right now. Try again in a moment or provide a GitHub token in settings for higher rate limits."
  };
}

function updateControls() {
  copyReportButton.disabled = !state.analysis;

  if (state.analysis?.type === "repo") {
    compareButton.hidden = false;
    compareButton.disabled = false;
    const isSaved = state.compareSnapshots.some((snapshot) => snapshot.key === state.analysis.key);
    compareButton.textContent = isSaved
      ? "Saved for Compare"
      : state.compareSnapshots.length >= 2
        ? "Replace in Compare"
        : "Save to Compare";
    return;
  }

  compareButton.hidden = true;
  compareButton.disabled = true;
}

function rerender() {
  if (!state.analysis) {
    updateControls();
    renderRateLimit(rateLimitLabel, state.rateLimit, state.isFromCache, state.cacheTimestamp);
    return;
  }

  if (state.analysis.type === "repo") {
    renderRepoAnalysis(contentElement, state.analysis, state.compareSnapshots, state.isFromCache);
  } else {
    renderProfileAnalysis(contentElement, state.analysis, state.isFromCache);
  }

  updateControls();
  renderRateLimit(rateLimitLabel, state.rateLimit, state.isFromCache, state.cacheTimestamp);
}

async function fetchContext() {
  const response = await chrome.runtime.sendMessage({ type: "GET_CURRENT_CONTEXT" });
  return response?.context ?? { type: "unsupported" };
}

async function refreshAnalysis({ force = false } = {}) {
  const context = await fetchContext();
  const nextIdentity = getContextIdentity(context);
  const currentIdentity = getContextIdentity(state.context);

  if (!force && nextIdentity === currentIdentity && state.analysis) {
    return;
  }

  state.context = context;
  state.analysis = null;
  state.isFromCache = false;
  state.cacheTimestamp = null;
  state.compareSnapshots = await getCompareSnapshots();
  state.loadId += 1;
  const loadId = state.loadId;

  renderLoading(contentElement);
  updateControls();
  renderRateLimit(rateLimitLabel, state.rateLimit, state.isFromCache, state.cacheTimestamp);

  if (context.type !== "repo" && context.type !== "profile") {
    state.rateLimit = null;
    renderMessage(contentElement, {
      title: "No GitHub target detected",
      body: "Navigate to a GitHub repository or profile to analyze it."
    });
    updateControls();
    renderRateLimit(rateLimitLabel, state.rateLimit, state.isFromCache, state.cacheTimestamp);
    return;
  }

  // Try to load from cache first (unless forced)
  const cacheKey = `gitscope_cache_${nextIdentity}`;
  if (!force) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      if (loadId !== state.loadId) {
        return;
      }

      state.analysis = cached.data;
      state.isFromCache = true;
      state.cacheTimestamp = cached.timestamp;
      state.compareSnapshots = await getCompareSnapshots();
      rerender();
      return;
    }
  }

  try {
    const client = createGitHubClient(state.token);
    const snapshot =
      context.type === "repo"
        ? await client.fetchRepositorySnapshot(context.owner, context.repo)
        : await client.fetchProfileSnapshot(context.username);

    const analysis =
      context.type === "repo"
        ? analyzeRepositorySnapshot(snapshot)
        : analyzeProfileSnapshot(snapshot);

    if (loadId !== state.loadId) {
      return;
    }

    // Save to cache
    setCachedData(cacheKey, analysis);

    state.analysis = analysis;
    state.isFromCache = false;
    state.cacheTimestamp = null;
    state.rateLimit = client.getLatestRateLimit();
    state.compareSnapshots = await getCompareSnapshots();
    rerender();
  } catch (error) {
    if (loadId !== state.loadId) {
      return;
    }

    state.analysis = null;
    state.isFromCache = false;
    state.cacheTimestamp = null;
    state.rateLimit = error instanceof GitHubApiError ? error.rateLimit : state.rateLimit;
    const friendly = getFriendlyError(error, context);
    renderMessage(contentElement, {
      title: friendly.title,
      body: friendly.body,
      variant: "error"
    });
    updateControls();
    renderRateLimit(rateLimitLabel, state.rateLimit, state.isFromCache, state.cacheTimestamp);
  }
}

async function saveCurrentRepoForComparison() {
  if (state.analysis?.type !== "repo") {
    return;
  }

  setButtonBusy(compareButton, "Saving...");

  try {
    const existing = await getCompareSnapshots();
    const snapshot = {
      ...state.analysis.compareSnapshot,
      savedAt: new Date().toISOString()
    };
    const withoutCurrent = existing.filter((item) => item.key !== snapshot.key);
    const next = [...withoutCurrent, snapshot];
    const trimmed = next.length > 2 ? next.slice(next.length - 2) : next;

    await chrome.storage.local.set({ compareRepos: trimmed });
    state.compareSnapshots = trimmed;
    rerender();
  } finally {
    restoreButton(compareButton, "Compare");
    updateControls();
    showTemporaryButtonLabel(compareButton, "Saved");
  }
}

async function copyReport() {
  if (!state.analysis) {
    return;
  }

  setButtonBusy(copyReportButton, "Copying...");

  try {
    const markdown = buildMarkdownReport(state.analysis, state.compareSnapshots);
    await navigator.clipboard.writeText(markdown);
  } finally {
    restoreButton(copyReportButton, "Copy Report");
    updateControls();
    showTemporaryButtonLabel(copyReportButton, "Copied");
  }
}

async function saveToken(value) {
  await chrome.storage.sync.set({ githubToken: value.trim() });
  state.token = value.trim();
}

function bindEvents() {
  compareButton.addEventListener("click", saveCurrentRepoForComparison);
  copyReportButton.addEventListener("click", copyReport);
  settingsButton.addEventListener("click", openSettings);
  closeSettingsButton.addEventListener("click", closeSettings);
  saveTokenButton.addEventListener("click", async () => {
    await saveToken(tokenInput.value);
    closeSettings();
    await refreshAnalysis({ force: true });
  });
  clearTokenButton.addEventListener("click", async () => {
    tokenInput.value = "";
    await saveToken("");
    closeSettings();
    await refreshAnalysis({ force: true });
  });
  settingsModal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.closeSettings === "true") {
      closeSettings();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !settingsModal.classList.contains("hidden")) {
      closeSettings();
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "CONTEXT_CHANGED") {
      const nextIdentity = getContextIdentity(message.context);
      const currentIdentity = getContextIdentity(state.context);

      if (nextIdentity !== currentIdentity) {
        // Don't force - let it check cache for the new context
        refreshAnalysis({ force: false });
      }
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.compareRepos) {
      state.compareSnapshots = Array.isArray(changes.compareRepos.newValue)
        ? changes.compareRepos.newValue
        : [];

      if (state.analysis?.type === "repo") {
        rerender();
      } else {
        updateControls();
      }
    }

    if (areaName === "sync" && changes.githubToken) {
      state.token = changes.githubToken.newValue ?? "";
      tokenInput.value = state.token;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAnalysis();
    }
  });
}

async function init() {
  // Clean expired cache entries on startup
  cleanExpiredCache();

  // Log cache stats
  const cacheInfo = window.GitScopeCache.getInfo();
  if (cacheInfo.length > 0) {
    console.log(`GitScope cache: ${cacheInfo.length} entries`, cacheInfo);
    console.log('Use window.GitScopeCache.clear() to clear all cache');
  } else {
    console.log('GitScope cache: empty');
  }

  state.token = await getStoredToken();
  state.compareSnapshots = await getCompareSnapshots();
  tokenInput.value = state.token;
  bindEvents();
  // Don't force refresh on init to allow cache usage
  await refreshAnalysis({ force: false });
}

init();
