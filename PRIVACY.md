# Privacy Policy for GitScope

**Last Updated:** April 17, 2026
**Version:** 1.1.1

## Overview

GitScope is a browser extension that analyzes GitHub repositories and profiles. This privacy policy explains what data we collect, how we use it, and your rights regarding your information.

## Data Collection

### What We Collect

GitScope collects and processes the following data:

1. **GitHub API Data**
   - Public repository information (stars, forks, commits, languages, etc.)
   - Public user profile information (repositories, followers, activity)
   - This data is fetched directly from GitHub's public API

2. **User-Provided Data**
   - GitHub Personal Access Token (optional, stored locally)
   - User preferences and settings

3. **Cached Data**
   - Repository and profile analysis results (stored locally for 5 hours)
   - Comparison snapshots for up to 2 repositories

### What We DO NOT Collect

- We do NOT collect personal identification information
- We do NOT track your browsing history
- We do NOT collect data from private repositories (unless you provide a token with access)
- We do NOT send any data to external servers or third parties
- We do NOT use analytics or tracking services

## Data Storage

### Local Storage Only

All data is stored **locally on your device** using:
- `localStorage` - For cached analysis results (5-hour expiry)
- `chrome.storage.sync` - For your GitHub Personal Access Token (if provided)
- `chrome.storage.local` - For repository comparison data

**Important:** No data is ever transmitted to our servers because we don't have any servers. All processing happens in your browser.

### Data Retention

- **Cache:** Automatically deleted after 5 hours
- **GitHub Token:** Stored until you clear it via Settings
- **Comparison Data:** Stored until you clear it or save new repositories

## How We Use Data

GitScope uses your data solely for:

1. **Repository Analysis**
   - Displaying repository statistics and health metrics
   - Generating recommendations for improvement
   - Comparing repositories side-by-side

2. **Profile Analysis**
   - Showing user activity and contribution patterns
   - Analyzing language usage across repositories
   - Highlighting top projects

3. **Performance Optimization**
   - Caching analysis results to reduce API calls
   - Preserving your API rate limits

## Third-Party Services

### GitHub API

GitScope communicates directly with GitHub's public API to fetch repository and user data. This communication is subject to [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

**No Other Third Parties:** We do not share data with any other services, analytics providers, or advertisers.

## GitHub Personal Access Token

### Optional Feature

Providing a GitHub Personal Access Token is **completely optional**. The extension works without it, but you'll be limited to GitHub's unauthenticated API rate limits (60 requests/hour).

### How We Handle Your Token

- **Storage:** Encrypted by Chrome using `chrome.storage.sync`
- **Usage:** Only sent to GitHub's API for authentication
- **Access:** Never shared with anyone or any service
- **Control:** You can view, update, or delete it anytime via Settings

### Security Recommendations

1. Create a token with minimal permissions (public repository read-only access is sufficient)
2. Regularly rotate your tokens
3. Revoke tokens if you uninstall the extension

## Your Rights and Control

You have full control over your data:

### Clear Cache
```javascript
// In browser console
window.GitScopeCache.clear()
```

### Remove GitHub Token
1. Click the Settings icon
2. Click "Clear" button
3. Click "Save"

### Complete Data Removal
Uninstalling the extension removes all stored data permanently.

## Data Security

We take security seriously:

- All API requests use HTTPS encryption
- Tokens are stored using Chrome's secure storage API
- No data leaves your device except for GitHub API requests
- Open-source code available for security audits

## Children's Privacy

GitScope does not knowingly collect information from anyone under 13 years of age. GitHub requires users to be at least 13 years old.

## Changes to This Policy

We may update this privacy policy occasionally. Changes will be reflected in:
- The "Last Updated" date at the top
- The extension version number
- Repository release notes or extension listing updates, when applicable

## Permissions Explained

GitScope requests the following Chrome permissions:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Read the current GitHub page URL to determine what to analyze |
| `storage` | Store your GitHub token and cached analysis results locally |
| `sidePanel` | Display the analysis interface in Chrome's side panel |
| `https://api.github.com/*` | Fetch repository and user data from GitHub's API |
| `https://github.com/*` | Detect when you're viewing a GitHub repository or profile |

## Open Source

GitScope is open source. You can review the code to verify our privacy practices:
- **Repository:** This repository
- **License:** MIT License

## Contact

If you have questions or concerns about this privacy policy:

- **Support:** See [SUPPORT.md](./SUPPORT.md)
- **Security Issues:** See [SECURITY.md](./SECURITY.md) and avoid public disclosure

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- GitHub API Terms of Service
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) guidelines

## Summary

**In plain English:**
- GitScope only fetches public GitHub data using GitHub's official API
- Everything is stored locally on your computer
- Your optional GitHub token never leaves your device (except to authenticate with GitHub)
- We don't track you, sell your data, or send anything to our servers
- You can delete all data anytime by clearing the cache or uninstalling

---

By using GitScope, you agree to this privacy policy. If you don't agree, please uninstall the extension.
