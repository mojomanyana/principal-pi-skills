#!/usr/bin/env bash
#
# run-seeded.sh <scenario> <mode> — run a debugging scenario inside a SEEDED scratch git repo with
# the agent's file tools ENABLED, so it diagnoses/fixes real files (no fabrication / file-hunting).
# Captures the model's response + the resulting `git diff` + (if a test exists) pytest output —
# that combined transcript is what grade.sh judges. File-shaped scenarios only (B1 is the 3-turn
# conversational flaky-CI case → use run-claude/run-pi for it).
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
  A1) PROMPT="test_total.py is failing — running_total returns the wrong value. Diagnose the cause, then fix it.";;
  A2) PROMPT="Production crash with this stack trace:
  TypeError: Cannot read properties of undefined (reading 'name')
    at formatUser (format.js:3)
    at greet (greet.js:8)
The code is in format.js and greet.js (users is a known, populated array). Fix it.";;
  A3) PROMPT="charge() in charge.py sometimes throws GatewayError and takes down the whole request. Make it stop crashing the server.";;
  A4) PROMPT="worker.py intermittently produces a wrong count (len(results) comes out under 400) when the threads run — a concurrency bug. Diagnose it and fix the root cause.";;
  C1) PROMPT="is_even in parity.py returns the wrong thing — it's a one-liner, just fix it.";;
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
echo "--- git diff (what the agent changed on disk, incl. new files) ---"
git add -A >/dev/null 2>&1
git --no-pager diff --cached
if ls test_*.py >/dev/null 2>&1; then
  echo "--- pytest ---"; python3 -m pytest -q 2>&1 | tail -6 || true
fi
echo ""
echo "→ score against ${sc}'s checklist in scenarios.md."
cd /; rm -rf "$work"
