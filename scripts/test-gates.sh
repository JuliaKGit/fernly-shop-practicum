#!/usr/bin/env bash
# Offline checks for the pipeline gates. No API key and no GitHub.
# One PASS or FAIL line per check. Exit 1 if any gate does not hold.
set -u

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

fail=0
wt=""
patches=""

say_pass() { printf 'PASS %s\n' "$1"; }
say_fail() { printf 'FAIL %s\n' "$*"; fail=1; }

cleanup() {
  if [ -n "$wt" ]; then
    git -C "$root" worktree remove --force "$wt" >/dev/null 2>&1 || true
    git -C "$root" worktree prune >/dev/null 2>&1 || true
    rm -rf "$wt"
  fi
  if [ -n "$patches" ]; then
    rm -rf "$patches"
  fi
}
trap cleanup EXIT

wt_git() {
  git -C "$wt" -c core.safecrlf=false "$@"
}

reset_wt() {
  wt_git reset --hard HEAD >/dev/null
  wt_git clean -fd >/dev/null
}

stage_patch() {
  dest=$1
  wt_git add -A >/dev/null
  wt_git diff --cached --binary > "$dest"
}

# want is 0 when the patch must be allowed, 1 when it must be blocked.
guard() {
  name=$1
  want=$2
  patch=$3
  shift 3
  if [ ! -s "$patch" ]; then
    say_fail "$name (empty patch)"
    return
  fi
  code=0
  # Run against the throwaway tree, after it is put back to the patch base.
  wt_git reset --hard HEAD >/dev/null
  wt_git clean -fd >/dev/null
  (cd "$wt" && bash "$root/scripts/agent-guard.sh" "$patch" "$@") >/dev/null 2>&1 || code=$?
  if [ "$code" -eq "$want" ]; then
    say_pass "$name"
  else
    say_fail "$name (exit $code, wanted $want)"
  fi
}

check_agent_guard() {
  wt=$(mktemp -d)
  patches=$(mktemp -d)
  if ! git -C "$root" worktree add --detach "$wt" HEAD >/dev/null 2>&1; then
    say_fail "agent-guard: plan only (could not make a throwaway worktree)"
    say_fail "agent-guard: plan plus web/src blocked"
    say_fail "agent-guard: workflow change blocked"
    say_fail "agent-guard: screenshot baseline blocked"
    say_fail "agent-guard: agent-guard.sh blocked with scripts/*"
    say_fail "agent-guard: tests and FINDINGS.md"
    rm -rf "$wt"
    wt=""
    return
  fi

  reset_wt
  mkdir -p "$wt/docs/test-plans"
  printf '%s\n' 'plan' > "$wt/docs/test-plans/gate-check.md"
  stage_patch "$patches/plan.patch"
  guard "agent-guard: plan only" 0 "$patches/plan.patch" 'docs/test-plans/*'

  reset_wt
  mkdir -p "$wt/docs/test-plans" "$wt/web/src"
  printf '%s\n' 'plan' > "$wt/docs/test-plans/gate-check.md"
  printf '%s\n' 'sneak' > "$wt/web/src/gate-sneak.ts"
  stage_patch "$patches/plan-src.patch"
  guard "agent-guard: plan plus web/src blocked" 1 "$patches/plan-src.patch" 'docs/test-plans/*'

  reset_wt
  printf '\n# gate\n' >> "$wt/.github/workflows/pr-triage.yml"
  stage_patch "$patches/workflow.patch"
  guard "agent-guard: workflow change blocked" 1 "$patches/workflow.patch" '.github/*'

  reset_wt
  mkdir -p "$wt/tests/visual/catalog.spec.ts-snapshots"
  printf '%s\n' 'baseline' > "$wt/tests/visual/catalog.spec.ts-snapshots/card.png"
  stage_patch "$patches/baseline.patch"
  guard "agent-guard: screenshot baseline blocked" 1 "$patches/baseline.patch" 'tests/*'

  reset_wt
  printf '\n# gate\n' >> "$wt/scripts/agent-guard.sh"
  stage_patch "$patches/self.patch"
  guard "agent-guard: agent-guard.sh blocked with scripts/*" 1 "$patches/self.patch" 'scripts/*'

  reset_wt
  mkdir -p "$wt/tests/api"
  printf '%s\n' 'test("gate", () => {})' > "$wt/tests/api/gate.spec.ts"
  printf '%s\n' 'gate note' >> "$wt/FINDINGS.md"
  stage_patch "$patches/tests.patch"
  guard "agent-guard: tests and FINDINGS.md" 0 "$patches/tests.patch" 'tests/*' 'FINDINGS.md'
}

hook_check() {
  name=$1
  expect=$2
  cmd=$3
  how=$4
  script=$5
  out=$(printf '%s\n' "{\"command\":\"$cmd\"}" | "$how" "$script" 2>&1) || true
  case "$out" in
    *'"permission":"'"$expect"'"'*) say_pass "$name" ;;
    *) say_fail "$name" ;;
  esac
}

check_hooks() {
  base="$root/.cursor/hooks/guard-baselines.mjs"
  approve="$root/.cursor/hooks/guard-approvals.sh"
  if ! command -v node >/dev/null 2>&1; then
    say_fail "hook baselines: deny update-snapshots (node is not available)"
    say_fail "hook baselines: deny -u (node is not available)"
    say_fail "hook baselines: allow npm run test:pw (node is not available)"
  else
    hook_check "hook baselines: deny update-snapshots" deny \
      "npx playwright test --update-snapshots" node "$base"
    hook_check "hook baselines: deny -u" deny \
      "npx playwright test -u" node "$base"
    hook_check "hook baselines: allow npm run test:pw" allow \
      "npm run test:pw" node "$base"
  fi

  hook_check "hook approvals: deny label" deny \
    "gh pr edit 7 --add-label plan-approved" bash "$approve"
  hook_check "hook approvals: deny merge" deny \
    "gh pr merge 7" bash "$approve"
  hook_check "hook approvals: deny approve" deny \
    "gh pr review 7 --approve" bash "$approve"
  hook_check "hook approvals: deny printenv" deny \
    "printenv" bash "$approve"
  hook_check "hook approvals: allow gh pr view" allow \
    "gh pr view 7" bash "$approve"
  hook_check "hook approvals: allow git diff" allow \
    "git diff origin/init...HEAD" bash "$approve"
}

check_workflows() {
  triage="$root/.github/workflows/pr-triage.yml"

  targets=$(awk '
    function decomment(s,    i, c, q, out, prev) {
      q = 0
      out = ""
      prev = ""
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (c == "\"" && prev != "\\") q = !q
        if (c == "#" && !q) break
        out = out c
        prev = c
      }
      return out
    }
    {
      sub(/\r$/, "")
      line = decomment($0)
      if (line ~ /pull_request_target/) print FILENAME ":" FNR
    }
  ' "$root"/.github/workflows/*.yml)
  if [ -n "$targets" ]; then
    say_fail "workflow: no pull_request_target trigger ($targets)"
  else
    say_pass "workflow: no pull_request_target trigger"
  fi

  jobs=$(awk '
    function decomment(s,    i, c, q, out, prev) {
      q = 0
      out = ""
      prev = ""
      for (i = 1; i <= length(s); i++) {
        c = substr(s, i, 1)
        if (c == "\"" && prev != "\\") q = !q
        if (c == "#" && !q) break
        out = out c
        prev = c
      }
      return out
    }
    function finish() {
      if (job == "") return
      n++
      if (!timed) missing = missing job " "
      if (body ~ /run-agent\.sh/) {
        agents++
        if (body ~ /GH_TOKEN/ || body ~ /GITHUB_TOKEN/) token_bad = token_bad job " "
        if (body !~ /persist-credentials:[[:space:]]*false/) cred_bad = cred_bad job " "
        if (body ~ /persist-credentials:[[:space:]]*true/) cred_true = cred_true job " "
      }
      if (job == "tests") tests_if_found = tests_if
    }
    {
      sub(/\r$/, "")
      raw = decomment($0)
    }
    /^jobs:/ { in_jobs = 1; next }
    in_jobs && /^[^ \t]/ { finish(); in_jobs = 0 }
    in_jobs && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ {
      finish()
      job = raw
      sub(/^  /, "", job)
      sub(/:[[:space:]]*$/, "", job)
      timed = 0
      body = ""
      next
    }
    in_jobs && job != "" {
      body = body raw "\n"
      if (raw ~ /^    timeout-minutes:/) timed = 1
      if (job == "tests" && raw ~ /^    if:/) tests_if = raw
    }
    END {
      if (in_jobs) finish()
      printf "jobs=%d\n", n + 0
      printf "missing=%s\n", missing
      printf "agents=%d\n", agents + 0
      printf "token_bad=%s\n", token_bad
      printf "cred_bad=%s\n", cred_bad
      printf "cred_true=%s\n", cred_true
      printf "tests_if=%s\n", tests_if_found
    }
  ' "$triage")

  jobs_n=$(printf '%s\n' "$jobs" | awk -F= '$1=="jobs"{print $2}')
  missing=$(printf '%s\n' "$jobs" | awk -F= '$1=="missing"{sub(/^[^=]*=/,""); sub(/[[:space:]]+$/,""); print}')
  agents=$(printf '%s\n' "$jobs" | awk -F= '$1=="agents"{print $2}')
  token_bad=$(printf '%s\n' "$jobs" | awk -F= '$1=="token_bad"{sub(/^[^=]*=/,""); sub(/[[:space:]]+$/,""); print}')
  cred_bad=$(printf '%s\n' "$jobs" | awk -F= '$1=="cred_bad"{sub(/^[^=]*=/,""); sub(/[[:space:]]+$/,""); print}')
  cred_true=$(printf '%s\n' "$jobs" | awk -F= '$1=="cred_true"{sub(/^[^=]*=/,""); sub(/[[:space:]]+$/,""); print}')
  tests_if=$(printf '%s\n' "$jobs" | awk -F= '$1=="tests_if"{sub(/^[^=]*=/,""); print}')

  if [ "${jobs_n:-0}" -ge 1 ] && [ -z "$missing" ]; then
    say_pass "workflow: every pr-triage job has timeout-minutes"
  else
    say_fail "workflow: every pr-triage job has timeout-minutes (${missing:-no jobs})"
  fi

  if [ "${agents:-0}" -ge 1 ] && [ -z "$token_bad" ]; then
    say_pass "workflow: agent jobs have no GitHub token"
  else
    say_fail "workflow: agent jobs have no GitHub token (${token_bad:-no agent job})"
  fi

  if [ "${agents:-0}" -ge 1 ] && [ -z "$cred_bad" ] && [ -z "$cred_true" ]; then
    say_pass "workflow: agent checkout persist-credentials false"
  else
    say_fail "workflow: agent checkout persist-credentials false (${cred_bad:-}${cred_true:-})"
  fi

  case "$tests_if" in
    *plan-approved*)
      case "$tests_if" in
        *"github.event.sender.type == 'User'"*)
          say_pass "workflow: tests job needs plan-approved by a person"
          ;;
        *)
          say_fail "workflow: tests job needs plan-approved by a person"
          ;;
      esac
      ;;
    *)
      say_fail "workflow: tests job needs plan-approved by a person"
      ;;
  esac
}

check_agent_guard
check_hooks
check_workflows

exit "$fail"
