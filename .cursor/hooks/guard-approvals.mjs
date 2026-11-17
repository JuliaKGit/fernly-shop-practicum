/**
 * Windows cannot execute a .sh hook directly (no stdout, and failClosed then blocks every command).
 * This runs guard-approvals.sh, which is the guard, and forwards its JSON.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const input = readFileSync(0);
const script = join(dirname(fileURLToPath(import.meta.url)), 'guard-approvals.sh');
const candidates = [
  process.env.BASH,
  'bash',
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
].filter(Boolean);

let out = '';
for (const bash of candidates) {
  if (bash.includes('\\') && !existsSync(bash)) {
    continue;
  }
  const result = spawnSync(bash, [script], { input, encoding: 'utf8', windowsHide: true });
  if (result.error || !result.stdout || !result.stdout.trim()) {
    continue;
  }
  out = result.stdout;
  break;
}

if (!out.trim()) {
  out = '{"permission":"deny","user_message":"Only a person does this. The approval guard did not run.","agent_message":"Only a person does this. The approval guard did not run."}\n';
}

process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
