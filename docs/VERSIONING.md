# 🚀 Automatic Versioning System

This project has an intelligent automatic versioning system that updates the `package.json` version whenever a PR is merged into the `main` branch, using **Semantic Release**.

## 📋 Version Format

The version follows a 4-part format: `{sprint}.{major}.{minor}.{patch}`

- **Sprint**: Incremented at the start of each sprint (manual)
- **Major**: Breaking changes
- **Minor**: New features
- **Patch**: Bug fixes and small improvements

**Example**: `5.2.1.0` = Sprint 5, Major 2, Minor 1, Patch 0

## 📋 How It Works

### Automatic (Recommended)
- **When**: Whenever a PR is merged into the `main` branch
- **What happens**: 
  - Analyzes commits to determine version type (major/minor/patch)
  - Automatically increments version based on commit conventions
  - Generates automatic changelog
  - Creates GitHub release with detailed notes
  - Version in `EditProfile` component is automatically updated

### Manual (When needed)
You can also manually bump the version using the scripts:

```bash
# Increment sprint version (5.2.1.0 → 6.0.0.0)
pnpm version:sprint

# Increment major version (5.2.1.0 → 5.3.0.0)
pnpm version:major

# Increment minor version (5.2.1.0 → 5.2.2.0)
pnpm version:minor

# Increment patch version (5.2.1.0 → 5.2.1.1)
pnpm version:patch

# Check current version
pnpm version:check
```

## 🔧 Configuration

### Active Workflow

**Semantic Release** (`.github/workflows/version-bump.yml`)
- ✅ Analyzes commits to determine version type
- ✅ Uses commit conventions (feat:, fix:, BREAKING CHANGE:)
- ✅ Generates automatic changelog
- ✅ Creates releases with detailed notes
- ✅ Industry standard for professional projects

### Commit Conventions

- `feat:` → Minor version bump (5.2.1.0 → 5.2.2.0)
- `fix:` → Patch version bump (5.2.1.0 → 5.2.1.1)
- `BREAKING CHANGE:` → Major version bump (5.2.1.0 → 5.3.0.0)
- `chore:`, `docs:`, `style:` → Patch version bump
- `perf:`, `refactor:` → Patch version bump

**Examples:**
```bash
# New feature (minor)
git commit -m "feat: add new dashboard feature"

# Bug fix (patch)
git commit -m "fix: resolve login issue"

# Breaking change (major)
git commit -m "feat: add new API endpoint

BREAKING CHANGE: API response format changed"

# Performance improvement (patch)
git commit -m "perf: optimize database queries"

# Refactoring (patch)
git commit -m "refactor: improve code structure"

# New sprint (manual - use pnpm version:sprint)
pnpm version:sprint
```

## 🎯 Version Display

The version is automatically displayed in the `EditProfile` component through the `src/config/version.ts` file that imports directly from `package.json`.

## 🚨 Important

- **Branch**: Automatic versioning only works on the `main` branch
- **Permissions**: Make sure `GH_TOKEN` has `contents: write` permissions
- **Commits**: Use correct conventions for semantic-release to work
- **Changelog**: The `CHANGELOG.md` file is generated automatically
- **Sprint**: Sprint is incremented manually at the start of each sprint using `pnpm version:sprint`

## 🔍 Troubleshooting

### Workflow doesn't execute
- ✅ Check if you're on the `main` branch
- ✅ Confirm `GH_TOKEN` has necessary permissions
- ✅ Check GitHub Actions logs
- ✅ Make sure commits follow the conventions

### Version doesn't increment
- ✅ Check if commits have correct prefixes (`feat:`, `fix:`, etc.)
- ✅ For breaking changes, use `BREAKING CHANGE:` in commit body
- ✅ Commits without prefix don't generate new version

### Version doesn't update in interface
- ✅ Run `pnpm build` to ensure changes are applied
- ✅ Check if `src/config/version.ts` is importing correctly

### Version conflicts
- ✅ If there are conflicts, resolve manually and push
- ✅ Use `pnpm version:patch` to increment manually when needed
