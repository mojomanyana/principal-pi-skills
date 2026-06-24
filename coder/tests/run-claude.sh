#!/usr/bin/env bash
#
# run-claude.sh — fire a coder scenario at Claude via the `claude` CLI.
# Uses your Claude Code login (Max/Pro subscription) — NO per-token API billing,
# provided ANTHROPIC_API_KEY is unset.
#
# Usage: ./run-claude.sh <scenario> <mode>     mode: red | green | force
#   red          baseline, no skill
#   green/force  inject the skill body via --append-system-prompt (controlled behavior test;
#                headless Claude Code can't reliably auto-activate a discovered skill, so for
#                Claude "green" == "force" — treat Claude as a reference lens, not a like-for-
#                like port of the Pi --skill run)
# Env: CMODEL (opus|sonnet|haiku, default opus) ; SKILL ; VERBOSE=1 ; DRYRUN=1
#
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/cases.sh"

SKILL="${SKILL:-$(cd "$here/.." && pwd)}"   # the skill dir = parent of tests/
CMODEL="${CMODEL:-opus}"

command -v claude >/dev/null || { echo "error: 'claude' not on PATH" >&2; exit 1; }
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  echo "⚠ ANTHROPIC_API_KEY is set — claude may bill the API instead of your Max plan." >&2
  echo "  run 'unset ANTHROPIC_API_KEY' first to use the subscription." >&2
fi

scenario="${1:-}"; mode="${2:-}"
if [ -z "$scenario" ] || [ -z "$mode" ]; then echo "usage: ./run-claude.sh <scenario> <red|green|force>" >&2; exit 1; fi
scenario="${scenario^^}"; mode="${mode,,}"
load_turns "$scenario"
[ "${#turns[@]}" -eq 0 ] && { echo "error: unknown scenario '$scenario'" >&2; exit 1; }

sys=()
case "$mode" in
  red) :;;
  green|force) sys=(--append-system-prompt "$(cat "$SKILL/SKILL.md")");;
  *) echo "error: unknown mode '$mode' (red|green|force)" >&2; exit 1;;
esac

common=(-p --disable-slash-commands --model "$CMODEL" --output-format text)
if [ "${VERBOSE:-}" = "1" ]; then common+=(--verbose); fi

echo "=============================================================="
echo " scenario : $scenario      mode: $mode"
echo " runner   : claude (Max)   model: $CMODEL"
echo " turns    : ${#turns[@]}"
echo "=============================================================="
cd /tmp   # neutral dir: avoid the repo's CLAUDE.md / project context

if [ "${DRYRUN:-}" = "1" ]; then
  echo "[dry-run] would run: claude -p --model $CMODEL  (${#turns[@]} turn(s), mode=$mode)"; exit 0
fi

if [ "${#turns[@]}" -eq 1 ]; then
  echo ">>> user: ${turns[0]}"; echo "----"
  claude "${common[@]}" "${sys[@]}" "${turns[0]}"
else
  sid="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen 2>/dev/null)"
  n=1
  for t in "${turns[@]}"; do
    echo ""; echo ">>> user turn $n: $t"; echo "----"
    if [ "$n" -eq 1 ]; then
      claude "${common[@]}" "${sys[@]}" --session-id "$sid" "$t"
    else
      claude "${common[@]}" "${sys[@]}" --resume "$sid" "$t"
    fi
    n=$((n + 1))
  done
fi
echo ""; echo "→ score against ${scenario}'s checklist in scenarios.md."
