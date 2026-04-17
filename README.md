# GitScope

GitScope is a Manifest V3 browser extension that adds a side panel for analyzing GitHub repositories and profiles while you browse `github.com`.

It is designed to work directly in the browser with no backend. GitHub data is fetched from the public API, analysis happens locally, and optional authentication is handled with a user-provided Personal Access Token.

## Features

- Detects GitHub repository and profile pages automatically
- Opens a Chrome side panel with contextual analysis for the current page
- Summarizes repository health, activity, dependencies, and language usage
- Generates profile-level insights from public repository activity
- Supports side-by-side comparison for two saved repositories
- Copies a Markdown report for sharing or review
- Caches analysis results locally to reduce repeated API calls
- Supports an optional GitHub token to raise API rate limits

## Installation

### Load locally in Chrome

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root.

### Build a distributable zip

Run:

```bash
./build.sh
```

This creates a versioned zip such as `gitscope-v1.1.1.zip` in the repository root.

## Usage

1. Open a GitHub repository or user profile page.
2. Click the GitScope extension action to open the side panel.
3. Review the generated analysis.
4. Optionally add a GitHub Personal Access Token in Settings to avoid low unauthenticated rate limits.
5. Use **Copy Report** to export a Markdown summary or **Compare** to save repositories for side-by-side review.

## Development

GitScope is a plain JavaScript extension with no bundler or package manager requirement.

### Project structure

- `manifest.json`: extension manifest
- `src/background.js`: background service worker and side panel orchestration
- `src/content.js`: GitHub page context detection
- `src/sidepanel.*`: side panel UI
- `src/utils/`: GitHub API access, analysis logic, and rendering helpers
- `icons/`: packaged extension icons

### Local workflow

1. Edit files in `src/`, `manifest.json`, or `icons/`.
2. Reload the extension from `chrome://extensions`.
3. Re-test on GitHub repository and profile pages.
4. Run `./build.sh` when you need a release zip.

## Permissions

GitScope requests only the permissions needed to function:

- `activeTab`: inspect the current GitHub page context
- `storage`: store local settings and cached analysis
- `sidePanel`: render the extension UI in Chrome's side panel
- `https://api.github.com/*`: fetch public GitHub API data
- `https://github.com/*`: detect supported pages on GitHub

## Privacy

GitScope is intended to be privacy-conscious:

- There is no application backend
- Analysis happens locally in the browser
- Cached data stays on the user's device
- A GitHub token is optional and stored via browser extension storage

See [PRIVACY.md](./PRIVACY.md) for the full policy.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, expectations, and pull request guidelines.

## Support

Usage questions, bug reports, and feature requests should go through the repository issue tracker. See [SUPPORT.md](./SUPPORT.md) for routing.

## Security

Please report vulnerabilities responsibly. See [SECURITY.md](./SECURITY.md) before disclosing a security issue.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).

