#!/usr/bin/env node
import { exec as execCb, execSync } from "child_process"
import { appendFileSync, readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { promisify } from "util"

const exec = promisify(execCb)

// File and tag name constants
const PACKAGE_JSON = "package.json"
const CHANGELOG_FILE = "changelog-commit-history.md"
const VERSION_BUMP_TAG = "chore: bump version to"

// Commit type constants
const COMMIT_BREAKING = "breaking"
const COMMIT_FEAT = "feat"
const COMMIT_REFACTOR = "refactor"
const COMMIT_FIX = "fix"
const COMMIT_TEST = "test"
const COMMIT_CHORE = "chore"
const COMMIT_DOCS = "docs"
const COMMIT_STYLE = "style"
const COMMIT_PERF = "perf"
const COMMIT_BUILD = "build"
const COMMIT_CI = "ci"
const COMMIT_REVERT = "revert"
const COMMIT_DEPS = "deps"
const COMMIT_MERGE = "merge"
const COMMIT_OTHER = "other"

// Classification groups
const MAJOR_TYPES = [COMMIT_BREAKING]
const MINOR_TYPES = [COMMIT_FEAT, COMMIT_REFACTOR]
const PATCH_TYPES = [
  COMMIT_FIX,
  COMMIT_TEST,
  COMMIT_MERGE,
  COMMIT_PERF,
  COMMIT_BUILD,
  COMMIT_CI,
  COMMIT_REVERT,
  COMMIT_DEPS,
]
const NOOP_TYPES = [COMMIT_CHORE, COMMIT_DOCS, COMMIT_STYLE, COMMIT_OTHER]

function getPackageJsonPath() {
  return join(process.cwd(), PACKAGE_JSON)
}

function readPackage() {
  const path = getPackageJsonPath()
  return JSON.parse(readFileSync(path, "utf8"))
}

function calculateNewVersion(entries) {
  let major = 0,
    minor = 0,
    patch = 0
  for (const entry of entries) {
    const lines = entry.split(/\r?\n/)
    const subject = lines[0] || ""
    const body = lines.slice(1).join("\n")
    const commitType = classifyCommit(subject, body)
    if (MAJOR_TYPES.includes(commitType)) {
      major = major + 1
      minor = 0
      patch = 0
      continue
    }
    if (MINOR_TYPES.includes(commitType)) {
      minor = minor + 1
      patch = 0
      continue
    }
    if (PATCH_TYPES.includes(commitType)) {
      patch = patch + 1
      continue
    }
    // NOOP_TYPES -> no version change
  }
  return { major, minor, patch }
}

function writePackageIfChanged(pkg, newVersion) {
  if (pkg.version !== newVersion) {
    pkg.version = newVersion
    writeFileSync(getPackageJsonPath(), JSON.stringify(pkg, null, 2) + "\n")
    return true
  }
  return false
}

function getLastTwoBumpCommits() {
  const bumps = execSync(
    `git log --pretty=format:"%H" --grep="${VERSION_BUMP_TAG}" -n 2`,
  )
    .toString()
    .trim()
    .split("\n")
  return { current: bumps[0], previous: bumps[1] }
}

function getCommitsBetween(from, to) {
  // Only include commits after 'from' and before 'to' (exclude 'to' itself)
  if (from && to) {
    return execSync(
      `git log ${from}..${to}^ --pretty=format:"%h %s" --no-merges`,
    )
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
  } else if (to) {
    return execSync(`git log ${to}^ --pretty=format:"%h %s" --no-merges`)
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
  } else {
    return execSync('git log --pretty=format:"%h %s" --no-merges')
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
  }
}

function appendChangelogBlock(version, commitList) {
  const changelogBlock = [
    `\n---`,
    `## Version ${version} (${new Date().toISOString().slice(0, 10)})`,
    "",
    ...commitList.map((line) => `- ${line}`),
    "",
  ].join("\n")
  appendFileSync(CHANGELOG_FILE, changelogBlock)
}

/**
 * Parse a version string in the format MAJOR.MINOR.PATCH
 * Sprint is not included here; it is managed manually in package.json as a separate property.
 * @param {string} version
 * @returns {{major: number, minor: number, patch: number}}
 */
function parseVersion(version) {
  const parts = String(version)
    .split(".")
    .map((p) => Number(p) || 0)
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
  }
}

function formatVersion3({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`
}

function classifyCommit(subject, body) {
  const s = String(subject || "").trim()
  const b = String(body || "")
  if (/BREAKING CHANGE/i.test(b) || /BREAKING CHANGE/i.test(s))
    return COMMIT_BREAKING
  if (/^feat:/i.test(s)) return COMMIT_FEAT
  if (/^refactor:/i.test(s)) return COMMIT_REFACTOR
  if (/^fix:/i.test(s)) return COMMIT_FIX
  if (/^test:/i.test(s)) return COMMIT_TEST
  if (/^chore:/i.test(s)) return COMMIT_CHORE
  if (/^docs:/i.test(s)) return COMMIT_DOCS
  if (/^style:/i.test(s)) return COMMIT_STYLE
  if (/^perf:/i.test(s)) return COMMIT_PERF
  if (/^build:/i.test(s)) return COMMIT_BUILD
  if (/^ci:/i.test(s)) return COMMIT_CI
  if (/^revert:/i.test(s)) return COMMIT_REVERT
  if (/^deps:/i.test(s)) return COMMIT_DEPS
  if (/^Merge /i.test(s)) return COMMIT_MERGE
  return COMMIT_OTHER
}

async function runCmd(cmd) {
  const { stdout, stderr } = await exec(cmd)
  if (stderr && String(stderr).trim()) {
    // non-fatal: some git commands print warnings to stderr
    // console.error(stderr)
  }
  return String(stdout || "")
}

async function run() {
  try {
    // If the last commit is already a bump, exit fast (prevents duplicate builds)
    const lastCommitMsg = (await runCmd("git log -1 --pretty=%B")).trim()
    if (new RegExp(VERSION_BUMP_TAG, "i").test(lastCommitMsg)) {
      console.log("Last commit is a version bump. Exiting.")
      process.exit(0)
    }

    // Always replay full commit history from the beginning (oldest -> newest)
    // Start counters at 0.0.0 and ignore existing package.json.version as baseline.
    const gitLogCmd =
      "git --no-pager log --reverse --pretty=format:%s%n%b----END---- --all"

    const raw = await runCmd(gitLogCmd)
    const entries = raw
      .split("----END----")
      .map((e) => e.trim())
      .filter(Boolean)

    if (entries.length === 0) {
      console.log("No commits to process. Exiting.")
      process.exit(0)
    }

    const pkg = readPackage()
    // Calculate new version
    const { major, minor, patch } = calculateNewVersion(entries)
    const newVersion = formatVersion3({ major, minor, patch })
    if (!writePackageIfChanged(pkg, newVersion)) {
      console.log(`Version unchanged (${newVersion}). Exiting.`)
      process.exit(0)
    }

    // Update changelog
    const { current, previous } = getLastTwoBumpCommits()
    const commitList = getCommitsBetween(previous, current)
    appendChangelogBlock(newVersion, commitList)

    // Commit and push
    await runCmd(`git add ${PACKAGE_JSON} ${CHANGELOG_FILE}`)
    await runCmd(`git commit -m "${VERSION_BUMP_TAG} ${newVersion}"`)
    await runCmd("git push")

    console.log(`Bumped version to ${newVersion}`)
    process.exit(0)
  } catch (err) {
    console.error("Error running auto-version-bump:", err)
    process.exit(2)
  }
}

run()
