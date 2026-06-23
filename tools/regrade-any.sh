#!/usr/bin/env bash
# De-confound any skill's bench: re-grade its saved GREEN transcripts with a NEUTRAL judge,
# WITHOUT re-running any model. Non-destructive — writes into results/<tag>/regrade-<judge>/.
# Use whenever the official judge sits inside the model set (e.g. opus judging opus): if the
# ranking holds under a different judge it's real; if it shifts, it was the grader's preference.
# Usage:  JUDGE=sonnet ./tools/regrade-any.sh <skill>/tests
set -uo pipefail
td="${1:?usage: JUDGE=sonnet ./tools/regrade-any.sh <skill>/tests}"; td="${td%/}"
JUDGE="${JUDGE:-sonnet}"
[ -x "$td/grade.sh" ] || { echo "no grade.sh in $td" >&2; exit 1; }
echo "### Re-grading $(basename "$(dirname "$td")") with neutral judge: $JUDGE ###"
shopt -s nullglob
for mdir in "$td"/results/*/; do
  tag="$(basename "$mdir")"
  d="$(ls -dt "$mdir"*/ 2>/dev/null | grep -v '/regrade-' | head -1)"
  [ -z "$d" ] && continue
  rg="${mdir%/}/regrade-$JUDGE"; rm -rf "$rg"; mkdir -p "$rg"
  cp "$d"*.green.txt "$rg"/ 2>/dev/null || true
  [ -z "$(ls -A "$rg" 2>/dev/null)" ] && { echo "  $tag: no green transcripts"; continue; }
  echo ">>> $tag  (from ${d})"
  JUDGEMODEL="$JUDGE" "$td/grade.sh" "$rg" 2>&1 | grep -E 'GREEN [0-9]|GRADE:|resembles' || true
done
