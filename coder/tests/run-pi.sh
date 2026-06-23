#!/usr/bin/env bash
#
# run-pi.sh — fire a coder test scenario at Pi in RED / GREEN / FORCE mode.
# Prompts live in cases.sh (shared with run-claude.sh).
#
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$here/cases.sh"

SKILL="${SKILL:-$(cd "$here/.." && pwd)}"   # the skill dir = parent of tests/
PIPROV="${PIPROV:-fireworks}"
PIMODEL="${PIMODEL:-accounts/fireworks/models/deepseek-v4-pro}"

usage() {
  cat >&2 <<'EOF'
run-pi.sh — fire a coder test scenario at Pi.

Usage: ./run-pi.sh <scenario> <mode>
  scenario : A1 A2 A3 A4 A5 A6 A7   B1 B2 B3   C1 C2 D1
  mode     : red | green | force

Env (defaults): SKILL, PIPROV=fireworks, PIMODEL=accounts/fireworks/models/deepseek-v4-pro
                PITHINK (-> --thinking), VERBOSE=1 (-> --verbose), INTERACTIVE=1 (multi-turn by hand)
EOF
}

command -v pi >/dev/null || { echo "error: 'pi' not on PATH" >&2; exit 1; }

scenario="${1:-}"; mode="${2:-}"
if [ -z "$scenario" ] || [ -z "$mode" ]; then usage; exit 1; fi
scenario="${scenario^^}"; mode="${mode,,}"

load_turns "$scenario"
[ "${#turns[@]}" -eq 0 ] && { echo "error: unknown scenario '$scenario'" >&2; usage; exit 1; }

case "$mode" in
  red)   skill_flags=(--no-skills); tag="RED   (baseline, no skill)";;
  green) skill_flags=(--skill "$SKILL"); tag="GREEN (with skill)";;
  force) skill_flags=(--no-skills --append-system-prompt "$(cat "$SKILL/SKILL.md")"); tag="FORCE (skill body injected)";;
  *) echo "error: unknown mode '$mode' (use red|green|force)" >&2; usage; exit 1;;
esac

common=(--no-context-files --provider "$PIPROV" --model "$PIMODEL")
if [ -n "${PITHINK:-}" ]; then common+=(--thinking "$PITHINK"); fi
if [ "${VERBOSE:-}" = "1" ]; then common+=(--verbose); fi

echo "=============================================================="
echo " scenario : $scenario      mode: $tag"
echo " runner   : pi    model: $PIPROV / $PIMODEL"
echo " turns    : ${#turns[@]}"
echo "=============================================================="
cd /tmp

if [ "${#turns[@]}" -eq 1 ]; then
  echo ">>> user: ${turns[0]}"; echo "--------------------------------------------------------------"
  pi "${skill_flags[@]}" "${common[@]}" --no-session -p "${turns[0]}"
elif [ "${INTERACTIVE:-}" = "1" ]; then
  echo "Interactive multi-turn — paste these user turns ONE AT A TIME:"
  i=1; for t in "${turns[@]}"; do echo "  [$i] $t"; i=$((i + 1)); done
  echo "--------------------------------------------------------------"
  pi "${skill_flags[@]}" "${common[@]}" --no-session
else
  sess="$(mktemp -d)"; n=1
  for t in "${turns[@]}"; do
    echo ""; echo ">>> user turn $n: $t"; echo "--------------------------------------------------------------"
    if [ "$n" -eq 1 ]; then
      pi "${skill_flags[@]}" "${common[@]}" --session-dir "$sess" -p "$t"
    else
      pi "${skill_flags[@]}" "${common[@]}" --session-dir "$sess" -c -p "$t"
    fi
    n=$((n + 1))
  done
fi
echo ""; echo "→ score against ${scenario}'s checklist in scenarios.md."
