#!/usr/bin/env bash
# Read a patch and refuse it unless every file is allowed.
# Shop code, workflow, and test evidence stay with a person. An empty patch is fine.
# Bash 3.2: no arrays and no globstar.
#   bash scripts/agent-guard.sh <patch> <allowed pattern>...
set -eu

if [ $# -lt 2 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  echo "usage: agent-guard.sh <patch> <allowed pattern>..." >&2
  exit 1
fi

patch=$1
shift

if [ ! -f "$patch" ]; then
  echo "agent-guard: no patch file at $patch" >&2
  exit 1
fi

if [ ! -s "$patch" ]; then
  exit 0
fi

refused=0

refuse() {
  printf 'agent-guard: %s (%s)\n' "$1" "$2" >&2
  refused=1
}

# A symlink or a submodule keeps an allowed name and points somewhere else.
prev=""
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    "diff --git "*)
      prev=$line
      ;;
    "new file mode 120000"|"new mode 120000"|"old file mode 120000"|"old mode 120000"|"deleted file mode 120000"|"new file mode 160000"|"new mode 160000"|"old mode 160000"|"deleted file mode 160000")
      refuse "${prev#diff --git }" "symlink or submodule"
      ;;
  esac
done < "$patch"

normalize_path() {
  input=$1
  case "$input" in
    ""|/*|*\\*) return 1 ;;
    [A-Za-z]:*) return 1 ;;
  esac
  result=""
  rest=$input
  while [ -n "$rest" ]; do
    seg=${rest%%/*}
    case "$rest" in
      */*) rest=${rest#*/} ;;
      *) rest="" ;;
    esac
    case "$seg" in
      ""|.)
        ;;
      ..)
        case "$result" in
          "") return 1 ;;
          */*) result=${result%/*} ;;
          *) result="" ;;
        esac
        ;;
      *)
        case "$result" in
          "") result=$seg ;;
          *) result=$result/$seg ;;
        esac
        ;;
    esac
  done
  [ -n "$result" ] || return 1
  printf '%s\n' "$result"
}

person_only() {
  path=$1
  base=${path##*/}
  case "$base" in
    package.json|package-lock.json|playwright.config.ts|cypress.config.ts|a11y-baseline.json|.env|.env.*)
      return 0
      ;;
  esac
  case "$path" in
    web/src|web/src/*|api/src|api/src/*|.github|.github/*|.cursor|.cursor/*|scripts|scripts/*)
      return 0
      ;;
    web/cypress.config.ts)
      return 0
      ;;
    web/cypress/screenshots|web/cypress/screenshots/*|web/cypress/results|web/cypress/results/*)
      return 0
      ;;
    cypress/screenshots|cypress/screenshots/*|cypress/results|cypress/results/*)
      return 0
      ;;
  esac
  rest=$path
  while [ -n "$rest" ]; do
    seg=${rest%%/*}
    case "$seg" in
      *-snapshots) return 0 ;;
    esac
    case "$rest" in
      */*) rest=${rest#*/} ;;
      *) break ;;
    esac
  done
  return 1
}

allowed_path() {
  path=$1
  shift
  for pattern in "$@"; do
    # Unquoted so * matches, including slashes (case patterns are not pathname expansion).
    case "$path" in
      $pattern) return 0 ;;
    esac
  done
  return 1
}

unquote() {
  s=$1
  case $s in
    \"*\")
      s=${s#\"}
      s=${s%\"}
      ;;
  esac
  printf '%s\n' "$s"
}

# git numstat prints "old => new" or "prefix{old => new}suffix".
paths_from_field() {
  field=$1
  case "$field" in
    *" => "*)
      left=${field%% => *}
      right=${field#* => }
      case "$left" in
        *\{*)
          prefix=${left%\{*}
          oldmid=${left##*\{}
          newmid=${right%%\}*}
          suffix=${right#*\}}
          unquote "${prefix}${oldmid}${suffix}"
          unquote "${prefix}${newmid}${suffix}"
          ;;
        *)
          unquote "$left"
          unquote "$right"
          ;;
      esac
      ;;
    *)
      unquote "$field"
      ;;
  esac
}

check_one() {
  raw=$1
  shift
  if ! norm=$(normalize_path "$raw"); then
    refuse "$raw" "path escapes the repository"
    return
  fi
  if person_only "$norm"; then
    refuse "$norm" "only a person may change this"
    return
  fi
  if ! allowed_path "$norm" "$@"; then
    refuse "$norm" "outside the allowed patterns"
  fi
}

numstat=$(mktemp)
pathlist=$(mktemp)
trap 'rm -f "$numstat" "$pathlist"' EXIT

if ! git apply --numstat -- "$patch" > "$numstat"; then
  echo "agent-guard: cannot list files in $patch" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  [ -z "$line" ] && continue
  case "$line" in
    *"	"*"	"*) ;;
    *)
      refuse "$line" "not a numstat line"
      continue
      ;;
  esac
  field=${line#*	}
  field=${field#*	}
  paths_from_field "$field" > "$pathlist"
  while IFS= read -r raw || [ -n "$raw" ]; do
    [ -z "$raw" ] && continue
    check_one "$raw" "$@"
  done < "$pathlist"
done < "$numstat"

exit "$refused"
