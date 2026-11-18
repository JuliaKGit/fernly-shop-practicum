/**
 * Playwright reporter: aggregates axe-results / axe-shot attachments into a11y-report/.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import type { NodeResult, Result } from 'axe-core';
import {
  classifyViolationNode,
  matchingBaselineEntries,
  matchingBaselineIndices,
  type BaselineEntry,
  type ViolationClassification,
} from './baseline';

export interface A11yReporterOptions {
  outputFolder: string;
  /** Path to baseline JSON (resolved from cwd). */
  baseline: string;
  title: string;
}

interface AxeResultsPayload {
  page: string;
  url: string;
  scannedAt: string;
  violations: Result[];
  passes: Result[];
  incomplete: Result[];
}

interface ViolationRow {
  testId: string;
  testTitle: string;
  page: string;
  url: string;
  scannedAt: string;
  ruleId: string;
  impact: string;
  help: string;
  helpUrl: string;
  tags: string[];
  wcagTags: string[];
  target: string[];
  selector: string;
  html: string;
  failureSummary: string;
  classification: ViolationClassification;
  blocking: boolean;
  baselineOwner?: string;
  baselineExpires?: string;
  baselineReason?: string;
  screenshotBase64?: string;
}

interface PageAgg {
  page: string;
  url: string;
  elementCount: number;
  rulesPassed: number;
  impactCounts: Record<string, number>;
}

interface RuleAgg {
  ruleId: string;
  impact: string;
  help: string;
  helpUrl: string;
  tags: string[];
  wcagTags: string[];
  instances: ViolationRow[];
}

const IMPACT_ORDER: Record<string, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
  unknown: 4,
};

function impactRank(impact: string): number {
  return IMPACT_ORDER[impact] ?? IMPACT_ORDER.unknown;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function nodeTargetStrings(node: NodeResult): string[] {
  return node.target.map(String);
}

function isBlockingClassification(c: ViolationClassification, impact: string): boolean {
  if (c === 'expired') {
    return true;
  }
  if (c === 'new' && (impact === 'serious' || impact === 'critical')) {
    return true;
  }
  return false;
}

function wcagTagsFromRule(rule: Result): string[] {
  return rule.tags.filter((t) => String(t).startsWith('wcag'));
}

function baselineDetailsForNode(
  entries: BaselineEntry[],
  ruleId: string,
  page: string,
  nodeTarget: string[],
  classification: ViolationClassification,
): { owner?: string; expires?: string; reason?: string } {
  const matches = matchingBaselineEntries(entries, ruleId, page, nodeTarget);
  if (matches.length === 0) {
    return {};
  }
  if (classification === 'baselined') {
    const active = matches.find((m) => m.expires >= new Date().toISOString().slice(0, 10));
    const m = active ?? matches[0];
    return { owner: m.owner, expires: m.expires, reason: m.reason };
  }
  if (classification === 'expired') {
    const m = matches[0];
    return { owner: m.owner, expires: m.expires, reason: m.reason };
  }
  return {};
}

function parseShotName(name: string): { page: string; ruleId: string; index: number } | null {
  const prefix = 'axe-shot:';
  if (!name.startsWith(prefix)) {
    return null;
  }
  const rest = name.slice(prefix.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon <= 0) {
    return null;
  }
  const indexStr = rest.slice(lastColon + 1);
  const index = Number.parseInt(indexStr, 10);
  if (Number.isNaN(index)) {
    return null;
  }
  const mid = rest.slice(0, lastColon);
  const firstColon = mid.indexOf(':');
  if (firstColon < 0) {
    return null;
  }
  const page = mid.slice(0, firstColon);
  const ruleId = mid.slice(firstColon + 1);
  return { page, ruleId, index };
}

function shotKey(page: string, ruleId: string, nodeIndex: number): string {
  return `${page}|${ruleId}|${nodeIndex}`;
}

async function readAttachmentBody(att: {
  path?: string;
  body?: Buffer;
}): Promise<Buffer | null> {
  if (att.body?.length) {
    return att.body;
  }
  if (att.path) {
    return readFile(att.path);
  }
  return null;
}

function formatTotalsLine(
  totals: { pagesScanned: number; rulesViolated: number; elementsAffected: number; blocking: number },
  outDir: string,
): string {
  return `A11y report: pages=${totals.pagesScanned} rules=${totals.rulesViolated} elements=${totals.elementsAffected} blocking=${totals.blocking} → ${path.join(outDir, 'index.html')}`;
}

function emptyImpactCounts(): Record<string, number> {
  return { critical: 0, serious: 0, moderate: 0, minor: 0 };
}

function buildPageAggregates(
  rows: ViolationRow[],
  payloads: Array<{ payload: AxeResultsPayload; rulesPassed: number }>,
): PageAgg[] {
  const byPage = new Map<string, PageAgg>();
  for (const { payload, rulesPassed } of payloads) {
    if (!byPage.has(payload.page)) {
      byPage.set(payload.page, {
        page: payload.page,
        url: payload.url,
        elementCount: 0,
        rulesPassed,
        impactCounts: emptyImpactCounts(),
      });
    }
  }
  for (const r of rows) {
    let agg = byPage.get(r.page);
    if (!agg) {
      agg = {
        page: r.page,
        url: r.url,
        elementCount: 0,
        rulesPassed: 0,
        impactCounts: emptyImpactCounts(),
      };
      byPage.set(r.page, agg);
    }
    agg.elementCount += 1;
    const imp = r.impact in agg.impactCounts ? r.impact : 'minor';
    if (imp in agg.impactCounts) {
      agg.impactCounts[imp] += 1;
    } else {
      agg.impactCounts.minor += 1;
    }
    if (r.url) {
      agg.url = r.url;
    }
  }
  for (const { payload, rulesPassed } of payloads) {
    const agg = byPage.get(payload.page);
    if (agg) {
      agg.rulesPassed = rulesPassed;
      if (!agg.url) {
        agg.url = payload.url;
      }
    }
  }
  return [...byPage.values()].sort((a, b) => a.page.localeCompare(b.page));
}

function buildRuleAggregates(rows: ViolationRow[]): RuleAgg[] {
  const byRule = new Map<string, RuleAgg>();
  for (const r of rows) {
    let agg = byRule.get(r.ruleId);
    if (!agg) {
      agg = {
        ruleId: r.ruleId,
        impact: r.impact,
        help: r.help,
        helpUrl: r.helpUrl,
        tags: r.tags,
        wcagTags: r.wcagTags,
        instances: [],
      };
      byRule.set(r.ruleId, agg);
    }
    agg.instances.push(r);
    if (impactRank(r.impact) < impactRank(agg.impact)) {
      agg.impact = r.impact;
    }
  }
  return [...byRule.values()].sort((a, b) => impactRank(a.impact) - impactRank(b.impact));
}

export default class A11yAxeReporter implements Reporter {
  private readonly options: A11yReporterOptions;

  private baselineEntries: BaselineEntry[] = [];

  /** Latest test result per stable id (last retry wins). */
  private readonly latestTestResults = new Map<
    string,
    { retry: number; test: TestCase; result: TestResult }
  >();

  constructor(options: A11yReporterOptions) {
    this.options = options;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBegin(_config: FullConfig, _suite: Suite): void {
    // Baseline loaded in onEnd after all attachments exist
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const hasAxe = result.attachments.some((a) => a.name === 'axe-results');
    if (!hasAxe) {
      return;
    }
    const key = `${test.location.file}:${test.title}`;
    const prev = this.latestTestResults.get(key);
    if (!prev || result.retry >= prev.retry) {
      this.latestTestResults.set(key, { retry: result.retry, test, result });
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const cwd = process.cwd();
    const baselinePath = path.isAbsolute(this.options.baseline)
      ? this.options.baseline
      : path.resolve(cwd, this.options.baseline);
    const raw = await readFile(baselinePath, 'utf8');
    this.baselineEntries = JSON.parse(raw) as BaselineEntry[];

    const allRows: ViolationRow[] = [];
    const payloadRecords: Array<{ payload: AxeResultsPayload; rulesPassed: number }> = [];
    const baselineMatched = new Set<number>();

    for (const { test, result: tr } of this.latestTestResults.values()) {
      const axeAtt = tr.attachments.find((a) => a.name === 'axe-results');
      if (!axeAtt) {
        continue;
      }
      const buf = await readAttachmentBody(axeAtt);
      if (!buf) {
        continue;
      }
      const payload = JSON.parse(buf.toString('utf8')) as AxeResultsPayload;
      const shots = new Map<string, string>();
      for (const a of tr.attachments) {
        const parsed = parseShotName(a.name);
        if (!parsed || !a.contentType?.includes('png')) {
          continue;
        }
        const b = await readAttachmentBody(a);
        if (!b) {
          continue;
        }
        shots.set(shotKey(parsed.page, parsed.ruleId, parsed.index), b.toString('base64'));
      }

      const rulesPassed = payload.passes?.length ?? 0;
      payloadRecords.push({ payload, rulesPassed });

      for (const violation of payload.violations) {
        const ruleImpact = violation.impact ?? 'unknown';
        let nodeIndex = 0;
        for (const node of violation.nodes) {
          const target = nodeTargetStrings(node);
          const impact = node.impact ?? ruleImpact;
          const classification = classifyViolationNode(this.baselineEntries, violation.id, payload.page, impact, target);

          for (const idx of matchingBaselineIndices(
            this.baselineEntries,
            violation.id,
            payload.page,
            target,
          )) {
            baselineMatched.add(idx);
          }

          const blocking = isBlockingClassification(classification, impact);
          const bd = baselineDetailsForNode(this.baselineEntries, violation.id, payload.page, target, classification);
          const imgB64 = shots.get(shotKey(payload.page, violation.id, nodeIndex));

          allRows.push({
            testId: `${test.location.file}::${test.title}`,
            testTitle: test.title,
            page: payload.page,
            url: payload.url,
            scannedAt: payload.scannedAt,
            ruleId: violation.id,
            impact,
            help: violation.help,
            helpUrl: violation.helpUrl,
            tags: violation.tags as string[],
            wcagTags: wcagTagsFromRule(violation),
            target,
            selector: target.join(' >> '),
            html: node.html,
            failureSummary: node.failureSummary ?? '',
            classification,
            blocking,
            baselineOwner: bd.owner,
            baselineExpires: bd.expires,
            baselineReason: bd.reason,
            screenshotBase64: imgB64,
          });
          nodeIndex += 1;
        }
      }
    }

    const pages = buildPageAggregates(allRows, payloadRecords);

    const ruleIds = new Set(allRows.map((r) => r.ruleId));
    const blockingRows = allRows.filter((r) => r.blocking);
    const totals = {
      pagesScanned: pages.length,
      rulesViolated: ruleIds.size,
      elementsAffected: allRows.length,
      blocking: blockingRows.length,
    };

    const orphanBaseline = this.baselineEntries.filter((_e, idx) => !baselineMatched.has(idx));
    const rulesAgg = buildRuleAggregates(allRows);

    const outDir = path.isAbsolute(this.options.outputFolder)
      ? this.options.outputFolder
      : path.resolve(cwd, this.options.outputFolder);
    await mkdir(outDir, { recursive: true });

    const stripScreenshot = (
      row: ViolationRow,
    ): Omit<ViolationRow, 'screenshotBase64'> & { screenshotAttached: boolean } => {
      const { screenshotBase64: b, ...rest } = row;
      return { ...rest, screenshotAttached: Boolean(b) };
    };

    const resultsJson = {
      title: this.options.title,
      baselinePath: baselinePath,
      outputFolder: outDir,
      runStatus: result.status,
      generatedAt: new Date().toISOString(),
      totals,
      byImpact: {
        new: allRows.filter((r) => r.classification === 'new').length,
        baselined: allRows.filter((r) => r.classification === 'baselined').length,
        expired: allRows.filter((r) => r.classification === 'expired').length,
      },
      pages,
      rules: rulesAgg.map((rule) => ({
        ...rule,
        instances: rule.instances.map(stripScreenshot),
      })),
      instances: allRows.map(stripScreenshot),
      orphanBaseline,
    };

    await writeFile(path.join(outDir, 'results.json'), JSON.stringify(resultsJson, null, 2), 'utf8');
    await writeFile(path.join(outDir, 'summary.md'), buildSummaryMd(this.options.title, totals, allRows, blockingRows), 'utf8');
    await writeFile(
      path.join(outDir, 'index.html'),
      buildIndexHtml(this.options.title, totals, pages, rulesAgg, orphanBaseline),
      'utf8',
    );

    // eslint-disable-next-line no-console
    console.log(formatTotalsLine(totals, outDir));
  }
}

function buildSummaryMd(
  title: string,
  totals: { pagesScanned: number; rulesViolated: number; elementsAffected: number; blocking: number },
  allRows: ViolationRow[],
  blockingRows: ViolationRow[],
): string {
  const byNew = allRows.filter((r) => r.classification === 'new').length;
  const byBase = allRows.filter((r) => r.classification === 'baselined').length;
  const byEx = allRows.filter((r) => r.classification === 'expired').length;

  function countFor(st: ViolationClassification, imp: string): number {
    return allRows.filter((r) => r.classification === st && r.impact === imp).length;
  }
  const impacts = ['critical', 'serious', 'moderate', 'minor'];

  const lines: string[] = [
    `## ${escapeMarkdownCell(title)}`,
    '',
    '### Totals',
    '',
    `| Pages scanned | Rules violated | Elements affected | Blocking |`,
    `| --- | --- | --- | --- |`,
    `| ${totals.pagesScanned} | ${totals.rulesViolated} | ${totals.elementsAffected} | ${totals.blocking} |`,
    '',
    '### By status',
    '',
    `| Status | Count |`,
    `| --- | --- |`,
    `| New | ${byNew} |`,
    `| Baselined | ${byBase} |`,
    `| Expired | ${byEx} |`,
    '',
    '### By impact × status',
    '',
    `| Impact | New | Baselined | Expired |`,
    `| --- | --- | --- | --- |`,
    ...impacts.map(
      (imp) =>
        `| ${escapeMarkdownCell(imp)} | ${countFor('new', imp)} | ${countFor('baselined', imp)} | ${countFor('expired', imp)} |`,
    ),
    '',
    '### Blocking violations (by rule and page)',
    '',
  ];

  const groups = new Map<string, ViolationRow[]>();
  for (const r of blockingRows) {
    const key = `${r.ruleId}|||${r.page}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const sortedKeys = [...groups.keys()].sort();
  if (sortedKeys.length === 0) {
    lines.push('_None._');
  } else {
    lines.push(`| Rule | Page | Count | Example selector |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const key of sortedKeys) {
      const list = groups.get(key)!;
      const example = list[0]?.selector ?? '';
      const [ruleId, page] = key.split('|||');
      lines.push(
        `| ${escapeMarkdownCell(ruleId)} | ${escapeMarkdownCell(page)} | ${list.length} | \`${escapeMarkdownCell(example)}\` |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

function buildIndexHtml(
  title: string,
  totals: { pagesScanned: number; rulesViolated: number; elementsAffected: number; blocking: number },
  pages: PageAgg[],
  rules: RuleAgg[],
  orphanBaseline: BaselineEntry[],
): string {
  const data = {
    title,
    totals,
    pages,
    rules,
    orphanBaseline,
  };
  const jsonEmbedded = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const css = `
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem 1.25rem; background: #0f1419; color: #e6edf3; }
    h1 { font-size: 1.35rem; margin: 0 0 0.75rem; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .metric { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 0.75rem 1rem; }
    .metric .n { font-size: 1.6rem; font-weight: 700; color: #58a6ff; }
    .metric .l { font-size: 0.8rem; color: #8b949e; }
    section { margin-bottom: 1.5rem; }
    h2 { font-size: 1.05rem; margin: 0 0 0.5rem; color: #c9d1d9; }
    .filters { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; }
    .filters label { font-size: 0.85rem; margin-right: 0.35rem; }
    .filters input[type="search"] { min-width: 200px; padding: 0.35rem 0.5rem; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border: 1px solid #30363d; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #161b22; color: #8b949e; font-weight: 600; }
    tr:nth-child(even) td { background: #0d1117; }
    .bar-wrap { display: flex; height: 10px; border-radius: 4px; overflow: hidden; background: #21262d; min-width: 120px; }
    .bar { height: 100%; }
    .bar.critical { background: #f85149; }
    .bar.serious { background: #d29922; }
    .bar.moderate { background: #a371f7; }
    .bar.minor { background: #8b949e; }
    .rule-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .rule-head { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: baseline; margin-bottom: 0.75rem; }
    .impact { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; padding: 0.15rem 0.45rem; border-radius: 4px; }
    .impact.critical { background: #f8514933; color: #f85149; }
    .impact.serious { background: #d2992233; color: #d29922; }
    .impact.moderate { background: #a371f733; color: #a371f7; }
    .impact.minor { background: #8b949e33; color: #8b949e; }
    .rule-id { font-family: ui-monospace, monospace; color: #58a6ff; }
    .elem { border-top: 1px solid #30363d; padding: 0.75rem 0; display: grid; grid-template-columns: 200px 1fr; gap: 0.75rem; }
    @media (max-width: 800px) { .elem { grid-template-columns: 1fr; } }
    .elem img { max-width: 100%; border-radius: 4px; border: 1px solid #30363d; }
    .tag { display: inline-block; font-size: 0.72rem; padding: 0.1rem 0.35rem; margin: 0.1rem 0.2rem 0.1rem 0; background: #21262d; border-radius: 3px; color: #8b949e; }
    .lbl-new { color: #f85149; font-weight: 600; }
    .lbl-baselined { color: #3fb950; font-weight: 600; }
    .lbl-expired { color: #d29922; font-weight: 600; }
    pre { margin: 0.35rem 0; padding: 0.5rem; background: #0d1117; border-radius: 4px; overflow: auto; font-size: 0.78rem; color: #c9d1d9; }
    .orphan { background: #3d1300; border: 1px solid #9e6a03; border-radius: 8px; padding: 0.75rem; font-size: 0.88rem; }
    .hidden { display: none !important; }
  `;

  const js = `
(function(){
  var DATA = JSON.parse(${JSON.stringify(jsonEmbedded)});
  function esc(s){
    if(s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function impactClass(imp){
    if(imp==='critical') return 'critical';
    if(imp==='serious') return 'serious';
    if(imp==='moderate') return 'moderate';
    return 'minor';
  }
  function normImpact(imp){
    if(imp==='critical'||imp==='serious'||imp==='moderate'||imp==='minor') return imp;
    return 'minor';
  }
  document.getElementById('report-title').textContent = DATA.title;
  document.getElementById('m-pages').textContent = String(DATA.totals.pagesScanned);
  document.getElementById('m-rules').textContent = String(DATA.totals.rulesViolated);
  document.getElementById('m-elements').textContent = String(DATA.totals.elementsAffected);
  document.getElementById('m-blocking').textContent = String(DATA.totals.blocking);

  var allInstances = [];
  DATA.rules.forEach(function(rule){
    rule.instances.forEach(function(row){ allInstances.push(row); });
  });

  var impCounts = { critical:0, serious:0, moderate:0, minor:0 };
  allInstances.forEach(function(r){
    var ni = normImpact(r.impact);
    impCounts[ni]++;
  });

  function setImpactChk(id, n){
    var el = document.getElementById(id);
    var span = document.getElementById(id+'-n');
    if(span) span.textContent = '('+n+')';
  }
  setImpactChk('f-critical', impCounts.critical);
  setImpactChk('f-serious', impCounts.serious);
  setImpactChk('f-moderate', impCounts.moderate);
  setImpactChk('f-minor', impCounts.minor);

  var pageSel = document.getElementById('filter-page');
  var pages = DATA.pages.slice().sort(function(a,b){ return a.page.localeCompare(b.page); });
  pages.forEach(function(p){
    var o = document.createElement('option');
    o.value = p.page;
    o.textContent = p.page + ' — ' + p.url;
    pageSel.appendChild(o);
  });

  var tbody = document.querySelector('#pages-table tbody');
  pages.forEach(function(p){
    var tr = document.createElement('tr');
    var total = p.elementCount || 1;
    var c = p.impactCounts.critical||0, s = p.impactCounts.serious||0, mo = p.impactCounts.moderate||0, mi = p.impactCounts.minor||0;
    tr.innerHTML =
      '<td>'+esc(p.page)+'</td>'+
      '<td>'+esc(p.url)+'</td>'+
      '<td>'+p.elementCount+'</td>'+
      '<td><div class="bar-wrap">'+
        '<div class="bar critical" style="width:'+(c/total*100)+'%" title="critical"></div>'+
        '<div class="bar serious" style="width:'+(s/total*100)+'%"></div>'+
        '<div class="bar moderate" style="width:'+(mo/total*100)+'%"></div>'+
        '<div class="bar minor" style="width:'+(mi/total*100)+'%"></div>'+
      '</div></td>'+
      '<td>'+p.rulesPassed+'</td>';
    tbody.appendChild(tr);
  });

  var cardsRoot = document.getElementById('rule-cards');
  DATA.rules.forEach(function(rule){
    var card = document.createElement('div');
    card.className = 'rule-card';
    card.dataset.ruleId = rule.ruleId;
    card.dataset.impact = rule.impact;
    var tags = (rule.wcagTags||[]).map(function(t){ return '<span class="tag">'+esc(t)+'</span>'; }).join('');
    var head = document.createElement('div');
    head.className = 'rule-head';
    head.innerHTML =
      '<span class="impact '+impactClass(rule.impact)+'">'+esc(rule.impact)+'</span>'+
      '<span class="rule-id">'+esc(rule.ruleId)+'</span>'+
      '<a href="'+esc(rule.helpUrl)+'" target="_blank" rel="noopener">How to fix it</a>';
    var help = document.createElement('p');
    help.style.margin = '0 0 0.5rem';
    help.style.color = '#8b949e';
    help.style.fontSize = '0.9rem';
    help.textContent = rule.help;
    var tagDiv = document.createElement('div');
    tagDiv.innerHTML = tags;
    card.appendChild(head);
    card.appendChild(help);
    card.appendChild(tagDiv);
    rule.instances.forEach(function(row){
      var div = document.createElement('div');
      div.className = 'elem';
      div.dataset.page = row.page;
      div.dataset.status = row.classification;
      div.dataset.impact = normImpact(row.impact);
      div.dataset.search = (row.ruleId+' '+row.page+' '+row.selector+' '+row.html+' '+(row.failureSummary||'')).toLowerCase();
      var lblClass = row.classification==='new' ? 'lbl-new' : (row.classification==='baselined' ? 'lbl-baselined' : 'lbl-expired');
      var lbl = '<span class="'+lblClass+'">'+(row.classification==='new'?'New':row.classification==='baselined'?'Baselined':'Expired')+'</span>';
      var base = '';
      if(row.classification==='baselined' || row.classification==='expired'){
        base = '<p style="margin:0.35rem 0 0;font-size:0.8rem;color:#8b949e">Owner: '+esc(row.baselineOwner||'—')+
          ' · End: '+esc(row.baselineExpires||'—')+(row.baselineReason? ' · '+esc(row.baselineReason):'')+'</p>';
      }
      var imgHtml = row.screenshotBase64
        ? '<img src="data:image/png;base64,'+row.screenshotBase64+'" alt="" />'
        : '<span style="color:#8b949e;font-size:0.85rem">No screenshot</span>';
      div.innerHTML =
        '<div>'+imgHtml+'</div><div>'+
        '<p style="margin:0 0 0.25rem;font-size:0.8rem;color:#8b949e">'+esc(row.page)+' · '+esc(row.url)+'</p>'+
        '<pre>'+esc(row.selector)+'</pre>'+
        '<pre>'+esc(row.html)+'</pre>'+
        (row.failureSummary? '<p style="margin:0.25rem 0;font-size:0.85rem">'+esc(row.failureSummary)+'</p>' : '')+
        lbl + base +
        '</div>';
      card.appendChild(div);
    });
    cardsRoot.appendChild(card);
  });

  if(DATA.orphanBaseline && DATA.orphanBaseline.length){
    var ob = document.getElementById('orphan-list');
    DATA.orphanBaseline.forEach(function(e){
      var li = document.createElement('li');
      li.textContent = e.rule+' · '+e.page+' · '+e.target+' (owner: '+e.owner+', expires '+e.expires+')';
      ob.appendChild(li);
    });
  } else {
    document.getElementById('orphan-section').classList.add('hidden');
  }

  function applyFilters(){
    var crit = document.getElementById('f-critical').checked;
    var ser = document.getElementById('f-serious').checked;
    var mod = document.getElementById('f-moderate').checked;
    var min = document.getElementById('f-minor').checked;
    var page = document.getElementById('filter-page').value;
    var status = document.getElementById('filter-status').value;
    var q = (document.getElementById('filter-search').value||'').toLowerCase();
    var cards = document.querySelectorAll('.rule-card');
    cards.forEach(function(card){
      var showCard = false;
      card.querySelectorAll('.elem').forEach(function(el){
        var imp = el.dataset.impact || 'minor';
        var okImp = (imp==='critical'&&crit)||(imp==='serious'&&ser)||(imp==='moderate'&&mod)||(imp==='minor'&&min);
        var okPage = !page || el.dataset.page===page;
        var okSt = !status || el.dataset.status===status;
        var okQ = !q || (el.dataset.search||'').indexOf(q)>=0;
        var vis = okImp && okPage && okSt && okQ;
        el.classList.toggle('hidden', !vis);
        if(vis) showCard = true;
      });
      card.classList.toggle('hidden', !showCard);
    });
  }
  ['f-critical','f-serious','f-moderate','f-minor','filter-page','filter-status','filter-search'].forEach(function(id){
    var el = document.getElementById(id);
    el.addEventListener('change', applyFilters);
    el.addEventListener('input', applyFilters);
  });
  applyFilters();
})();
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
  <h1 id="report-title"></h1>
  <div class="metrics">
    <div class="metric"><div class="n" id="m-pages">0</div><div class="l">Pages scanned</div></div>
    <div class="metric"><div class="n" id="m-rules">0</div><div class="l">Rules violated</div></div>
    <div class="metric"><div class="n" id="m-elements">0</div><div class="l">Elements affected</div></div>
    <div class="metric"><div class="n" id="m-blocking">0</div><div class="l">Blocking</div></div>
  </div>

  <section>
    <h2>Pages</h2>
    <table id="pages-table">
      <thead><tr><th>Page</th><th>URL</th><th>Elements</th><th>Impact</th><th>Rules passed</th></tr></thead>
      <tbody></tbody>
    </table>
  </section>

  <section>
    <h2>Filters</h2>
    <div class="filters">
      <span><label><input type="checkbox" id="f-critical" checked /> Critical <span id="f-critical-n"></span></label></span>
      <span><label><input type="checkbox" id="f-serious" checked /> Serious <span id="f-serious-n"></span></label></span>
      <span><label><input type="checkbox" id="f-moderate" checked /> Moderate <span id="f-moderate-n"></span></label></span>
      <span><label><input type="checkbox" id="f-minor" checked /> Minor <span id="f-minor-n"></span></label></span>
      <label>Page <select id="filter-page"><option value="">All</option></select></label>
      <label>Status <select id="filter-status"><option value="">All</option><option value="new">New</option><option value="baselined">Baselined</option><option value="expired">Expired</option></select></label>
      <label>Search <input type="search" id="filter-search" placeholder="Rule, selector, HTML…" /></label>
    </div>
  </section>

  <section>
    <h2>Violations by rule</h2>
    <div id="rule-cards"></div>
  </section>

  <section id="orphan-section">
    <h2>Baseline entries with no matching violation (consider deleting)</h2>
    <ul id="orphan-list" class="orphan"></ul>
  </section>

  <script>${js}</script>
</body>
</html>`;
}
