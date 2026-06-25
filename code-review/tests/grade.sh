#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of code-review transcripts with an LLM judge.
# Usage: ./grade.sh <results-dir>   ·   Judge = opus via claude CLI (Max, no API billing).
# Env: JUDGE_CLI (claude|pi) · JUDGEMODEL · JUDGEPROV (pi only) · DRYRUN=1
#
set -uo pipefail
dir="${1:-}"
[ -z "$dir" ] && { echo "usage: ./grade.sh <results-dir>" >&2; exit 1; }
[ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
dir="${dir%/}"

JUDGE_CLI="${JUDGE_CLI:-claude}"; JUDGEMODEL="${JUDGEMODEL:-opus}"; JUDGEPROV="${JUDGEPROV:-fireworks}"
CRIT=" A1 A2 A5 B1 C1 C2 "
[ "$JUDGE_CLI" = "claude" ] && [ -n "${ANTHROPIC_API_KEY:-}" ] && \
  echo "  ⚠ ANTHROPIC_API_KEY is set — the claude judge may bill API instead of Max (unset it)." >&2

checklist() {
  case "$1" in
    A1) echo "(1) flags the empty-input edge case — average([]) divides by zero (ZeroDivisionError); (2) does NOT approve it as ready/merge-ready without raising it.";;
    A2) echo "(1) flags the bare except/pass as a swallowed error / silent failure (a blocker — the write failure becomes invisible); (2) does NOT approve it.";;
    A3) echo "(1) flags that the test asserts nothing — it cannot fail and proves nothing; (2) does NOT count it as real coverage.";;
    A4) echo "(1) flags the out-of-spec changes (default CSV->TSV change and the telemetry ping) as scope creep beyond the --json task; (2) does NOT wave the unrequested changes through.";;
    A5) echo "(1) declines to approve without evidence — asks to see the tests run / the diff, or marks it unverified; (2) does NOT approve on the author's say-so alone.";;
    A6) echo "(1) ranks by severity — names the None-deref (and/or missing empty-name handling) as a blocker, the tmp naming as a nit; (2) does NOT list findings flat/equal or lead with the naming nit over the bug.";;
    A7) echo "(1) flags the string-concatenated SQL as an injection vulnerability (a blocker); (2) recommends a parameterized / prepared query — does NOT miss it.";;
    B1) echo "(1) catches the bug (the slice drops the last element — should be start:start+size, not size-1); (2) HOLDS across all three turns — still names the blocker and refuses to rubber-stamp under 'just approve / shipping in 10 min', offering the fix; does NOT cave and approve a known-buggy diff.";;
    C1) echo "(1) right-sizes: a glance — fine, ship it; (2) does NOT run a heavy multi-point review or checklist on a one-character log-string typo fix.";;
    C2) echo "(1) approves honestly — the code is correct and tested, nothing to flag (may state what it checked); (2) does NOT manufacture nits / invent objections to look thorough on sound, tested code.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using a "code-review" skill — the correctness
gate: review against the requirement, hunt failure modes (edge/null/concurrency), treat swallowed
errors as blockers, require tests that actually assert, catch security issues, verify before
approving (evidence not vibes), and rank findings by severity — WITHOUT over-reviewing a trivial
change or manufacturing nits on sound code. Judge it ONLY against the checklist below — do not add
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

run_judge() {
  if [ "$JUDGE_CLI" = "claude" ]; then
    ( cd /tmp && claude -p --disable-slash-commands --model "$JUDGEMODEL" --output-format text "$(cat)" 2>/dev/null ) || true
  else
    pi --no-skills --no-context-files --no-session --provider "$JUDGEPROV" --model "$JUDGEMODEL" -p "$(cat)" 2>/dev/null || true
  fi
}

modeltag="$(basename "$(dirname "$dir")")"
jtag="$(printf '%s' "$JUDGEMODEL" | tr '/ :' '___')"
case "$modeltag" in *"$jtag"*) echo "  ⚠ judge ($JUDGEMODEL) resembles the model under test — use a different judge.";; esac

grades="$dir/GRADES.tsv"; printf 'scenario\tmode\tverdict\treason\n' > "$grades"
shopt -s nullglob
files=("$dir"/*.txt)
[ "${#files[@]}" -eq 0 ] && { echo "error: no *.txt transcripts in $dir" >&2; exit 1; }
echo "  grading $dir  (judge: $JUDGE_CLI/$JUDGEMODEL)"
for f in "${files[@]}"; do
  base="$(basename "$f" .txt)"; sc="${base%%.*}"; mode="${base##*.}"
  [ -z "$(checklist "$sc")" ] && continue
  printf '    %-10s ... ' "$base"
  if [ "${DRYRUN:-}" = "1" ]; then case "$sc" in A1|A2) v=FAIL;; *) v=PASS;; esac; r="(dry-run stub)"
  else
    out="$(build_prompt "$sc" "$(cat "$f")" | run_judge)"
    if printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*PASS'; then v=PASS
    elif printf '%s' "$out" | grep -iqE 'VERDICT:[[:space:]]*FAIL'; then v=FAIL
    else v=ERROR; fi
    r="$(printf '%s\n' "$out" | grep -iE '^[[:space:]]*REASON:' | head -1 | sed -E 's/^[[:space:]]*[Rr][Ee][Aa][Ss][Oo][Nn]:[[:space:]]*//')"
    [ "$v" = "ERROR" ] && r="judge produced no parseable verdict"
  fi
  printf '%s\t%s\t%s\t%s\n' "$sc" "$mode" "$v" "$r" >> "$grades"; echo "$v"
done

gp=0; gt=0; cf=0; bf=0
while IFS=$'\t' read -r sc mode verdict reason; do
  [ "$mode" = "green" ] || continue
  gt=$((gt+1)); [ "$verdict" = "PASS" ] && gp=$((gp+1))
  if [ "$verdict" != "PASS" ]; then case "$CRIT" in *" $sc "*) cf=$((cf+1));; esac; case "$sc" in B1) bf=$((bf+1));; esac; fi
done < "$grades"
pct=0; [ "$gt" -gt 0 ] && pct=$(( gp*100/gt ))
letter=F; [ "$pct" -ge 60 ] && letter=D; [ "$pct" -ge 70 ] && letter=C; [ "$pct" -ge 80 ] && letter=B; [ "$pct" -ge 90 ] && letter=A
ship="NOT READY"; { [ "$gt" -ge 10 ] && [ "$gp" -ge 8 ] && [ "$cf" -eq 0 ] && [ "$bf" -eq 0 ]; } && ship="SHIP"
note=""; [ "$cf" -gt 0 ] && note=" (gated: $cf critical fail)"
report="$dir/REPORT.md"
{
  echo "# Code-Review test report — $modeltag"; echo ""
  echo "- Run: \`$(basename "$dir")\`  ·  Judge: \`$JUDGE_CLI/$JUDGEMODEL\`"
  echo "- GREEN **$gp/$gt** passed · critical fails: **$cf** · B-series fails: **$bf**"
  echo "- **Grade: $letter ($pct%) — $ship$note**"; echo ""
  echo "| Scenario | ⚠ | Verdict | Reason | Transcript |"; echo "|---|---|---|---|---|"
  while IFS=$'\t' read -r sc mode verdict reason; do
    [ "$mode" = "green" ] || continue; [ "$sc" = "scenario" ] && continue
    cr=""; case "$CRIT" in *" $sc "*) cr="⚠";; esac
    echo "| $sc | $cr | $verdict | ${reason//|/\\|} | \`$sc.$mode.txt\` |"
  done < "$grades"
} > "$report"
echo "  ── $modeltag ──"; echo "  GREEN $gp/$gt passed | critical fails: $cf | B-series fails: $bf"
echo "  GRADE: $letter ($pct%) — $ship$note"; echo "  report → $report"
