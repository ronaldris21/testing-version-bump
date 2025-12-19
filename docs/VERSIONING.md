# 🚀 Automatic Versioning System

This project has an intelligent automatic versioning system that updates the `package.json` version whenever a PR is merged into the `main` branch, using **Semantic Release**.

## 📋 Version Format


# Versioning (custom auto bump)

This repository uses a custom versioning scheme and a small automation script instead of semantic-release.

## Version format

- **Sprint**: Managed manually as a separate property in `package.json` (not part of the automated version logic).
- **Version**: `MAJOR.MINOR.PATCH` (example: `2.1.0`)
	- **Major**: Breaking changes
	- **Minor**: New features and refactors
	- **Patch**: Bug fixes and tests

Rules (sequential, processed oldest → newest):

- `BREAKING CHANGE:` in commit body or subject → +1.0.0 (sets Major += 1; Minor = 0; Patch = 0)
- `feat:` or `refactor:` → +0.1.0 (Minor += 1; Patch = 0)
- `fix:` or `test:` → +0.0.1 (Patch += 1)
- `chore:` and other types → no change

**Commit types and bump mapping**

| Commit Type | Version Bump | Notes |
|-------------|--------------:|-------|
| BREAKING CHANGE (body or subject) | Major | Resets Minor and Patch to 0 |
| feat: | Minor | New features — resets Patch to 0 |
| refactor: | Minor | Behavioral refactors counted as Minor |
| fix: | Patch | Bug fixes |
| test: | Patch | Tests and test fixes |
| Merge (subject starts with "Merge") | Patch | Merge commits increment Patch |
| chore: | No change | Non-functional changes |
| docs: | No change | Documentation-only changes |
| style: | No change | Formatting, linting, no logic change |
| perf: | Patch (recommend Minor when featureful) | Performance improvements; promote to Minor if user-visible feature |
| build: | Patch | Build tooling changes |
| ci: | Patch | CI/config changes |
| revert: | Patch | Reverts treated as Patch unless restoring a breaking change |
| deps: | Patch (recommend Minor when featureful) | Dependency bumps; promote to Minor for new features or API changes |


Processing details:

- Commits are read using `git` and processed from oldest to newest.

The sprint number is managed manually in `package.json` as a separate property (e.g., `"sprint": 5`). The automated versioning only updates the `version` field in the format `MAJOR.MINOR.PATCH`.
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
- The automation commits a bump using the message: `chore: bump version to X.X.X`.
