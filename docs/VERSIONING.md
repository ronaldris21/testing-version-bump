# 🚀 Automatic Versioning System

This project has an intelligent automatic versioning system that updates the `package.json` version whenever a PR is merged into the `main` branch, using **Semantic Release**.

## 📋 Version Format

The version follows a 4-part format: `{sprint}.{major}.{minor}.{patch}`

- **Sprint**: Incremented at the start of each sprint (manual)
- **Major**: Breaking changes
- **Minor**: New features
# Versioning (custom auto bump)

This repository uses a custom sequential 4-part versioning scheme and a small automation script instead of semantic-release.

Version format: `SPRINT.MAJOR.MINOR.PATCH` (example: `5.2.1.0`)

- Sprint: comes from the first segment of `package.json`'s `version` field and is the configured sprint number.
- Major: breaking changes.
- Minor: new features and refactors.
- Patch: bug fixes and tests.

Rules (sequential, processed oldest → newest):

- `BREAKING CHANGE:` in commit body or subject → +1.0.0 (sets Major += 1; Minor = 0; Patch = 0)
- `feat:` or `refactor:` → +0.1.0 (Minor += 1; Patch = 0)
- `fix:` or `test:` → +0.0.1 (Patch += 1)
- `chore:` and other types → no change

Processing details:

- Commits are read using `git` and processed from oldest to newest.
- The sprint number is read from the existing `package.json` version's first segment (no separate config file required).
- If the last commit message already contains `chore: bump version to`, the job exits early to prevent duplicate bumps.

Where it runs:

- Triggered on push to the `test` and `release` branches via the workflow at `.github/workflows/version-bump.yml`.

Manual checks:

- You can view the current version in `package.json` or run:

```bash
pnpm version:check
```

Notes:

- We intentionally do not generate changelogs or rely on semantic-release for this flow.
- The automation commits a bump using the message: `chore: bump version to X.X.X.X`.
