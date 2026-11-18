#!/usr/bin/env node
/**
 * Fernly QA report — build from CI artifacts, publish to the PR (no AI).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'qa-report');
const MARKER = '<!-- fernly-qa-report -->';
const FINDING_KEY = '<!-- qa-finding-key:';
const FINDING_LABEL = 'qa-finding';
const ANSI = /\x1b\[[0-9;]*m/g;

function readText(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf8');
}

function stripAnsi(text) {
  return text.replace(ANSI, '');
}

function stripCdata(text) {
  return (text ?? '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function firstLine(text) {
  const clean = stripAnsi(stripCdata(text)).trim();
  const line = clean.split(/\r?\n/).find((l) => l.trim()) ?? '';
  return line.trim();
}

function relPath(filePath) {
  if (!filePath) {
    return '';
  }
  if (path.isAbsolute(filePath)) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
  }
  return filePath.replace(/\\/g, '/');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** FINDINGS.md entries: ### F-NN: <title> plus bullet fields under ## Findings. */
function parseFindings(md) {
  if (!md) {
    return [];
  }
  const start = md.indexOf('## Findings');
  if (start < 0) {
    return [];
  }
  const end = md.indexOf('## Suspicions', start);
  const section = end >= 0 ? md.slice(start, end) : md.slice(start);
  const findings = [];
  const parts = section.split(/^### /m).slice(1);
  for (const part of parts) {
    const lines = part.trim().split(/\r?\n/);
    const heading = lines[0]?.trim() ?? '';
    const match = heading.match(/^F-\d+:\s*(.+)$/);
    if (!match) {
      continue;
    }
    const id = heading.match(/^(F-\d+)/)?.[1] ?? '';
    const title = match[1].trim();
    findings.push({
      id,
      title,
      heading: `### ${heading}`,
      body: `### ${part.trim()}`,
    });
  }
  return findings;
}

function loadBaseFindings(baseRef) {
  const ref = baseRef || 'main';
  const result = spawnSync('git', ['show', `origin/${ref}:FINDINGS.md`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !result.stdout) {
    return [];
  }
  return parseFindings(result.stdout);
}

function emptySuite(name) {
  return {
    name,
    passed: 0,
    failed: 0,
    knownBugs: 0,
    skipped: 0,
    status: 'not run',
    failures: [],
  };
}

function findingAnnotation(annotations = []) {
  for (const ann of annotations) {
    const text = `${ann.type ?? ''} ${ann.description ?? ''}`;
    if (/F-\d+:/.test(text)) {
      return ann.description ?? text;
    }
  }
  return null;
}

function walkPlaywrightSuites(suites, visitor) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) {
      visitor(spec, suite);
    }
    walkPlaywrightSuites(suite.suites, visitor);
  }
}

function parsePlaywright(jsonText) {
  if (!jsonText) {
    return { status: 'not run', projects: new Map(), visualFailures: [], knownBugTests: [] };
  }
  const report = JSON.parse(jsonText);
  const projectNames =
    report.config?.projects?.map((p) => p.name).filter((n) => n !== undefined) ?? [];
  const byProject = new Map(projectNames.map((name) => [name, emptySuite(`Playwright ${name}`)]));
  const visualFailures = [];
  const knownBugTests = [];

  walkPlaywrightSuites(report.suites, (spec) => {
    for (const test of spec.tests ?? []) {
      const project = test.projectName ?? 'unknown';
      if (!byProject.has(project)) {
        byProject.set(project, emptySuite(`Playwright ${project}`));
      }
      const bucket = byProject.get(project);
      bucket.status = 'run';
      const result = test.results?.at(-1);
      const annotations = [...(test.annotations ?? []), ...(result?.annotations ?? [])];
      const failNote = findingAnnotation(annotations);
      const status = result?.status ?? 'skipped';
      const isKnown =
        Boolean(failNote) ||
        test.expectedStatus === 'failed' ||
        test.status === 'expected' ||
        (test.status === 'flaky' && failNote);

      if (status === 'skipped' || status === 'interrupted') {
        bucket.skipped += 1;
        continue;
      }

      if (status === 'passed') {
        bucket.passed += 1;
        continue;
      }

      const file = relPath(spec.file ?? result?.errorLocation?.file);
      const line = spec.line ?? result?.errorLocation?.line ?? '?';
      const errMsg = firstLine(result?.error?.message ?? result?.errors?.[0]?.message ?? 'failed');
      const entry = {
        title: spec.title,
        location: `${file}:${line}`,
        error: errMsg,
        project,
      };

      if (isKnown && status === 'failed') {
        bucket.knownBugs += 1;
        knownBugTests.push({
          ...entry,
          finding: failNote ?? 'known bug (test.fail)',
        });
        continue;
      }

      bucket.failed += 1;
      bucket.failures.push(entry);

      if (project === 'visual') {
        visualFailures.push({
          ...entry,
          note: 'Compare expected vs actual in the playwright-report artifact (visual snapshots).',
        });
      }
    }
  });

  return { status: 'run', projects: byProject, visualFailures, knownBugTests };
}

function decodeXml(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

function parseCypressJunit(dir) {
  const suites = {
    component: emptySuite('Cypress component'),
    ui: emptySuite('Cypress UI'),
  };
  if (!existsSync(dir)) {
    return suites;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.xml'));
  if (!files.length) {
    return suites;
  }
  for (const file of files) {
    const kind = file.startsWith('ui-')
      ? 'ui'
      : file.startsWith('component-')
        ? 'component'
        : file.includes('ui')
          ? 'ui'
          : 'component';
    const bucket = suites[kind];
    bucket.status = 'run';
    const xml = readFileSync(path.join(dir, file), 'utf8');
    const suiteMatches = [...xml.matchAll(/<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g)];
    for (const [, attrs, body] of suiteMatches) {
      const tests = Number(attrs.match(/tests="(\d+)"/)?.[1] ?? 0);
      const failures = Number(attrs.match(/failures="(\d+)"/)?.[1] ?? 0);
      const skipped = Number(attrs.match(/skipped="(\d+)"/)?.[1] ?? 0);
      const fileAttr = attrs.match(/file="([^"]*)"/)?.[1] ?? '';
      const specFile = fileAttr ? `web/${fileAttr.replace(/\\/g, '/')}` : '';
      if (tests === 0 && !body.includes('<testcase')) {
        continue;
      }
      bucket.passed += Math.max(0, tests - failures - skipped);
      bucket.failed += failures;
      bucket.skipped += skipped;
      for (const [, caseAttrs, caseBody] of body.matchAll(/<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g)) {
        const name = caseAttrs.match(/name="([^"]*)"/)?.[1] ?? 'test';
        const failure = caseBody.match(/<failure\b[^>]*>([\s\S]*?)<\/failure>/);
        if (!failure) {
          continue;
        }
        bucket.failures.push({
          title: decodeXml(name),
          location: specFile || `web/cypress/results/${file}`,
          error: firstLine(decodeXml(failure[1])),
          project: kind,
        });
      }
    }
  }
  return suites;
}

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function buildRunLinks() {
  const repo = env('GITHUB_REPOSITORY');
  const server = env('GITHUB_SERVER_URL', 'https://github.com');
  const runId = env('GITHUB_RUN_ID');
  const pr = env('PR_NUMBER');
  const runUrl = repo && runId ? `${server}/${repo}/actions/runs/${runId}` : '';
  const prUrl = repo && pr ? `${server}/${repo}/pull/${pr}` : '';
  return { runUrl, prUrl, repo, server, pr, sha: env('GITHUB_SHA'), runId };
}

function build() {
  const baseRef = env('BASE_REF', 'init');
  const links = buildRunLinks();
  const pw = parsePlaywright(readText(path.join(ROOT, 'reports/playwright.json')));
  const cy = parseCypressJunit(path.join(ROOT, 'web/cypress/results'));
  const a11y = readText(path.join(ROOT, 'a11y-report/summary.md'));
  const findingsMd = readText(path.join(ROOT, 'FINDINGS.md')) ?? '';
  const findings = parseFindings(findingsMd);
  const baseFindings = loadBaseFindings(baseRef);
  const baseTitles = new Set(baseFindings.map((f) => f.title));
  const newFindings = findings.filter((f) => !baseTitles.has(f.title));

  const suiteRows = [
    cy.component,
    cy.ui,
    ...[...pw.projects.values()].sort((a, b) => a.name.localeCompare(b.name)),
  ];

  const failedAll = suiteRows.flatMap((s) => s.failures);
  const totals = {
    suites: suiteRows.length,
    passed: suiteRows.reduce((n, s) => n + s.passed, 0),
    failed: suiteRows.reduce((n, s) => n + s.failed, 0),
    knownBugs: suiteRows.reduce((n, s) => n + s.knownBugs, 0),
    skipped: suiteRows.reduce((n, s) => n + s.skipped, 0),
    visualChanges: pw.visualFailures.length,
    findings: findings.length,
    newFindings: newFindings.length,
  };

  const lines = [MARKER, '', '# Fernly QA report', ''];
  if (links.runUrl) {
    lines.push(`[Workflow run](${links.runUrl})${links.prUrl ? ` · [Pull request #${links.pr}](${links.prUrl})` : ''}`, '');
  }

  lines.push('## Suites', '', '| Suite | Passed | Failed | Known bugs | Skipped |', '| --- | ---: | ---: | ---: | ---: |');
  for (const row of suiteRows) {
    const label = row.status === 'not run' ? `${row.name} _(not run)_` : row.name;
    lines.push(
      `| ${label} | ${row.passed} | ${row.failed} | ${row.knownBugs} | ${row.skipped} |`,
    );
  }
  lines.push('');

  if (failedAll.length) {
    lines.push('## Failed tests', '');
    for (const f of failedAll) {
      lines.push(`- **${f.title}** — \`${f.location}\``);
      lines.push(`  - ${f.error}`);
    }
    lines.push('');
  }

  if (pw.visualFailures.length) {
    lines.push('## Visual regressions', '');
    lines.push(
      'A person decides for each failure: **defect**, **intended UI change**, or **noise**.',
      'Use the **playwright-report** artifact for expected vs actual images.',
      '',
    );
    for (const f of pw.visualFailures) {
      lines.push(`- **${f.title}** — \`${f.location}\``);
      lines.push(`  - ${f.error}`);
    }
    lines.push('');
  }

  if (pw.knownBugTests.length) {
    lines.push('## Known bugs (expected failures)', '');
    for (const k of pw.knownBugTests) {
      lines.push(`- **${k.title}** — \`${k.location}\` — ${k.finding}`);
    }
    lines.push('');
  }

  if (newFindings.length) {
    lines.push('## New findings', '');
    for (const f of newFindings) {
      lines.push(f.heading, '');
    }
    lines.push('');
  }

  lines.push('<details>', '<summary>Accessibility summary</summary>', '');
  lines.push(a11y?.trim() ? a11y.trim() : '_Accessibility suite not run (a11y-report/summary.md missing)._');
  lines.push('', '</details>', '');

  const commentMd = `${lines.join('\n')}\n`;

  const issues = newFindings.map((f) => {
    const key = slugify(f.title);
    const footer = [
      '',
      '---',
      links.prUrl ? `Pull request: ${links.prUrl}` : '',
      links.runUrl ? `Workflow run: ${links.runUrl}` : '',
      `${FINDING_KEY} ${key} -->`,
    ]
      .filter(Boolean)
      .join('\n');
    return {
      key,
      title: `QA finding: ${f.title}`,
      body: `${f.body}\n${footer}`,
    };
  });

  const runJson = {
    sha: links.sha,
    pr: links.pr ? Number(links.pr) : null,
    runUrl: links.runUrl,
    time: new Date().toISOString(),
    totals,
    suites: suiteRows.map((s) => ({
      name: s.name,
      passed: s.passed,
      failed: s.failed,
      knownBugs: s.knownBugs,
      skipped: s.skipped,
      status: s.status,
    })),
    failed: failedAll,
    knownBugs: pw.knownBugTests,
    visualChanges: pw.visualFailures,
    findings: findings.map((f) => f.title),
    newFindings: newFindings.map((f) => f.title),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'comment.md'), commentMd, 'utf8');
  writeFileSync(path.join(OUT_DIR, 'issues.json'), `${JSON.stringify(issues, null, 2)}\n`, 'utf8');
  writeFileSync(path.join(OUT_DIR, 'run.json'), `${JSON.stringify(runJson, null, 2)}\n`, 'utf8');

  process.stdout.write(`Wrote qa-report/ (${issues.length} new finding issue(s))\n`);
}

function ghArgs(args) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8' });
  return result;
}

function parseRepo(repository) {
  const [owner, repo] = repository.split('/');
  return { owner, repo };
}

function extractFindingKeys(body) {
  const keys = [];
  const re = /<!-- qa-finding-key:\s*([a-z0-9-]+)\s*-->/g;
  let m;
  while ((m = re.exec(body ?? '')) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

function publish(dryRun) {
  const repo = env('GITHUB_REPOSITORY');
  const pr = env('PR_NUMBER');
  if (!repo || !pr) {
    throw new Error('publish requires GITHUB_REPOSITORY and PR_NUMBER');
  }
  const { owner, name } = parseRepo(repo);
  const commentPath = path.join(OUT_DIR, 'comment.md');
  const issuesPath = path.join(OUT_DIR, 'issues.json');
  if (!existsSync(commentPath) || !existsSync(issuesPath)) {
    throw new Error('Run build first (qa-report/ missing)');
  }
  const commentBody = readFileSync(commentPath, 'utf8');
  const issues = JSON.parse(readFileSync(issuesPath, 'utf8'));

  if (dryRun) {
    process.stdout.write(`[dry-run] PR #${pr} comment (${commentBody.length} bytes)\n`);
    process.stdout.write(`${commentBody.slice(0, 400)}${commentBody.length > 400 ? '\n…\n' : '\n'}`);
  } else {
    const list = ghArgs([
      'api',
      `repos/${owner}/${name}/issues/${pr}/comments`,
      '--paginate',
      '--jq',
      '.[] | {id: .id, body: .body}',
    ]);
    if (list.status !== 0) {
      throw new Error(list.stderr || 'gh api list comments failed');
    }
    let commentId = null;
    for (const line of list.stdout.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line);
      if (row.body?.startsWith(MARKER)) {
        commentId = row.id;
        break;
      }
    }
    if (commentId) {
      const patch = ghArgs([
        'api',
        '--method',
        'PATCH',
        `repos/${owner}/${name}/issues/comments/${commentId}`,
        '-F',
        `body=@${commentPath}`,
      ]);
      if (patch.status !== 0) {
        throw new Error(patch.stderr || 'gh api patch comment failed');
      }
      process.stdout.write(`Updated PR comment ${commentId}\n`);
    } else {
      const post = ghArgs(['pr', 'comment', pr, '--repo', repo, '--body-file', commentPath]);
      if (post.status !== 0) {
        throw new Error(post.stderr || 'gh pr comment failed');
      }
      process.stdout.write(`Created PR comment on #${pr}\n`);
    }
  }

  const listed = dryRun
    ? { status: 0, stdout: '[]' }
    : ghArgs([
        'issue',
        'list',
        '--repo',
        repo,
        '--label',
        FINDING_LABEL,
        '--state',
        'all',
        '--limit',
        '200',
        '--json',
        'body',
      ]);
  const existingKeys = new Set();
  if (listed.status === 0 && listed.stdout) {
    const rows = JSON.parse(listed.stdout);
    for (const row of rows) {
      for (const key of extractFindingKeys(row.body)) {
        existingKeys.add(key);
      }
    }
  }

  for (const issue of issues) {
    if (existingKeys.has(issue.key)) {
      const msg = `Skip issue (already filed): ${issue.key}`;
      process.stdout.write(dryRun ? `[dry-run] ${msg}\n` : `${msg}\n`);
      continue;
    }
    if (dryRun) {
      process.stdout.write(`[dry-run] Would create issue: ${issue.title}\n`);
      process.stdout.write(`${issue.body.slice(0, 200)}…\n`);
      continue;
    }
    const bodyFile = path.join(OUT_DIR, `.issue-${issue.key}.md`);
    writeFileSync(bodyFile, issue.body, 'utf8');
    const create = ghArgs([
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      issue.title,
      '--body-file',
      bodyFile,
      '--label',
      FINDING_LABEL,
    ]);
    if (create.status !== 0) {
      throw new Error(create.stderr || `gh issue create failed for ${issue.key}`);
    }
    process.stdout.write(`Created issue for ${issue.key}\n`);
  }
}

const cmd = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (cmd === 'build') {
  build();
} else if (cmd === 'publish') {
  publish(dryRun);
} else {
  process.stderr.write('Usage: node scripts/qa-report.mjs build | publish [--dry-run]\n');
  process.exit(1);
}
