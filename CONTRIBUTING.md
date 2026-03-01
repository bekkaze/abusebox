# Contributing

Thanks for contributing to AbuseBox.

## Development setup

1. Fork and clone the repository.
2. Create a branch from `main`.
3. Follow setup steps in [README.md](README.md).
4. Make focused, reviewable changes.
5. Run checks before opening a PR.

## Pull request guidelines

- Keep PRs small and scoped.
- Include a clear summary of what changed and why.
- Link related issues.
- Add or update tests when behavior changes.
- Update documentation when setup, behavior, or APIs change.

## Commit message format

Use concise, imperative commit messages:

- `fix: prevent deleting other user hostnames`
- `feat: add loading state for monitor list`
- `docs: improve docker setup instructions`

## Reporting bugs

Please include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Logs, screenshots, or request/response snippets when relevant
- Environment details (OS, Python, Node, browser)

## Code style

- Python: follow PEP 8 and keep functions focused.
- React: prefer small reusable components and avoid dead code.
- Keep naming clear and consistent.
- Avoid unrelated refactors in the same PR.
