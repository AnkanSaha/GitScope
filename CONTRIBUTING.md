# Contributing to GitScope

## Scope

GitScope is a browser extension focused on GitHub repository and profile analysis. Contributions should preserve that scope and avoid introducing unnecessary infrastructure.

## Before You Start

- Search existing issues and pull requests before opening a new one
- Open an issue first for large feature changes or behavior changes
- Keep changes focused; unrelated cleanups should be split into separate pull requests

## Development Setup

1. Fork and clone the repository.
2. Load the extension locally through `chrome://extensions` using **Load unpacked**.
3. Make your changes.
4. Reload the extension and test on relevant GitHub pages.

## Project Conventions

- Prefer small, readable JavaScript modules
- Keep the extension dependency-free unless there is a strong reason otherwise
- Preserve Manifest V3 compatibility
- Avoid adding telemetry, tracking, or server-side dependencies
- Update documentation when user-visible behavior changes

## Manual Testing

There is currently no automated test suite in this repository, so each pull request should include manual verification notes.

At minimum, verify the changed behavior against the relevant page types:

- GitHub repository pages
- GitHub profile pages
- Unsupported GitHub routes
- Token and rate-limit related flows if your change affects API requests

## Pull Request Checklist

- The change is scoped and documented
- Existing behavior is not unintentionally broken
- No secrets, tokens, or build artifacts are committed
- Any permission, privacy, or security impact is documented
- `./build.sh` still succeeds if the packaging flow is affected

## Code of Conduct

By participating in this project, you agree to follow the standards in [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

