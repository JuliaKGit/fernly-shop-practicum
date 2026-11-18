import { readFileSync } from 'node:fs';

const DENY_MESSAGE =
  'Visual screenshot baselines only change through the visual-baselines GitHub workflow and a reviewed pull request.';
const AGENT_MESSAGE = `${DENY_MESSAGE} Do not run playwright test with --update-snapshots or -u locally.`;

const raw = readFileSync(0, 'utf8');
const payload = raw.trim() ? JSON.parse(raw) : {};
const command = payload.command ?? '';

function shouldDeny(cmd) {
  if (!/playwright/i.test(cmd)) {
    return false;
  }
  if (/--update-snapshots/.test(cmd)) {
    return true;
  }
  return /(?:^|\s)-u(?:\s|$)/.test(cmd);
}

if (shouldDeny(command)) {
  console.log(
    JSON.stringify({
      permission: 'deny',
      user_message: DENY_MESSAGE,
      agent_message: AGENT_MESSAGE,
    }),
  );
} else {
  console.log(JSON.stringify({ permission: 'allow' }));
}
