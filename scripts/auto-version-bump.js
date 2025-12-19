#!/usr/bin/env node
import { exec as execCb } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { promisify } from "util"

const exec = promisify(execCb)

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
  return join(process.cwd(), "package.json")
}

function readPackage() {
  const path = getPackageJsonPath()
  return JSON.parse(readFileSync(path, "utf8"))
}

function writePackage(pkg) {
  const path = getPackageJsonPath()
  writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n")
}

function parseVersion(version) {
  const parts = String(version)
    .split(".")
    .map((p) => Number(p) || 0)
  return {
    sprint: parts[0] ?? 0,
    major: parts[1] ?? 0,
    minor: parts[2] ?? 0,
    patch: parts[3] ?? 0,
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
    if (/chore: bump version to/i.test(lastCommitMsg)) {
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
    // Keep sprint untouched; start counters at 0.0.0
    let major = 0
    let minor = 0
    let patch = 0

    // Apply commits sequentially
    for (const entry of entries) {
      const lines = entry.split(/\r?\n/)
      const subject = lines[0] || ""
      const body = lines.slice(1).join("\n")
      const commitType = classifyCommit(subject, body)

      if (MAJOR_TYPES.includes(commitType)) {
        // Major bump: increment major, reset minor & patch
        major = major + 1
        minor = 0
        patch = 0
        console.log(
          `Applied MAJOR (${commitType}) -> ${major}.${minor}.${patch}`,
        )
        continue
      }

      if (MINOR_TYPES.includes(commitType)) {
        // Minor bump: increment minor, reset patch
        minor = minor + 1
        patch = 0
        console.log(
          `Applied MINOR (${commitType}) -> ${major}.${minor}.${patch}`,
        )
        continue
      }

      if (PATCH_TYPES.includes(commitType)) {
        // Patch bump: increment patch
        patch = patch + 1
        console.log(
          `Applied PATCH (${commitType}) -> ${major}.${minor}.${patch}`,
        )
        continue
      }

      // NOOP_TYPES -> no version change
    }

    const newVersion = formatVersion3({ major, minor, patch })
    if (newVersion === pkg.version) {
      console.log(`Version unchanged (${newVersion}). Exiting.`)
      process.exit(0)
    }

    // Update package.json
    pkg.version = newVersion
    writePackage(pkg)

    // Commit and push
    await runCmd("git add package.json")
    await runCmd(`git commit -m "chore: bump version to ${newVersion}"`)
    await runCmd("git push")

    console.log(`Bumped version to ${newVersion}`)
    process.exit(0)
  } catch (err) {
    console.error("Error running auto-version-bump:", err)
    process.exit(2)
  }
}

run()
