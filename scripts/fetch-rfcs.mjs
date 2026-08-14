#!/usr/bin/env node
/**
 * Build-time RFC crawler.
 *
 * Queries the public GitHub API for issues whose title contains "(RFC)"
 * across the WAF2p/pass, WAF2p/wafpass-server and WAF2p/wafpass-dashboard
 * repositories, fetches comments and unique commenters, and writes a static
 * JSON file consumed by the RFC dashboard page.
 *
 * Run with:
 *   node scripts/fetch-rfcs.mjs
 *
 * For private repositories, set GITHUB_TOKEN in the environment.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const REPOS = [
  { owner: 'WAF2p', repo: 'pass', name: 'pass' },
  { owner: 'WAF2p', repo: 'wafpass-server', name: 'wafpass-server' },
  { owner: 'WAF2p', repo: 'wafpass-dashboard', name: 'wafpass-dashboard' },
]

const OUTPUT = path.resolve(process.cwd(), 'src/data/rfcs.json')
const RFC_TITLE_RE = /\(RFC\)/i

async function ghFetch(url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${res.statusText} (${url})`)
  }
  return res.json()
}

function isPullRequest(issue) {
  return !!issue.pull_request
}

function normalizeIssue(issue, repoName, repoFullName) {
  return {
    id: `${repoName}#${issue.number}`,
    repo: repoName,
    repoFullName,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    isPullRequest: isPullRequest(issue),
    labels: (issue.labels || []).map(l => ({
      name: typeof l === 'string' ? l : l.name,
      color: typeof l === 'string' ? '666666' : l.color,
    })),
    author: {
      login: issue.user?.login ?? 'unknown',
      avatarUrl: issue.user?.avatar_url ?? '',
      url: issue.user?.html_url ?? '',
    },
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    body: issue.body ?? '',
    comments: [],
    commenters: [],
  }
}

async function fetchComments(issue, repoFullName) {
  if (!issue.comments) return []
  const comments = await ghFetch(
    `https://api.github.com/repos/${repoFullName}/issues/${issue.number}/comments?per_page=100`,
  )
  return comments.map(c => ({
    id: c.id,
    author: {
      login: c.user?.login ?? 'unknown',
      avatarUrl: c.user?.avatar_url ?? '',
      url: c.user?.html_url ?? '',
    },
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    body: c.body ?? '',
  }))
}

async function fetchRfcsForRepo({ owner, repo, name }) {
  const repoFullName = `${owner}/${repo}`

  // First, try the label-based search.
  let issues = []
  try {
    issues = await ghFetch(
      `https://api.github.com/repos/${repoFullName}/issues?state=all&labels=rfc&per_page=100`,
    )
  } catch (err) {
    if (process.env.DEBUG) {
      console.warn(`[warn] Could not fetch RFC-labeled issues for ${repoFullName}: ${err.message}`)
    }
  }

  // Fallback / supplement: search for "(RFC)" in the title across all issues/PRs.
  let searchHits = []
  try {
    const search = await ghFetch(
      `https://api.github.com/search/issues?q=repo:${repoFullName}+RFC+in:title&type=issues&per_page=100`,
    )
    searchHits = search.items || []
  } catch (err) {
    if (process.env.DEBUG) {
      console.warn(`[warn] Could not search RFC titles for ${repoFullName}: ${err.message}`)
    }
  }

  // Merge and deduplicate by number.
  const byNumber = new Map()
  for (const issue of issues) {
    byNumber.set(issue.number, issue)
  }
  for (const issue of searchHits) {
    if (!byNumber.has(issue.number)) {
      byNumber.set(issue.number, issue)
    }
  }

  // Keep only items that look like RFCs.
  const candidates = Array.from(byNumber.values()).filter(
    i => RFC_TITLE_RE.test(i.title) || (i.labels || []).some(l => (typeof l === 'string' ? l : l.name).toLowerCase() === 'rfc'),
  )

  const rfcs = []
  for (const issue of candidates) {
    const rfc = normalizeIssue(issue, name, repoFullName)
    const comments = await fetchComments(issue, repoFullName)
    rfc.comments = comments

    const seen = new Map()
    for (const c of comments) {
      if (!seen.has(c.author.login)) {
        seen.set(c.author.login, c.author)
      }
    }
    rfc.commenters = Array.from(seen.values())

    rfcs.push(rfc)
  }

  return rfcs
}

async function main() {
  const allRfcs = []
  for (const repo of REPOS) {
    const rfcs = await fetchRfcsForRepo(repo)
    if (process.env.DEBUG) {
      console.log(`[debug] ${repo.repoFullName}: ${rfcs.length} RFC(s)`)
    }
    allRfcs.push(...rfcs)
  }

  allRfcs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const openCount = allRfcs.filter(r => r.state === 'open').length
  const closedCount = allRfcs.filter(r => r.state === 'closed').length

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'https://api.github.com',
    repos: REPOS.map(r => `${r.owner}/${r.repo}`),
    total: allRfcs.length,
    open: openCount,
    closed: closedCount,
    rfcs: allRfcs,
  }

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n')
  console.log(`Wrote ${allRfcs.length} RFC(s) (${openCount} open, ${closedCount} closed) to ${OUTPUT}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
