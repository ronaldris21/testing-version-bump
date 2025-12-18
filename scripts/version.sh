#!/bin/bash

# Script to bump the version - local use only
# Version format: {sprint}.{major}.{minor}.{patch}
# Usage: ./scripts/version.sh [sprint|major|minor|patch]

set -e

VERSION_TYPE=${1:-patch}
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 Bumping $VERSION_TYPE version..."

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them first."
    exit 1
fi

# Pull the latest changes
echo "📥 Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Get current version parts
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: $CURRENT_VERSION"

# Parse version parts (sprint.major.minor.patch)
IFS='.' read -r SPRINT MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Handle missing parts (default to 0)
SPRINT=${SPRINT:-0}
MAJOR=${MAJOR:-0}
MINOR=${MINOR:-0}
PATCH=${PATCH:-0}

# Bump the appropriate part
case $VERSION_TYPE in
    sprint)
        SPRINT=$((SPRINT + 1))
        MAJOR=0
        MINOR=0
        PATCH=0
        ;;
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "❌ Error: Invalid version type. Use: sprint, major, minor, or patch"
        exit 1
        ;;
esac

# Build new version
NEW_VERSION="${SPRINT}.${MAJOR}.${MINOR}.${PATCH}"
echo "✅ New version: $NEW_VERSION"

# Update package.json
node -e "
const fs = require('fs');
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Function to get next available tag
get_next_available_tag() {
    local version=$1
    local tag_name="v${version}"
    local suffix=0
    
    # Check if base tag exists
    if git tag -l "$tag_name" | grep -q "^$tag_name$"; then
        # Tag exists, find next available suffix
        suffix=1
        while git tag -l "${tag_name}.${suffix}" | grep -q "^${tag_name}.${suffix}$"; do
            ((suffix++))
        done
        echo "${version}.${suffix}"
    else
        echo "${version}"
    fi
}

# Get the final version (with suffix if needed)
FINAL_VERSION=$(get_next_available_tag "$NEW_VERSION")
FINAL_TAG="v$FINAL_VERSION"

if [ "$FINAL_VERSION" != "$NEW_VERSION" ]; then
    echo "⚠️  Tag v${NEW_VERSION} already exists, using $FINAL_TAG instead"
fi

# Commit and push
echo "💾 Committing changes..."
git add package.json
git commit -m "chore(release): bump version to $NEW_VERSION"

# Create and push tag
echo "🏷️ Creating tag $FINAL_TAG..."
git tag -a "$FINAL_TAG" -m "Release $FINAL_TAG"

echo "📤 Pushing changes and tag..."
git push origin $CURRENT_BRANCH
git push origin "$FINAL_TAG"

echo "🎉 Version $NEW_VERSION successfully bumped!"
echo "📋 Tag $FINAL_TAG created and pushed!"
