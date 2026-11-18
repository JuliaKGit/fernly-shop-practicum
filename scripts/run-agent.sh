#!/usr/bin/env bash
# Runs the Cursor agent headless and keeps it visible in the CI log:
# one line per tool call while it works (a stuck command is the last line),
# every event saved to the trail file (uploaded even when the step times out),
# and only the agent's final message written to the result file.
#   bash scripts/run-agent.sh <prompt-file> <result-file> <trail-file>
set -euo pipefail
prompt_file="${1:?usage: run-agent.sh <prompt-file> <result-file> <trail-file>}"
result_file="${2:?usage: run-agent.sh <prompt-file> <result-file> <trail-file>}"
trail_file="${3:?usage: run-agent.sh <prompt-file> <result-file> <trail-file>}"

# Line-buffer so a command that never returns is the last line in the log, not stuck in a pipe buffer.
stream_log() {
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL tee "$trail_file"
  else
    tee "$trail_file"
  fi
}

run_agent() {
  if command -v stdbuf >/dev/null 2>&1; then
    stdbuf -oL agent -p --force --trust --output-format stream-json -- "$(<"$prompt_file")"
  else
    agent -p --force --trust --output-format stream-json -- "$(<"$prompt_file")"
  fi
}

run_agent \
  | stream_log \
  | jq -Rrc --unbuffered 'fromjson? |
      if .type == "tool_call" and .subtype == "started" then "→ " + (.tool_call | tostring | .[0:300])
      elif .type == "assistant" then "· " + ((.message.content // []) | map(.text // "") | join("") | gsub("\n"; " ") | .[0:200])
      else empty end'

jq -Rrs '
  ([split("\n")[] | fromjson? | select(.type == "assistant")]) as $msgs
  | if ($msgs | length) == 0 then ""
    else ($msgs | last | .message.content // [] | map(.text // "") | join(""))
    end
' "$trail_file" > "$result_file"
