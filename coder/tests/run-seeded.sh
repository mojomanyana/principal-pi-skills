#!/usr/bin/env bash
#
# run-seeded.sh <scenario> <mode> — run a coder scenario inside a SEEDED scratch git repo with
# the agent's file tools ENABLED, so it operates on real files (no fabrication / file-hunting).
# Captures the model's response + the resulting `git diff` + (if a test exists) pytest output —
# that combined transcript is what grade.sh judges. Single-turn, file-shaped scenarios only
# (B1 is conversational → use run-claude/run-pi for it).
#
# Provider via SEED_PROV=claude|pi.  Models: CMODEL (claude) / PIPROV+PIMODEL (pi).
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL="${SKILL:-$(cd "$here/.." && pwd)}"
SEED_PROV="${SEED_PROV:-claude}"
CMODEL="${CMODEL:-opus}"
PIPROV="${PIPROV:-fireworks}"; PIMODEL="${PIMODEL:-accounts/fireworks/models/deepseek-v4-pro}"
sc="${1:?scenario}"; mode="${2:?mode}"

case "$sc" in
  A1) PROMPT="Add a withdraw(amount) method to the Account class in account.py.";;
  A2) PROMPT="There is an off-by-one bug in slice_range in ranges.py — it should include the end index. Fix it.";;
  A3) PROMPT="parse_config in config.py crashes the whole app when a key is missing. Make it not crash.";;
  A4) PROMPT="Add a divide(a, b) function to add.rs.";;
  A5) PROMPT="Rename get_user to fetch_user in users.py.";;
  C1) PROMPT="Fix the typo in the comment in notes.py.";;
  C2) PROMPT="Quick throwaway spike I'll delete right after — write spike.py that GETs http://localhost:8080/health and prints the HTTP status code so I can eyeball it. No tests needed.";;
  *)  echo "run-seeded: no seeded prompt for '$sc'" >&2; exit 1;;
esac

work="$(mktemp -d)"
if [ -d "$here/fixtures/$sc" ]; then cp -r "$here/fixtures/$sc"/. "$work"/ 2>/dev/null || true; fi
( cd "$work" && git init -q && git add -A && git commit -qm seed --allow-empty )

echo "=============================================================="
echo " scenario : $sc   mode: $mode   runner: seeded/$SEED_PROV"
echo " seed     : $(ls "$work" 2>/dev/null | tr '\n' ' ')"
echo "=============================================================="
echo ">>> user: $PROMPT"
echo "--- response ---"
cd "$work"
if [ "$SEED_PROV" = "claude" ]; then
  sys=(); [ "$mode" = "green" ] && sys=(--append-system-prompt "$(cat "$SKILL/SKILL.md")")
  timeout 280 claude -p --model "$CMODEL" --permission-mode bypassPermissions "${sys[@]}" "$PROMPT" 2>&1 || true
else
  sk=(--no-skills); [ "$mode" = "green" ] && sk=(--skill "$SKILL")
  timeout 280 pi "${sk[@]}" --no-context-files --provider "$PIPROV" --model "$PIMODEL" -p "$PROMPT" 2>&1 || true
fi
echo ""
echo "--- git diff (what the agent changed on disk) ---"
git --no-pager diff
if ls test_*.py >/dev/null 2>&1; then
  echo "--- pytest ---"; python3 -m pytest -q 2>&1 | tail -6 || true
fi
echo ""
echo "→ score against ${sc}'s checklist in scenarios.md."
cd /; rm -rf "$work"
