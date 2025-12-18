#!/usr/bin/env node

/**
 * Semantic Release Plugin to handle duplicate tags
 * - If a tag already exists, it adds a suffix (.1, .2, etc.)
 *
 * Version format: {sprint}.{major}.{minor}.{patch}
 * The version is already in the correct format in package.json
 */

import { exec as execCallback } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { promisify } from "util"

const exec = promisify(execCallback)

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

// Store calculated version between hooks (semantic-release resets nextRelease)
/** @type {string | null} */
let calculatedVersion = null
/** @type {string | null} */
let calculatedTag = null

/**
 * Get the current version from package.json
 * @returns {string} The version
 */
function getPackageVersion() {
  try {
    const packageJsonPath = join(process.cwd(), "package.json")
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    return packageJson.version || "0.0.0.0"
  } catch {
    return "0.0.0.0"
  }
}

/**
 * Parse 4-part version into components
 * @param {string} version - Version string (e.g., "5.2.2.0")
 * @returns {{sprint: number, major: number, minor: number, patch: number}}
 */
function parseVersion(version) {
  const parts = version.split(".").map(Number)
  return {
    sprint: parts[0] ?? 0,
    major: parts[1] ?? 0,
    minor: parts[2] ?? 0,
    patch: parts[3] ?? 0,
  }
}

/**
 * Increment version based on release type
 * @param {string} currentVersion - Current version (e.g., "5.2.2.0")
 * @param {string} releaseType - Release type (major, minor, patch)
 * @returns {string} New version
 */
function incrementVersion(currentVersion, releaseType) {
  const { sprint, major, minor, patch } = parseVersion(currentVersion)

  switch (releaseType) {
    case "major":
      return `${sprint}.${major + 1}.0.0`
    case "minor":
      return `${sprint}.${major}.${minor + 1}.0`
    case "patch":
    default:
      return `${sprint}.${major}.${minor}.${patch + 1}`
  }
}

/**
 * Check if a git tag exists (local or remote)
 * @param {string} tag - The tag to check
 * @returns {Promise<boolean>}
 */
async function tagExists(tag) {
  try {
    // Check local tags
    const { stdout: localTags } = await exec("git tag -l")
    const tags = String(localTags).split("\n")
    if (tags.includes(tag)) {
      return true
    }

    // Check remote tags
    const { stdout: remoteTags } = await exec("git ls-remote --tags origin")
    if (String(remoteTags).includes(`refs/tags/${tag}`)) {
      return true
    }

    return false
  } catch {
    return false
  }
}

/**
 * Find next available tag by adding suffix
 * @param {string} baseTag - The base tag to check
 * @param {(msg: string) => void} log - Logger function
 * @returns {Promise<{tag: string, suffix: number}>}
 */
async function findAvailableTag(baseTag, log) {
  let tag = baseTag
  let suffix = 0

  log(`🔍 Checking if tag ${baseTag} exists...`)

  while (await tagExists(tag)) {
    suffix++
    tag = `${baseTag}.${suffix}`
    log(`   Tag exists, trying ${tag}...`)
  }

  if (suffix > 0) {
    log(`✅ Found available tag: ${tag}`)
  }

  return { tag, suffix }
}

/**
 * verifyRelease hook - Calculate and validate the new version
 * Uses the release type determined by @semantic-release/commit-analyzer
 */
// @ts-expect-error - pluginConfig is not used
async function verifyRelease(_pluginConfig, context) {
  const { logger, nextRelease } = context
  const log = logger.log.bind(logger)

  // Get current version from package.json
  const currentVersion = getPackageVersion()
  log(`📦 Current version from package.json: ${currentVersion}`)
  log(`📦 Semantic-release calculated version: ${nextRelease.version}`)

  // Calculate new version based on release type using OUR 4-part format
  const releaseType = String(nextRelease.type ?? "patch")
  const newVersion = incrementVersion(currentVersion, releaseType)
  log(`🆕 New 4-part version: ${newVersion}`)

  // Check for duplicate tags
  const baseTag = `v${newVersion}`
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const { tag: availableTag, suffix } = await findAvailableTag(baseTag, log)

  if (suffix > 0) {
    log(`⚠️  Tag ${baseTag} already exists. Using ${availableTag} instead.`)
  }

  // Store the final version in module-level variables (semantic-release resets nextRelease)
  calculatedVersion = availableTag.replace(/^v/, "")
  calculatedTag = availableTag

  log(`✅ Stored version for prepare phase: ${calculatedVersion}`)
  log(`✅ Stored tag for prepare phase: ${calculatedTag}`)
}

/**
 * prepare hook - Update package.json with new version
 */
// @ts-expect-error - pluginConfig is not used
async function prepare(_pluginConfig, context) {
  const { logger, nextRelease } = context

  // Use our calculated version, not semantic-release's version
  const versionToUse = calculatedVersion ?? nextRelease.version
  const tagToUse = calculatedTag ?? `v${nextRelease.version}`

  logger.log(
    `🔄 Prepare phase - semantic-release version: ${nextRelease.version}`,
  )
  logger.log(`🔄 Prepare phase - our calculated version: ${versionToUse}`)

  // Update package.json with our 4-part version
  const packageJsonPath = join(process.cwd(), "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
  packageJson.version = versionToUse

  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")

  // Also update nextRelease so git plugin uses correct tag
  nextRelease.version = versionToUse
  nextRelease.gitTag = tagToUse
  nextRelease.name = tagToUse

  logger.log(`✅ Updated package.json version to: ${versionToUse}`)
  logger.log(`✅ Updated nextRelease.gitTag to: ${tagToUse}`)
}

const plugin = { verifyRelease, prepare }
export default plugin
