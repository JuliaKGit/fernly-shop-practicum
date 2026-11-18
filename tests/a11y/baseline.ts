import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BaselineEntry {
  rule: string;
  page: string;
  target: string;
  owner: string;
  expires: string;
  reason: string;
}

export type ViolationClassification = 'new' | 'baselined' | 'expired';

export interface ClassifiedViolationNode {
  ruleId: string;
  page: string;
  impact: string;
  /** Primary selectors for the failing node (axe `target`). */
  target: string[];
  classification: ViolationClassification;
  help: string;
}

const BASELINE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'a11y-baseline.json');

let cachedBaseline: BaselineEntry[] | null = null;

export async function loadBaseline(): Promise<BaselineEntry[]> {
  if (cachedBaseline) {
    return cachedBaseline;
  }
  const raw = await readFile(BASELINE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected array in ${BASELINE_PATH}`);
  }
  cachedBaseline = parsed as BaselineEntry[];
  return cachedBaseline;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function baselineExpired(isoDate: string): boolean {
  return isoDate < todayIsoDate();
}

/** Whether an axe node target matches a baseline `target` string or `*`. */
export function nodeMatchesBaselineTarget(nodeTarget: string[], baselineTarget: string): boolean {
  if (baselineTarget === '*') {
    return true;
  }
  const joined = nodeTarget.join(' >> ');
  const joinedComma = nodeTarget.join(', ');
  return joined === baselineTarget || joinedComma === baselineTarget || nodeTarget.at(-1) === baselineTarget;
}

export function matchingBaselineEntries(
  entries: BaselineEntry[],
  ruleId: string,
  page: string,
  nodeTarget: string[],
): BaselineEntry[] {
  return entries.filter(
    (e) => e.rule === ruleId && e.page === page && nodeMatchesBaselineTarget(nodeTarget, e.target),
  );
}

/** Indices into `entries` that match this violation node. */
export function matchingBaselineIndices(
  entries: BaselineEntry[],
  ruleId: string,
  page: string,
  nodeTarget: string[],
): number[] {
  const out: number[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.rule === ruleId && e.page === page && nodeMatchesBaselineTarget(nodeTarget, e.target)) {
      out.push(i);
    }
  }
  return out;
}

/**
 * Classify one axe violation node. Blocking elsewhere = new serious/critical, or any expired match.
 */
export function classifyViolationNode(
  entries: BaselineEntry[],
  ruleId: string,
  page: string,
  impact: string | null | undefined,
  nodeTarget: string[],
): ViolationClassification {
  const matches = matchingBaselineEntries(entries, ruleId, page, nodeTarget);
  if (matches.length === 0) {
    return 'new';
  }
  const hasActive = matches.some((m) => !baselineExpired(m.expires));
  if (hasActive) {
    return 'baselined';
  }
  return 'expired';
}

export function isNewBlockingImpact(impact: string | null | undefined): boolean {
  return impact === 'serious' || impact === 'critical';
}
