#!/usr/bin/env bash
#
# grade.sh — auto-grade a dir of implementation-planner transcripts with an LLM judge.
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
    A1) echo "(1) reframes the feature list to the measurable OUTCOME (e.g. users recover access without contacting support) before sequencing; (2) does NOT just turn the feature list into ordered tasks with no outcome.";;
    A2) echo "(1) step 1 is a thin END-TO-END walking skeleton that exercises every seam (ingest->validate->transform->DB->notify) with stub/trivial logic; (2) does NOT plan horizontal layers (all models, then all services, then all wiring) that defer integration to the end.";;
    A3) echo "(1) surfaces the risk/unknown (a never-used vendor API) and SPIKES it — a time-boxed investigation with a deliverable — before committing dependent scope; (2) does not dive into a task list as if the unknown were known.";;
    A4) echo "(1) delivers vertical slices with dependencies / parallelism (a DAG), OR pushes back on the flat-list request explaining why; (2) does NOT hand over a bare 1-2-3 numbered list with no slices or dependency structure.";;
    A5) echo "(1) flags the column-drop schema migration as a one-way / hard-to-reverse door; (2) demands kill criteria + a rollback plan + a decision review (eyes other than the implementer) before the destructive step — not just a sequence of migration steps.";;
    A6) echo "(1) insists on OBSERVABLE acceptance criteria per slice (e.g. 'returns results matching query X; integration test green'); (2) does NOT accept 'implement search / build it' as the done-signal.";;
    A7) echo "(1) decomposes the monster into INVEST-sized slices; (2) explains the cost of one-giant-step (breaks parallel work, hides risk, has no honest acceptance) — does NOT accept planning the whole notifications system as a single step.";;
    B1) echo "(1) holds across the turns — still delivers a real plan (vertical slices plus at least the walking skeleton or the risks, OR a deliberately right-sized plan), not a bare flat numbered task list; (2) does NOT collapse to a basis-free 1-2-3 list under pressure; (3) stays useful — gives something actionable, does not just refuse.";;
    C1) echo "(1) right-sizes: just says make the one-line change (it is a two-way door); (2) does NOT impose a walking skeleton, DAG, risk register, or handoff batons on a trivial one-line reversible config edit.";;
    C2) echo "(1) right-sizes to a short plan — a slice or two with acceptance criteria; (2) does NOT invoke the heavy machinery (spikes, a full DAG, a decision review, observability SLOs) for a tiny reversible CLI flag.";;
    *)  echo "";;
  esac
}

build_prompt() {  # $1=scenario $2=transcript
  cat <<JUDGE_EOF
You are grading ONE response from an AI assistant using an "implementation-planner" skill — it
turns a spec/design/task into an executable plan: outcome-first (not a feature list), a walking
skeleton before depth, risks-and-spikes before tasks, vertical slices (INVEST) in a dependency DAG
(not a flat list), acceptance + kill criteria, one-way-door guardrails; WITHOUT over-planning a
trivial or small reversible task. Judge it ONLY against the checklist below — do not add
requirements beyond it. The skill defers a full master plan / handoff batons to a real planning
pass, so their absence in a single turn is NOT a failure unless the checklist asks for them.

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
  echo "# Implementation-Planner test report — $modeltag"
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
