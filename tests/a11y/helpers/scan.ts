import { AxeBuilder } from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import type { AxeResults, NodeResult, Result } from 'axe-core';
import {
  classifyViolationNode,
  isNewBlockingImpact,
  loadBaseline,
  type BaselineEntry,
  type ClassifiedViolationNode,
} from '../baseline';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export interface ScanPageOptions {
  /** Logical page name; must match `page` in a11y-baseline.json rows. */
  name: string;
  /** Optional axe include selector(s) to limit the scan (e.g. a Reviews section). */
  include?: string | string[];
}

export interface ScanPageResult {
  classified: ClassifiedViolationNode[];
  blocking: ClassifiedViolationNode[];
}

function nodeTargetStrings(node: NodeResult): string[] {
  return node.target.map(String);
}

function formatBlockingMessage(blocking: ClassifiedViolationNode[]): string {
  if (blocking.length === 0) {
    return '';
  }
  return blocking
    .map(
      (b) =>
        `[${b.classification}] ${b.ruleId} (${b.impact}) ${b.target.join(' >> ')} — ${b.help}`,
    )
    .join('\n');
}

export async function scanPage(
  page: Page,
  testInfo: TestInfo,
  options: ScanPageOptions,
): Promise<ScanPageResult> {
  const baseline: BaselineEntry[] = await loadBaseline();
  const scannedAt = new Date().toISOString();

  let builder = new AxeBuilder({ page }).withTags([...AXE_TAGS]);
  if (options.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    for (const selector of includes) {
      builder = builder.include(selector);
    }
  }
  const rawResults: AxeResults = await builder.analyze();

  const violations: Result[] = rawResults.violations;
  const passes: Result[] = rawResults.passes;
  const incomplete: Result[] = rawResults.incomplete;
  const url = page.url();

  await testInfo.attach('axe-results', {
    body: Buffer.from(
      JSON.stringify(
        {
          page: options.name,
          url,
          scannedAt,
          violations,
          passes,
          incomplete,
        },
        null,
        2,
      ),
      'utf8',
    ),
    contentType: 'application/json',
  });

  const classified: ClassifiedViolationNode[] = [];

  for (const violation of violations) {
    const ruleId = violation.id;
    const impactStr = violation.impact ?? 'unknown';

    for (const node of violation.nodes) {
      const target = nodeTargetStrings(node);
      const classification = classifyViolationNode(baseline, ruleId, options.name, impactStr, target);

      classified.push({
        ruleId,
        page: options.name,
        impact: impactStr,
        target,
        classification,
        help: violation.help,
      });
    }

    const maxShots = Math.min(3, violation.nodes.length);
    for (let index = 0; index < maxShots; index++) {
      const node = violation.nodes[index];
      if (!node) {
        continue;
      }
      const target = nodeTargetStrings(node);
      const locator = page.locator(target.join(' >> '));
      try {
        const screenshot = await locator.screenshot({ timeout: 5_000 });
        const attachmentName = `axe-shot:${options.name}:${ruleId}:${index}`;
        await testInfo.attach(attachmentName, {
          body: screenshot,
          contentType: 'image/png',
        });
      } catch {
        // Element not visible or locator failed — skip screenshot
      }
    }
  }

  const blocking: ClassifiedViolationNode[] = [];
  for (const item of classified) {
    if (item.classification === 'expired') {
      blocking.push(item);
      continue;
    }
    if (item.classification === 'new' && isNewBlockingImpact(item.impact)) {
      blocking.push(item);
    }
  }

  return { classified, blocking };
}

export { formatBlockingMessage };
