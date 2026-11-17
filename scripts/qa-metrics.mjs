#!/usr/bin/env node
/**
 * QA metrics for pull requests labelled plan-approved.
 * Read-only: lists and reads with gh, and never writes to GitHub.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'docs', 'QA-METRICS.md');
const QA_MARKER = '<!-- fernly-qa-report -->';
const PLAN_REVIEW = /^Plan review:\s*(\d+)\s*\/\s*(\d+)/;
const BOT = 'github-actions[bot]';
const FINISHED = new Set(['success', 'failure', 'timed_out']);

function gh(args) {
  const result = spawnSync('gh', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `gh ${args[0]} failed`).trim());
  }
  return result.stdout;
}

function ghJson(args) {
  const text = gh(args).trim();
  return text ? JSON.parse(text) : [];
}

function ghLines(args) {
  return gh(args)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function minutesBetween(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 60000);
}

function isPerson(comment) {
  return comment.type === 'User' && comment.login !== BOT && !comment.login.endsWith('[bot]');
}

function isQaReport(comment) {
  return (comment.body ?? '').includes(QA_MARKER);
}

function planReview(comments) {
  let match = null;
  for (const comment of comments) {
    if (!isPerson(comment)) {
      continue;
    }
    const found = (comment.body ?? '').trim().match(PLAN_REVIEW);
    if (found) {
      match = { right: Number(found[1]), reviewed: Number(found[2]) };
    }
  }
  return match;
}

function firstComment(comments, pred) {
  return comments.find(pred) ?? null;
}

function linksToPullRequest(body, number) {
  return new RegExp(`/pull/${number}(?!\\d)`).test(body ?? '');
}

function rate(numerator, denominator) {
  if (!denominator) {
    return `${numerator}/${denominator}`;
  }
  const percent = Math.round((100 * numerator) / denominator);
  return `${numerator}/${denominator} (${percent}%)`;
}

function cell(value) {
  return value == null ? '—' : String(value);
}

function escapeCell(text) {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function commentsFor(repo, number) {
  const rows = ghLines([
    'api',
    '--paginate',
    `repos/${repo}/issues/${number}/comments`,
    '--jq',
    '.[] | {login: .user.login, type: .user.type, created: .created_at, body: .body}',
  ]);
  rows.sort((a, b) => new Date(a.created) - new Date(b.created));
  return rows;
}

function agentMinutes(repo, branch) {
  const runs = ghLines([
    'api',
    '--paginate',
    `repos/${repo}/actions/workflows/pr-triage.yml/runs?per_page=100&status=completed&branch=${encodeURIComponent(branch)}`,
    '--jq',
    '.workflow_runs[] | {conclusion, started: .run_started_at, updated: .updated_at, branch: .head_branch}',
  ]);
  let ms = 0;
  for (const run of runs) {
    if (run.branch !== branch || !FINISHED.has(run.conclusion) || !run.started || !run.updated) {
      continue;
    }
    const delta = new Date(run.updated) - new Date(run.started);
    if (delta > 0) {
      ms += delta;
    }
  }
  return Math.round(ms / 60000);
}

function findingsFor(issues, number) {
  const linked = issues.filter((issue) => linksToPullRequest(issue.body, number));
  const falseAlarms = linked.filter(
    (issue) => issue.state === 'CLOSED' && issue.stateReason === 'NOT_PLANNED',
  ).length;
  return { findings: linked.length, falseAlarms };
}

function loadFindings(repo) {
  try {
    return ghJson([
      'issue',
      'list',
      '--repo',
      repo,
      '--label',
      'qa-finding',
      '--state',
      'all',
      '--limit',
      '200',
      '--json',
      'number,state,stateReason,body',
    ]);
  } catch (error) {
    if (/disabled issues/i.test(error.message)) {
      return [];
    }
    throw error;
  }
}

function measure(repo) {
  const pulls = ghJson([
    'pr',
    'list',
    '--repo',
    repo,
    '--label',
    'plan-approved',
    '--state',
    'all',
    '--limit',
    '200',
    '--json',
    'number,title,url,createdAt,headRefName',
  ]);
  pulls.sort((a, b) => a.number - b.number);
  const issues = loadFindings(repo);
  return pulls.map((pull) => {
    const comments = commentsFor(repo, pull.number);
    const review = planReview(comments);
    const plan = firstComment(comments, (comment) => comment.login === BOT && !isQaReport(comment));
    const report = firstComment(comments, isQaReport);
    const finding = findingsFor(issues, pull.number);
    return {
      number: pull.number,
      title: pull.title?.trim() || `Pull request #${pull.number}`,
      url: pull.url,
      rowsRight: review?.right ?? null,
      rowsReviewed: review?.reviewed ?? null,
      planMinutes: plan ? minutesBetween(pull.createdAt, plan.created) : null,
      reportMinutes: report ? minutesBetween(pull.createdAt, report.created) : null,
      agentMinutes: agentMinutes(repo, pull.headRefName),
      findings: finding.findings,
      falseAlarms: finding.falseAlarms,
    };
  });
}

function render(repo, rows) {
  const rowsRight = rows.reduce((sum, row) => sum + (row.rowsRight ?? 0), 0);
  const rowsReviewed = rows.reduce((sum, row) => sum + (row.rowsReviewed ?? 0), 0);
  const findings = rows.reduce((sum, row) => sum + row.findings, 0);
  const falseAlarms = rows.reduce((sum, row) => sum + row.falseAlarms, 0);
  const lines = [
    '# QA metrics',
    '',
    `Routing accuracy ${rate(rowsRight, rowsReviewed)}. False-alarm rate ${rate(falseAlarms, findings)}.`,
    '',
    '| Pull request | Rows right | Rows reviewed | Minutes to plan | Minutes to QA report | Agent minutes | Findings | False alarms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const row of rows) {
    const title = escapeCell(row.title);
    lines.push(
      `| [#${row.number} ${title}](${row.url}) | ${cell(row.rowsRight)} | ${cell(row.rowsReviewed)} | ${cell(row.planMinutes)} | ${cell(row.reportMinutes)} | ${row.agentMinutes} | ${row.findings} | ${row.falseAlarms} |`,
    );
  }
  if (!rows.length) {
    lines.push('| — | — | — | — | — | — | — | — |');
  }
  lines.push(
    '',
    '## How each number is measured',
    '',
    `These numbers are for every pull request labelled \`plan-approved\` in \`${repo}\`. The script only lists and reads with \`gh\`.`,
    '',
    '**Routing accuracy** is rows right divided by rows reviewed. Both come from the last comment by a person whose text starts with `Plan review: N/M`: N is rows right, M is rows reviewed. The totals add N and M across those pull requests. A bot comment does not count.',
    '',
    '**Minutes to plan** is the time from opening the pull request to the first comment by `github-actions[bot]` that is not the QA report, rounded to the nearest minute.',
    '',
    '**Minutes to QA report** is the time from opening the pull request to the first comment that contains `<!-- fernly-qa-report -->`, rounded to the nearest minute.',
    '',
    '**Agent minutes** is the total time of the finished `pr-triage` runs for that pull request\'s branch. A run is finished when it completed with success, failure, or a timeout. Cancelled runs, and runs that stopped to wait for approval, are left out. Time runs from when the run started to when it finished, and the total is rounded to the nearest minute.',
    '',
    '**Findings** are issues labelled `qa-finding` whose body links to the pull request (`/pull/<number>`). **False alarms** are those findings closed as not planned. The false-alarm rate is false alarms divided by findings.',
    '',
    '**Money** is not in GitHub. Agent spend is on the [Cursor dashboard](https://cursor.com/dashboard).',
    '',
    'Regenerate this file with `node scripts/qa-metrics.mjs`.',
    '',
  );
  return lines.join('\n');
}

const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
const markdown = render(repo, measure(repo));
writeFileSync(OUT, markdown, 'utf8');
process.stdout.write(`Wrote ${path.relative(ROOT, OUT).replace(/\\/g, '/')}\n`);
