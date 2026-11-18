#!/bin/sh
# beforeShellExecution: only a person merges, approves, labels, or reads secrets.
# Anything else is allowed. Always print JSON so a crash does not fail closed on every command.
printed=0
finish() {
  if [ "$printed" -eq 0 ]; then
    printf '%s\n' '{"permission":"allow"}'
  fi
}
trap finish EXIT

input=$(cat || true)

deny() {
  printed=1
  trap - EXIT
  printf '{"permission":"deny","user_message":"%s","agent_message":"%s"}\n' "$1" "$1"
  exit 0
}

allow() {
  printed=1
  trap - EXIT
  printf '%s\n' '{"permission":"allow"}'
  exit 0
}

# Value of the JSON "command" field. Cursor sends one object on stdin.
extract_command() {
  json=$1
  case "$json" in
    *'"command"'*) ;;
    *) return 0 ;;
  esac
  rest=${json#*'"command"'}
  lead=${rest%%[![:space:]:]*}
  rest=${rest#"$lead"}
  first=$(printf '%.1s' "$rest")
  [ "$first" = '"' ] || return 0
  rest=${rest#\"}
  out=
  while [ -n "$rest" ]; do
    c=$(printf '%.1s' "$rest")
    rest=${rest#?}
    case "$c" in
      '"') break ;;
      '\')
        n=$(printf '%.1s' "$rest")
        rest=${rest#?}
        case "$n" in
          n) out="${out}
" ;;
          '"') out="${out}\"" ;;
          '\') out="${out}\\" ;;
          *) out="${out}${n}" ;;
        esac
        ;;
      *) out="${out}${c}" ;;
    esac
  done
  printf '%s' "$out"
}

# printenv, or env with only flags and assignments, prints the environment.
is_env_dump() {
  set -f
  # shellcheck disable=SC2086
  set -- $1
  set +f
  while [ "$#" -gt 0 ]; do
    case "$1" in
      *=*) shift ;;
      *) break ;;
    esac
  done
  if [ "$#" -gt 0 ] && { [ "$1" = "command" ] || [ "$1" = "builtin" ]; }; then
    shift
  fi
  [ "$#" -gt 0 ] || return 1
  base=${1##*/}
  if [ "$base" = "printenv" ]; then
    return 0
  fi
  [ "$base" = "env" ] || return 1
  shift
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -u|--unset|-C|--chdir)
        shift
        if [ "$#" -gt 0 ]; then
          shift
        fi
        ;;
      --unset=*|--chdir=*) shift ;;
      -*) shift ;;
      *=*) shift ;;
      *) return 1 ;;
    esac
  done
  return 0
}

command=$(extract_command "$input" || true)

case "$command" in
  *'$CURSOR_API_KEY'*|*'${CURSOR_API_KEY'*|*'${CURSOR_API_KEY}'*| \
    *'$GITHUB_TOKEN'*|*'${GITHUB_TOKEN'*|*'${GITHUB_TOKEN}'*| \
    *'$GH_TOKEN'*|*'${GH_TOKEN'*|*'${GH_TOKEN}'*)
    deny "Only a person reads CURSOR_API_KEY, GH_TOKEN, or GITHUB_TOKEN."
    ;;
esac

# Split on &&, ||, ;, | and & so each program is checked on its own.
rest=$command
seg=
while [ -n "$rest" ] || [ -n "$seg" ]; do
  pair=$(printf '%.2s' "$rest")
  one=$(printf '%.1s' "$rest")
  if [ "$pair" = "&&" ] || [ "$pair" = "||" ]; then
    if is_env_dump "$seg"; then
      deny "Only a person prints the environment."
    fi
    seg=
    rest=${rest#??}
    continue
  fi
  case "$one" in
    ';'|'|'|'&'|'')
      if is_env_dump "$seg"; then
        deny "Only a person prints the environment."
      fi
      seg=
      if [ -z "$rest" ]; then
        break
      fi
      rest=${rest#?}
      ;;
    *)
      seg=$seg$one
      rest=${rest#?}
      ;;
  esac
done

case "$command" in
  *"gh pr merge"*)
    deny "Only a person merges a pull request."
    ;;
esac
case "$command" in
  *"gh pr review"*)
    case "$command" in
      *"--approve"*)
        deny "Only a person approves a pull request."
        ;;
    esac
    ;;
esac
case "$command" in
  *"--add-label"*)
    case "$command" in
      *"gh pr edit"*|*"gh issue edit"*)
        deny "Only a person adds a label."
        ;;
    esac
    ;;
esac
case "$command" in
  *"gh label "*|*"gh label")
    deny "Only a person adds a label."
    ;;
esac
case "$command" in
  *"gh api "*)
    case "$command" in
      *"/labels"*|*"addLabelsToLabelable"*)
        deny "Only a person adds a label."
        ;;
    esac
    case "$command" in
      *"/merge"*|*"/reviews"*|*"mergePullRequest"*|*"addPullRequestReview"*|*"submitPullRequestReview"*)
        deny "Only a person merges or reviews a pull request."
        ;;
    esac
    ;;
esac

allow
