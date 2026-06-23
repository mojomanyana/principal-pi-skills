#!/usr/bin/env bash
#
# bench.sh — run the debugging suite across several models, grade each, and compare.
# DeepSeek/others go through Pi; Claude reference models go through the `claude` CLI on your
# Max plan (no API billing). Each model gets its own REPORT.md; a COMPARISON.md is written too.
#
# Usage: ./bench.sh [token ...]
#   token = provider:model      e.g.  fireworks:accounts/fireworks/models/deepseek-v4-pro
#           claude:<alias>       e.g.  claude:opus   claude:haiku   (runs via Claude Code / Max)
#   no args → default set: DeepSeek v4-pro (Pi) + Claude Opus + Claude Haiku (Max)
#
# Env: BENCHMODE=green(default)|both ; JUDGE_CLI/JUDGEMODEL (grader, default claude/sonnet on Max)
#      PITHINK, VERBOSE, DRYRUN=1
#
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEFAULT=(
  "fireworks:accounts/fireworks/models/deepseek-v4-pro"
  "claude:opus"
  "claude:haiku"
)
if [ "$#" -gt 0 ]; then
  pairs=("$@")                                   # explicit args win
elif [ -f "$here/models.txt" ]; then
  mapfile -t pairs < <(grep -vE '^[[:space:]]*(#|$)' "$here/models.txt")   # one provider:model per line
else
  pairs=("${DEFAULT[@]}")
fi
benchmode="${BENCHMODE:-green}"

echo "================================================================"
echo " benchmark : ${#pairs[@]} models   mode: $benchmode   judge: ${JUDGE_CLI:-claude}/${JUDGEMODEL:-sonnet}"
for pm in "${pairs[@]}"; do echo "   - $pm"; done
[ "${DRYRUN:-}" = "1" ] && echo " DRYRUN    : on (no model calls)"
echo "================================================================"
echo ""

for pm in "${pairs[@]}"; do
  prov="${pm%%:*}"; model="${pm#*:}"
  echo "################  $pm  ################"
  if [ "$prov" = "claude" ]; then
    RUNNER=claude CMODEL="$model" "$here/run-all.sh" "$benchmode" || echo "(run-all reported errors for $pm)"
    tag="$(printf '%s' "claude-$model" | tr '/ :' '___')"
  else
    PIPROV="$prov" PIMODEL="$model" "$here/run-all.sh" "$benchmode" || echo "(run-all reported errors for $pm)"
    tag="$(printf '%s' "$model" | tr '/ :' '___')"
  fi
  d="$(ls -1dt "$here/results/$tag/"*/ 2>/dev/null | head -1)"
  if [ -n "$d" ]; then "$here/grade.sh" "$d" || echo "(grade reported errors for $pm)"; else echo "(no results dir for $pm — skipping grade)"; fi
  echo ""
done

echo "################  COMPARISON  ################"
"$here/compare.sh"
