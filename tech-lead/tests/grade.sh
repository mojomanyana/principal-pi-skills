#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of tech-lead transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>
#
# Judge = opus via the claude CLI (your Max plan, no API billing) — the default below.
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
set -uo pipefail

dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"
JUDGEMODEL="${JUDGEMODEL:-opus}"
JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A2 A5 B1 C1 C2 "

[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) the spec adopts the shown codebase conventions — returns Result<.., MathError>, snake_case, no panic/unwrap, divide-by-zero as an Err; (2) does NOT impose exceptions, camelCase, or a panicking style.";;
    A2) echo "(1) specifies a concrete contract — where the validation/schema lives, the exact failure response (status + shape), and what stays unchanged; (2) is NOT a vague restatement ('add validation to the handler') that leaves a coder to guess the design.";;
    A3) echo "(1) includes a test plan as part of the spec — at least one named/﻿described test and an edge case (empty title, unicode, collision); (2) does NOT leave testing as the coder's unspecified homework.";;
    A4) echo "(1) surfaces the ripple: names that the existing get_user call sites are affected by the signature change (a default arg keeps them working, but they are explicitly considered); (2) does NOT spec the signature change with no mention of callers/compatibility.";;
    A5) echo "(1) flags renaming the PUBLIC/exported API as a one-way / breaking door for external consumers; (2) requires a migration or deprecation path (keep an alias, deprecate, version) and/or a kill criterion — does NOT treat it as a simple internal rename.";;
    A6) echo "(1) smell-checks the how-without-why — asks what problem the observer pattern is meant to solve / whether it fits before speccing; (2) does NOT just spec the observer-pattern rewrite with no question about the driver.";;
    A7) echo "(1) specifies the failing regression test FIRST (a test that reproduces the missing-end-element bug); (2) names the root cause (xs[start:end] excludes end; needs end+1 or inclusive slice) — not just a vague 'fix the slice'.";;
    B1) echo "(1) holds across the turns — still delivers the design discipline: a right-sized spec OR an explicit hand-off to the coder skill with the contract/test intact; (2) does NOT abandon discipline and dump ad-hoc unspecified code with no test/handoff; (3) stays useful (does not just refuse).";;
    C1) echo "(1) right-sizes: just says make the one-word typo fix (or route straight to coder); (2) does NOT produce a multi-section spec, exploration notes, or reversibility analysis for a log-string typo.";;
    C2) echo "(1) right-sizes to a short spec — the contract plus a test — for the additive flag; (2) does NOT invoke the full multi-section template, ripple analysis, and one-way-door tags for a small reversible CLI flag.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using a "tech-lead" skill — it turns a task into
a coder-executable coding spec: matching the codebase's conventions, a concrete (not vague)
contract, a test plan inside the spec, surfaced ripple effects, one-way-door decisions flagged with
a migration/kill-criterion, and a smell-check; WITHOUT over-speccing a trivial or small change. It
designs, it does not write the final code. Judge it ONLY against the checklist below — do not add
requirements beyond it. A full 10-section spec document is NOT required in one turn; judge the move.

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
    ( cd /tmp && claude -p --disable-slash-commands --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
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
    case "$sc" in A2|A5) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
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
{ [ "$gt" -ge 10 ] && [ "$gp" -ge 8 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"

# --- human-readable report ---
report="$dir/REPORT.md"
{
  echo "# Tech-Lead test report — $modeltag"
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
