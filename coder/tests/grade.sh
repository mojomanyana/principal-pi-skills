#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of coder transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>
#
# Judge = opus via the claude CLI (your Max plan, no API billing) — the default below.
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
# Writes GRADES.tsv + REPORT.md into the dir, prints a scorecard. Checklists mirror scenarios.md.
#
set -uo pipefail

dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"
JUDGEMODEL="${JUDGEMODEL:-opus}"
JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A2 A3 C1 C2 "

[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) a regression test covering withdraw — at least the overdraft / insufficient-funds case — is present in the final diff and PASSES (pytest green); (2) withdraw is implemented correctly and rejects overdrawing (raises/refuses when amount > balance). Grade ONLY what is observable in the final diff + pytest; do NOT require the test to be shown failing first — the harness captures only the end state.";;
    A2) echo "(1) fixes ONLY slice_range; (2) does NOT modify format_date — names it as an out-of-scope observation/follow-up instead of changing it.";;
    A3) echo "(1) handles the missing-key case meaningfully (validation, a clear error, or a documented default); (2) does NOT use a blanket try/except-pass or any catch-all that hides the cause.";;
    A4) echo "(1) returns Result<.., MathError> with no panic/unwrap, handling divide-by-zero as an Err; (2) matches the codebase style (snake_case, same shape as add).";;
    A5) echo "(1) updates the call sites too, OR explicitly enumerates them as needing the update; (2) does not rename only the definition while leaving callers silently broken.";;
    B1) echo "(1) holds across all turns: still provides or insists on at least a minimal test, OR explicitly flags the risk and labels the code untested; (2) does NOT silently drop tests as if that were normal; (3) stays useful — delivers the function; if the user truly insists, ships with an explicit UNTESTED marker, not a silent skip.";;
    C1) echo "(1) just makes the one-line typo fix; (2) does NOT write a test plan, run a scope analysis, or lecture about process for a one-word comment typo.";;
    C2) echo "(1) respects the throwaway — produces the spike quickly; (2) at most a one-line 'PROTOTYPE / no tests' flag; does NOT refuse or force full TDD on an explicit throwaway.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using a "coder" skill — it implements code
with TDD (red-first), scope discipline (fix only what was asked, flag the rest), matching the
codebase's conventions, and no error-suppression; WITHOUT over-ceremony on trivial changes or
explicit throwaway prototypes. Judge it ONLY against the checklist below — do not add
requirements beyond it.

CHECKLIST (every numbered item must hold for a PASS):
$(checklist "$1")

TRANSCRIPT (the assistant is the model under test):
$2

Grade each checklist item PASS or FAIL with a <=12-word justification quoting the transcript.
Be skeptical: if an item is not clearly satisfied, mark it FAIL. Then output these two lines:
VERDICT: PASS      (only if EVERY item passed)   — or —   VERDICT: FAIL
REASON: <15 words or fewer>
JUDGE_EOF
}

run_judge() {  # stdin: prompt ; echoes judge output
  if [ "$JUDGE_CLI" = "claude" ]; then
    ( cd /tmp && claude -p --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
  else
    pi --no-skills --no-context-files --no-session --provider "$JUDGEPROV" --model "$JUDGEMODEL" -p "$(cat)" 2>/dev/null || true
  fi
}

modeltag="$(basename "$(dirname "$dir")")"
jtag="$(printf '%s' "$JUDGEMODEL" | tr '/ :' '___')"
case "$modeltag" in *"$jtag"*) echo "  ⚠ judge ($JUDGEMODEL) resembles the model under test — use a different judge for an honest grade.";; esac

grades="$dir/GRADES.tsv"; printf 'scenario\tmode\tverdict\treason\n' > "$grades"
shopt -s nullglob
files=("$dir"/*.txt)
[ "${#files[@]}" -eq 0 ] && { echo "error: no *.txt transcripts in $dir" >&2; exit 1; }

echo "  grading $dir  (judge: $JUDGE_CLI/$JUDGEMODEL)"
for f in "${files[@]}"; do
  base="$(basename "$f" .txt)"; sc="${base%%.*}"; mode="${base##*.}"
  [ -z "$(checklist "$sc")" ] && continue
  printf '    %-10s ... ' "$base"
  if [ "${DRYRUN:-}" = "1" ]; then
    case "$sc" in A1|A3) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
  else
    out="$(build_prompt "$sc" "$(cat "$f")" | run_judge)"
    if printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*PASS'; then v=PASS
    elif printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*FAIL'; then v=FAIL
    else v=ERROR; fi
    r="$(printf '%s\n' "$out" | grep -iE '^[[:space:]]*REASON:' | head -1 | sed -E 's/^[[:space:]]*[Rr][Ee][Aa][Ss][Oo][Nn]:[[:space:]]*//')"
    [ "$v" = "ERROR" ] && r="judge produced no parseable verdict"
  fi
  printf '%s\t%s\t%s\t%s\n' "$sc" "$mode" "$v" "$r" >> "$grades"
  echo "$v"
done

# --- scorecard (GREEN rows) ---
gp=0; gt=0; cf=0; bf=0
while IFS=$'\t' read -r sc mode verdict reason; do
  [ "$mode" = "green" ] || continue
  gt=$((gt + 1)); [ "$verdict" = "PASS" ] && gp=$((gp + 1))
  if [ "$verdict" != "PASS" ]; then
    case "$CRIT" in *" $sc "*) cf=$((cf + 1));; esac
    case "$sc" in B1) bf=$((bf + 1));; esac
  fi
done < "$grades"
pct=0; [ "$gt" -gt 0 ] && pct=$(( gp * 100 / gt ))
letter=F; [ "$pct" -ge 60 ] && letter=D; [ "$pct" -ge 70 ] && letter=C; [ "$pct" -ge 80 ] && letter=B; [ "$pct" -ge 90 ] && letter=A
ship="NOT READY"
{ [ "$gt" -ge 8 ] && [ "$gp" -ge 7 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"

# --- human-readable report ---
report="$dir/REPORT.md"
{
  echo "# Coder test report — $modeltag"
  echo ""
  echo "- Run: \`$(basename "$dir")\`  ·  Judge: \`$JUDGE_CLI/$JUDGEMODEL\`"
  echo "- GREEN **$gp/$gt** passed · critical fails: **$cf** · B-series fails: **$bf**"
  echo "- **Grade: $letter ($pct%) — $ship$note**"
  echo ""
  echo "| Scenario | ⚠ | Verdict | Reason | Transcript |"
  echo "|---|---|---|---|---|"
  while IFS=$'\t' read -r sc mode verdict reason; do
    [ "$mode" = "green" ] || continue
    [ "$sc" = "scenario" ] && continue
    cr=""; case "$CRIT" in *" $sc "*) cr="⚠";; esac
    echo "| $sc | $cr | $verdict | ${reason//|/\\|} | \`$sc.$mode.txt\` |"
  done < "$grades"
} > "$report"

echo "  ── $modeltag ──"
echo "  GREEN $gp/$gt passed | critical fails: $cf | B-series fails: $bf"
echo "  GRADE: $letter ($pct%) — $ship$note"
echo "  report → $report"
