#!/usr/bin/env node
import { exec as execCb } from "child_process"
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { promisify } from "util"

const exec = promisify(execCb)

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
    return "breaking"
  if (/^feat:/i.test(s)) return "feat"
  if (/^refactor:/i.test(s)) return "refactor"
  if (/^fix:/i.test(s)) return "fix"
  if (/^test:/i.test(s)) return "test"
  if (/^chore:/i.test(s)) return "chore"
  if (/^Merge /i.test(s)) return "merge"
  return "other"
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
      const kind = classifyCommit(subject, body)

      if (kind === "breaking") {
        major = major + 1
        minor = 0
        patch = 0
        console.log(`Applied BREAKING change -> ${major}.${minor}.${patch}`)
        continue
      }

      if (kind === "feat" || kind === "refactor") {
        minor = minor + 1
        patch = 0
        console.log(`Applied ${kind} -> ${major}.${minor}.${patch}`)
        continue
      }

      if (kind === "fix" || kind === "test" || kind === "merge") {
        patch = patch + 1
        console.log(`Applied ${kind} -> ${major}.${minor}.${patch}`)
        continue
      }

      // chores and other types: no version change
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
