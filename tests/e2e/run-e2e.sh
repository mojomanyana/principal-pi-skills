#!/usr/bin/env bash
# Live workflow E2E — standard and critical, both spines, with/without subagents.
#
# Standard × absent proves the complete inline baseline; standard × present proves optional
# delegation. Critical × present proves isolated workspace + independent review receipts.
# Critical × absent must stop with BLOCKED_CRITICAL_ASSURANCE rather than silently replacing
# fresh contexts with inline self-review.
#
# Each cell packs the CURRENT tree, installs the tarball into a throwaway HOME, runs the
# workflow non-interactively, and asserts on the resulting git history. Nothing here touches
# the developer's real home or repo.
#
# ## The entry point, and why the obvious one is wrong
#
# `pi -p "/principal-feature <task>"` does NOT expand the slash command. Verified against a
# control: `/definitely-not-a-real-command say only OK` behaves identically — pi passes the
# text through, the model does the literal thing, no workflow runs, no commit is made, and
# nothing reports an error. Anyone scripting the workflow the obvious way gets a plausible
# answer with no workflow in it.
#
# `--prompt-template <path>` is the flag that registers a prompt template for a
# non-interactive run. With it, the spine executes and commits.
#
# ## Costs and requirements
#
# Each successful cell is a full workflow run (plan/debug -> build -> review -> git-ops)
# against a real model, so this spends real tokens. Needs `pi` on PATH and a provider configured in the
# developer's ~/.pi/agent — the credentials are COPIED into the throwaway home so the run
# does not touch the real one.
#
# Usage:  bash tests/e2e/run-e2e.sh [cell...]     (default: all eight)
#         MODEL=... PROVIDER=... bash tests/e2e/run-e2e.sh feature-standard-absent
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROVIDER="${PROVIDER:-fireworks}"
MODEL="${MODEL:-accounts/fireworks/models/deepseek-v4-pro}"
PI_PKG="$(dirname "$(readlink -f "$(command -v pi)")" 2>/dev/null)/.."
EXT="$PI_PKG/examples/extensions/subagent"
# Derived from `command -v pi`, so it is wrong for any pi layout where the launcher is not
# one directory below the package root. Validate it here rather than letting a `present`
# cell quietly degrade into an `absent` one and still score "delegated".
require_ext() {
  command -v pi >/dev/null || { echo "FATAL: pi is not on PATH"; exit 1; }
  [ -f "$EXT/index.ts" ] && [ -f "$EXT/agents.ts" ] || {
    echo "FATAL: pi's subagent extension not found at $EXT"
    echo "       (PI_PKG was derived from '$(command -v pi)'; set EXT=... to override)"
    exit 1; }
}

pass=0; fail=0
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; pass=$((pass+1)); }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; fail=$((fail+1)); }

# Pack once; every cell installs the same artifact.
PACKDIR=$(mktemp -d); trap 'rm -rf "$PACKDIR"' EXIT
TARBALL="$PACKDIR/$(cd "$ROOT" && npm pack --json --pack-destination "$PACKDIR" 2>/dev/null \
  | node -pe "p=JSON.parse(require('fs').readFileSync(0,'utf8'));(Array.isArray(p)?p[0]:Object.values(p)[0]).filename")"
[ -f "$TARBALL" ] || { echo "npm pack failed"; exit 1; }

# A throwaway HOME with the package installed. `with_subagents` additionally loads pi's own
# subagent extension (it ships inside the pi package, MIT) and installs the namespaced agents
# — so the "present" cells need no vendored copy of anyone else's code.
setup_home() {
  local with_subagents=$1 home proj
  [ "$with_subagents" = yes ] && require_ext
  home=$(mktemp -d); proj="$home/proj"; mkdir -p "$proj"
  # Persistent identity, not `-c` on our own commit: the workflow's git-ops phase runs its
  # OWN `git commit`, and without a configured identity it correctly stops and asks. That is
  # right behaviour from the skill and a broken fixture from us.
  ( cd "$proj" && git init -q -b main \
      && git config user.email e2e@local && git config user.name e2e \
      && git commit -q --allow-empty -m base )
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" pi install "npm:$TARBALL" >/dev/null 2>&1 \
    || { echo "FATAL: pi install failed in $home"; exit 1; }
  mkdir -p "$home/.pi/agent"
  cp ~/.pi/agent/auth.json ~/.pi/agent/models-store.json "$home/.pi/agent/" \
    || { echo "FATAL: could not copy provider credentials into $home"; exit 1; }
  # The subagent extension spawns a CHILD `pi` and passes --model only when the agent's
  # frontmatter declares one (examples/extensions/subagent/index.ts:295). Ours deliberately
  # do not, so the child falls back to the config default. In a throwaway home that default
  # is Anthropic — which is why every delegation reported "OAuth refresh failed for
  # Anthropic". The token was never the problem; the child just never inherited the
  # parent's --provider/--model. Write the parent's choice into the config it does read.
  node -e '
    const fs = require("fs"), p = process.argv[1];
    const s = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
    s.defaultProvider = process.argv[2];
    s.defaultModel = process.argv[3];
    fs.writeFileSync(p, JSON.stringify(s, null, 2));
  ' "$home/.pi/agent/settings.json" "$PROVIDER" "$MODEL"
  if [ "$with_subagents" = yes ]; then
    # Every step here is checked: a silent failure turns a `present` cell into an `absent`
    # one that still reports "delegated", which is the false green this harness exists to
    # avoid producing about itself.
    mkdir -p "$home/.pi/agent/extensions/subagent"
    cp "$EXT/index.ts" "$EXT/agents.ts" "$home/.pi/agent/extensions/subagent/" \
      || { echo "FATAL: could not copy the subagent extension from $EXT"; exit 1; }
    HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" \
      node "$home/.pi/agent/npm/node_modules/principal-pi-skills/scripts/install-agents.mjs" \
      install >/dev/null 2>&1 \
      || { echo "FATAL: install-agents.mjs failed in $home"; exit 1; }
    local n
    n=$(ls "$home/.pi/agent/agents"/principal-*.md 2>/dev/null | wc -l)
    [ "$n" -ge 3 ] || { echo "FATAL: expected 3 principal-* agents installed, found $n"; exit 1; }
  fi
  echo "$home"
}

# `pi` has no --cwd flag: it operates on the directory it is LAUNCHED from. Without the
# `cd` below it ran in the developer's own checkout — reading and writing this repo while
# every assertion below inspected an untouched fixture. That is what produced the
# "fabricated evidence" debugging note: the note truthfully described THIS repo's files,
# left there by an earlier run of the same cell. It also silently fed the run this repo's
# AGENTS.md, which pi auto-discovers from cwd and which a clean install does not have.
run_workflow() {  # home, prompt-name, task -> prints the transcript
  local home=$1 name=$2 task=$3
  local tree="$home/.pi/agent/npm/node_modules/principal-pi-skills"
  ( cd "$home/proj" && HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" timeout 1800 \
      pi -p --provider "$PROVIDER" --model "$MODEL" \
         --prompt-template "$tree/prompts/$name.md" "/$name $task" 2>&1 )
}

# Did the spine delegate, or did it fall back to running the phases inline?
#
# Prose is the only signal available. The child subagent is spawned as `node <cli.js>`
# (examples/extensions/subagent/index.ts:249-262 prefers process.execPath over PATH), so it
# cannot be shimmed, counted, or observed after the fact — `--no-session` leaves no trace
# either. So this classifies text, and the honesty of the cell rests entirely on it.
#
# The previous version credited "delegated" for the bare word `subagent` — which appears
# inside the inline confession "(no subagent tool available)" — while its negative patterns
# (`no .*subagent available`, `inline phases: .*(plan|review)`) matched neither the real
# wording nor the markdown the models actually emit. A fully inline run scored as delegated.
#
# Two rules, in order:
#   1. Any confession of falling back is decisive, however phrased. In a `present` cell ANY
#      fallback is a failure, so this outranks partial delegation.
#   2. Only then may a named `principal-*` agent, or an explicit delegation claim, earn credit.
# `run-e2e.sh --self-test` checks both directions against the last captured transcripts.
classify_delegation() {  # transcript -> delegated | inline | neither
  local flat
  # Strip the emphasis/table punctuation that defeated the old patterns, fold whitespace.
  flat=$(printf '%s' "$1" | tr -d '*_`|#' | tr -s '[:space:]' ' ' | tr '[:upper:]' '[:lower:]')
  if grep -qE "no (subagent|principal-[a-z]+)|subagent (tool )?(is )?(not available|unavailable)|(fell|fall|falling) back to inline|inline fallback|without (the )?subagent" <<<"$flat"; then
    printf 'inline\n'; return
  fi
  if grep -qE "principal-(plan|review|debug)|delegat|via subagents?" <<<"$flat"; then
    printf 'delegated\n'; return
  fi
  printf 'neither\n'
}

# Canary: no cell may leave a mark on the developer's checkout. This is the assertion that
# would have caught the wrong-cwd bug on its first run instead of two commits later.
dev_repo_state() { git -C "$ROOT" rev-parse HEAD; git -C "$ROOT" status --porcelain; }
DEV_STATE_BEFORE=$(dev_repo_state)
assert_dev_repo_untouched() {
  if [ "$(dev_repo_state)" = "$DEV_STATE_BEFORE" ]; then
    ok "the developer's checkout is untouched"
  else
    bad "THE CELL WROTE TO THE DEVELOPER'S CHECKOUT — it did not run in the fixture repo"
    diff <(printf '%s\n' "$DEV_STATE_BEFORE") <(dev_repo_state) | head -20
  fi
}

# Only the final labeled Digest block is steering evidence. Earlier tool output, plans, and
# narration may contain both a commit SHA and the words "root cause"; scanning the whole
# transcript lets those unrelated occurrences satisfy the assertion vacuously.
extract_final_digest() {  # transcript -> last Digest: block
  node -e '
    const fs=require("fs"), lines=fs.readFileSync(0,"utf8").split(/\r?\n/);
    const clean=s=>s.replace(/[*_`|#]/g, "").trim();
    let start=-1;
    for(let i=0;i<lines.length;i++) if(/^digest:\s*$/i.test(clean(lines[i]))) start=i;
    if(start>=0) process.stdout.write(lines.slice(start, start+7).join("\n"));
  ' <<<"$1"
}

normalized_digest_lines() {  # digest, label
  printf '%s\n' "$1" | tr -d '*_`|#' | grep -iE "^[[:space:]-]*$2:" || true
}

digest_block_valid() {  # transcript, feature|bugfix
  node -e '
    const fs=require("fs"), kind=process.argv[1], lines=fs.readFileSync(0,"utf8").split(/\r?\n/);
    const clean=s=>s.replace(/[*_`|#]/g, "").replace(/^[\s-]+/, "").trim();
    let start=-1;
    for(let i=0;i<lines.length;i++) if(/^digest:\s*$/i.test(clean(lines[i]))) start=i;
    const labels=kind==="bugfix"
      ? ["root cause", "run/profile/scope", "ref", "assumptions/follow-ups", "evidence gaps", "execution contexts"]
      : ["run/profile/scope", "ref", "assumptions", "follow-ups", "evidence gaps", "execution contexts"];
    if(start<0 || start+labels.length>=lines.length) process.exit(1);
    for(let i=0;i<labels.length;i++) {
      const line=clean(lines[start+i+1]), prefix=labels[i]+":";
      if(!line.toLowerCase().startsWith(prefix) || !line.slice(prefix.length).trim()) process.exit(1);
    }
    if(lines.slice(start+labels.length+1).some(line=>line.trim())) process.exit(1);
  ' "$2" <<<"$1"
}

digest_ref_matches() {  # transcript, SHA
  local digest line
  digest=$(extract_final_digest "$1")
  [ -n "$digest" ] || return 1
  [ "$(normalized_digest_lines "$digest" ref | wc -l)" -eq 1 ] || return 1
  line=$(normalized_digest_lines "$digest" ref)
  grep -qE "(^|[^0-9a-f])$2([^0-9a-f]|$)" <<<"${line,,}"
}

digest_root_cause_valid() {  # transcript
  local digest line value
  digest=$(extract_final_digest "$1")
  [ -n "$digest" ] || return 1
  [ "$(normalized_digest_lines "$digest" 'root cause' | wc -l)" -eq 1 ] || return 1
  line=$(normalized_digest_lines "$digest" 'root cause')
  value=${line#*:}; value=$(printf '%s' "$value" | sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//' | tr '[:upper:]' '[:lower:]')
  [ -n "$value" ] || return 1
  ! grep -qE "^(none|unknown|n/a|not (found|determined|identified)|pending|tbd)([. ]|$)" <<<"$value"
}

assert_digest() {  # transcript, proj, feature|bugfix
  local out=$1 proj=$2 kind=$3 sha
  sha=$(git -C "$proj" log -1 --format=%H 2>/dev/null)
  if [ -n "$sha" ] && digest_block_valid "$out" "$kind" && digest_ref_matches "$out" "$sha"; then
    ok "final digest has the exact labeled block and reports the real commit ($sha)"
  else
    bad "final digest block is malformed or its Ref does not name the real commit (${sha:-none})"
  fi
}

assert_root_cause() {  # transcript
  if digest_root_cause_valid "$1"; then ok "final digest carries a concrete root cause"
  else bad "final digest has no concrete Root cause field"; fi
}

assurance_snapshot() {  # project -> newest snapshot path
  find "$1/.git/principal-pi-skills/assurance-v1/runs" -name snapshot.json -type f \
    -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-
}

assert_assurance() {  # project, profile
  local snapshot; snapshot=$(assurance_snapshot "$1")
  if [ -z "$snapshot" ]; then bad "no persisted assurance snapshot"; return; fi
  if node -e '
    const s=require(process.argv[1]), p=process.argv[2];
    if(s.schema_version!=="1.0"||s.assurance.requested!==p||s.assurance.effective!==p||!s.run_id) process.exit(1)
  ' "$snapshot" "$2"; then ok "$2 assurance persisted with run identity"
  else bad "assurance snapshot does not preserve requested/effective $2"; fi
}

assert_finish_gate() {  # project, expected choice
  local proj=$1 expected=$2 snapshot home tool state_dir run_id log state_tree actual_tree actual_branch
  snapshot=$(assurance_snapshot "$proj")
  [ -n "$snapshot" ] || { bad "no assurance snapshot for finish gate"; return; }
  home=$(dirname "$proj")
  tool="$home/.pi/agent/npm/node_modules/principal-pi-skills/scripts/assurance-state.mjs"
  state_dir="$proj/.git/principal-pi-skills/assurance-v1"
  run_id=$(node -pe 'require(process.argv[1]).run_id' "$snapshot")
  state_tree=$(node -pe 'require(process.argv[1]).current_tree_sha||""' "$snapshot")
  log="$state_dir/runs/$run_id/events.jsonl"
  actual_tree=$(git -C "$proj" rev-parse "HEAD^{tree}" 2>/dev/null || true)
  actual_branch=$(git -C "$proj" branch --show-current 2>/dev/null || true)
  if [ -n "$state_tree" ] && [ "$state_tree" = "$actual_tree" ] \
    && node -e '
      const fs=require("fs"), s=require(process.argv[1]), expected=process.argv[2];
      const events=fs.readFileSync(process.argv[3],"utf8").trim().split("\n").map(JSON.parse);
      const choices=events.filter(e=>e.type==="finish_selected");
      const completed=events.filter(e=>e.type==="finalization_completed");
      process.exit(s.finish?.choice===expected && s.finalization?.choice===expected &&
        s.status==="finished" && s.phases["git-ops"]?.status==="completed" &&
        s.finalization.head_sha===process.argv[4] && s.finalization.tree_sha===process.argv[5] &&
        s.finalization.final_branch===process.argv[6] &&
        choices.length===1 && choices[0].choice===expected && completed.length===1 ? 0 : 1)
    ' "$snapshot" "$expected" "$log" "$(git -C "$proj" rev-parse HEAD)" "$actual_tree" "$actual_branch" \
    && node "$tool" gate --state-dir "$state_dir" --run-id "$run_id" --gate finish >/dev/null 2>&1; then
    ok "one $expected disposition and exact final branch/head/tree persisted; finish passed"
  else
    bad "finish/finalization failed or persisted final head/tree differs for $expected"
  fi
}

assert_critical_receipts() {  # project
  local snapshot; snapshot=$(assurance_snapshot "$1")
  if [ -n "$snapshot" ] && node -e '
    const s=require(process.argv[1]), w=s.workspaces[s.active_workspace_id];
    process.exit(w&&w.mode==="owned-isolated"&&w.writer==="build" ? 0 : 1)
  ' "$snapshot"; then
    ok "critical owned workspace persisted"
  else
    bad "critical owned workspace receipt is missing"
  fi
}

assert_delegation() {  # transcript, subs
  local verdict; verdict=$(classify_delegation "$1")
  if [ "$2" = no ]; then
    case "$verdict" in
      inline) ok "ran inline and said so — the honesty requirement" ;;
      delegated) bad "claims delegation with NO subagent extension installed" ;;
      *) bad "said nothing about how the phases ran — the honesty requirement" ;;
    esac
  else
    case "$verdict" in
      delegated) ok "delegated to a subagent rather than running inline" ;;
      inline) bad "fell back to inline while subagents ARE installed" ;;
      *) bad "no evidence of delegation, and no inline claim either" ;;
    esac
  fi
}

cell_feature() {  # subagents: yes|no, assurance: standard|critical
  local subs=$1 assurance=$2 home out
  say "feature x ${assurance} x subagents ${subs}"
  home=$(setup_home "$subs")
  cat > "$home/proj/package.json" <<'JSON'
{"type":"module","scripts":{"test":"node --test"}}
JSON
  cat > "$home/proj/app.js" <<'JS'
export const applicationName = "greeting-service";
JS
  ( cd "$home/proj" && git add -A && git commit -q -m "add greeting service" )
  local finish="Finish by keeping the branch."
  [ "$assurance" = critical ] && finish="Finish by merging the owned branch locally."
  out=$(run_workflow "$home" principal-feature \
    "--assurance $assurance add greet.js exporting greet(name): trim the name, return Hello, <name>!, throw TypeError for blank input, and add node:test coverage for success and rejection. $finish")

  local proj="$home/proj"
  assert_assurance "$proj" "$assurance"
  if [ "$assurance" = critical ] && [ "$subs" = no ]; then
    if grep -q "BLOCKED_CRITICAL_ASSURANCE" <<<"$out"; then ok "critical run blocks without fresh-context infrastructure"
    else bad "critical run did not return BLOCKED_CRITICAL_ASSURANCE without subagents"; fi
    if [ "$(git -C "$proj" log --oneline | wc -l)" -eq 2 ] && [ ! -e "$proj/greet.js" ]; then
      ok "blocked critical run made no source or history change"
    else bad "blocked critical run changed the caller project"; fi
    assert_dev_repo_untouched
    printf '%s\n' "$out" > "$ROOT/tests/e2e/last-feature-$assurance-$subs.txt"
    rm -rf "$home"; return
  fi
  if [ "$(git -C "$proj" log --oneline | wc -l)" -gt 2 ]; then ok "the spine committed"; else bad "no commit — the workflow did not reach git-ops"; fi
  # Exercise the feature rather than accepting a token file: the substantive fixture justifies
  # Plan/Review delegation in standard-present cells.
  if [ ! -f "$proj/greet.js" ]; then bad "greet.js missing"
  elif node -e 'import(process.argv[1]).then(m=>{let rejected=false;try{m.greet("  ")}catch(e){rejected=e instanceof TypeError}process.exit(m.greet(" Ada ")==="Hello, Ada!"&&rejected?0:1)})' "file://$proj/greet.js"; then
    ok "the substantive feature landed with success and boundary behavior"
  else bad "greet(name) does not satisfy success and blank-input behavior"; fi
  if ( cd "$proj" && npm test >/dev/null 2>&1 ); then ok "feature tests pass"; else bad "feature tests fail"; fi
  if [ -z "$(git -C "$proj" status --porcelain)" ]; then ok "working tree clean (build's change was committed, not left loose)"; else bad "tree dirty after the spine finished"; fi

  assert_digest "$out" "$proj" feature
  assert_delegation "$out" "$subs"
  [ "$assurance" = critical ] && assert_critical_receipts "$proj"
  if [ "$assurance" = critical ]; then assert_finish_gate "$proj" merge; else assert_finish_gate "$proj" keep; fi
  assert_dev_repo_untouched
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-feature-$assurance-$subs.txt"
  rm -rf "$home"
}

cell_bugfix() {  # subagents: yes|no, assurance: standard|critical
  local subs=$1 assurance=$2 home out
  say "bugfix x ${assurance} x subagents ${subs}"
  home=$(setup_home "$subs")
  # A real, reproducible bug: sum() ignores the last element.
  cat > "$home/proj/sum.js" <<'JS'
export function sum(xs) {
  let t = 0;
  for (let i = 0; i < xs.length - 1; i++) t += xs[i];
  return t;
}
JS
  ( cd "$home/proj" && git add -A \
      && git commit -q -m "add sum" )
  local finish="Finish by keeping the branch."
  [ "$assurance" = critical ] && finish="Finish by merging the owned branch locally."
  out=$(run_workflow "$home" principal-bugfix \
    "--assurance $assurance sum([1,2,3]) returns 3 instead of 6 in sum.js — the last element is dropped. $finish")

  local proj="$home/proj"
  assert_assurance "$proj" "$assurance"
  if [ "$assurance" = critical ] && [ "$subs" = no ]; then
    if grep -q "BLOCKED_CRITICAL_ASSURANCE" <<<"$out"; then ok "critical run blocks without fresh-context infrastructure"
    else bad "critical run did not return BLOCKED_CRITICAL_ASSURANCE without subagents"; fi
    if [ "$(git -C "$proj" log --oneline | wc -l)" -eq 2 ] && node -e 'import(process.argv[1]).then(m=>process.exit(m.sum([1,2,3])===3?0:1))' "file://$proj/sum.js"; then
      ok "blocked critical run left the known bug and history untouched"
    else bad "blocked critical run changed the bug fixture"; fi
    assert_dev_repo_untouched
    printf '%s\n' "$out" > "$ROOT/tests/e2e/last-bugfix-$assurance-$subs.txt"
    rm -rf "$home"; return
  fi
  if [ "$(git -C "$proj" log --oneline | wc -l)" -gt 2 ]; then ok "the spine committed a fix"; else bad "no fix commit"; fi
  # RUN the function rather than grepping for one spelling of the bug. `xs.length - 1` is
  # only one way to write the off-by-one: `i <= xs.length - 2`, `xs.length-1`, or hoisting
  # the bound into a const all leave sum([1,2,3]) === 3 while defeating a literal grep.
  # Accepts either module form, since a legitimate fix may convert the file.
  if [ ! -f "$proj/sum.js" ]; then bad "sum.js is gone — the fix cannot be verified"
  elif node -e '
    const p = process.argv[1];
    (async () => {
      let sum;
      try { ({ sum } = await import("file://" + p)); }
      catch { try { const m = require(p); sum = m.sum ?? m; } catch { process.exit(2); } }
      if (typeof sum !== "function") process.exit(2);
      const ok = sum([1,2,3]) === 6 && sum([]) === 0 && sum([5]) === 5 && sum([1,2,3,4,5]) === 15;
      process.exit(ok ? 0 : 1);
    })();
  ' "$proj/sum.js" 2>/dev/null; then
    ok "sum() actually returns 6 for [1,2,3] — verified by running it"
  else
    bad "sum() still computes the wrong total (or is no longer callable)"
  fi
  if [ -z "$(git -C "$proj" status --porcelain)" ]; then ok "working tree clean"; else bad "tree dirty"; fi

  assert_digest "$out" "$proj" bugfix
  assert_root_cause "$out"
  assert_delegation "$out" "$subs"
  [ "$assurance" = critical ] && assert_critical_receipts "$proj"
  if [ "$assurance" = critical ]; then assert_finish_gate "$proj" merge; else assert_finish_gate "$proj" keep; fi
  assert_dev_repo_untouched
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-bugfix-$assurance-$subs.txt"
  rm -rf "$home"
}

# --self-test: exercise delegation and final-digest classifiers without model calls. These
# text classifiers are the only guards against fallback claims or earlier transcript prose
# satisfying a live assertion, so both positive and negative directions are mandatory.
if [ "${1:-}" = --self-test ]; then
  while IFS='|' read -r want sample; do
    got=$(classify_delegation "$sample")
    if [ "$got" = "$want" ]; then ok "synthetic delegation canary classified $got"
    else bad "synthetic delegation canary classified $got, expected $want"; fi
  done <<'CANARIES'
inline|No subagent tool is available, so I fell back to inline.
delegated|Delegated Plan to principal-plan and Review to principal-review.
inline|principal-review was unavailable; falling back to inline despite mentioning delegation.
neither|Completed the requested change and verification.
CANARIES
  full_sha=abcdef0123456789abcdef0123456789abcdef01
  valid_digest=$'Earlier tool output mentioned abc123.\nDigest:\nRoot cause: loop stopped one element early\nRun/profile/scope: run-1 standard entire-run\nRef: kept commit '"$full_sha"$'\nAssumptions/follow-ups: none\nEvidence gaps: none\nExecution contexts: inline'
  stale_digest=$'A tool committed abc123.\nRoot cause: loop stopped one element early\nDigest:\nRoot cause: pending\nRun/profile/scope: run-1 standard entire-run\nRef: kept commit def456\nAssumptions/follow-ups: none\nEvidence gaps: none\nExecution contexts: inline'
  trailing_digest="$valid_digest"$'\nFAILED AFTER DIGEST\nRef: abc123'
  if digest_block_valid "$valid_digest" bugfix; then ok "exact six-line bugfix Digest block accepted"
  else bad "exact six-line bugfix Digest block rejected"; fi
  if digest_ref_matches "$valid_digest" "$full_sha"; then ok "final Digest Ref accepts the full commit SHA"
  else bad "final Digest Ref rejected its own commit"; fi
  if digest_ref_matches "$stale_digest" abc123; then bad "earlier transcript SHA satisfied final Digest Ref"
  else ok "earlier transcript SHA cannot satisfy final Digest Ref"; fi
  if digest_block_valid "$trailing_digest" bugfix; then bad "post-Digest failure/chatter was accepted"
  else ok "post-Digest failure/chatter invalidates the final block"; fi
  if digest_root_cause_valid "$valid_digest"; then ok "concrete final Root cause accepted"
  else bad "concrete final Root cause rejected"; fi
  if digest_root_cause_valid "$stale_digest"; then bad "pending final Root cause accepted"
  else ok "pending final Root cause rejected"; fi

  for f in "$ROOT"/tests/e2e/last-*.txt; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in
      *-critical-no.txt) continue ;; # a deliberate block, not an inline fallback
      *-no.txt) want=inline ;; *-yes.txt) want=delegated ;; *) continue ;;
    esac
    got=$(classify_delegation "$(cat "$f")")
    if [ "$got" = "$want" ]; then ok "$(basename "$f") classified $got"
    else bad "$(basename "$f") classified $got, expected $want"; fi
  done
  printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]; exit
fi

CELLS=("${@:-feature-standard-absent bugfix-standard-absent feature-standard-present bugfix-standard-present feature-critical-absent bugfix-critical-absent feature-critical-present bugfix-critical-present}")
for c in ${CELLS[@]}; do
  case "$c" in
    feature-standard-absent)  cell_feature no  standard ;;
    feature-standard-present) cell_feature yes standard ;;
    bugfix-standard-absent)   cell_bugfix  no  standard ;;
    bugfix-standard-present)  cell_bugfix  yes standard ;;
    feature-critical-absent)  cell_feature no  critical ;;
    feature-critical-present) cell_feature yes critical ;;
    bugfix-critical-absent)   cell_bugfix  no  critical ;;
    bugfix-critical-present)  cell_bugfix  yes critical ;;
    # A typo used to print a message, run nothing, and exit 0 — a green suite with the whole
    # product spine unexercised.
    *) bad "unknown cell: $c" ;;
  esac
done

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
# A run that asserted nothing is not a pass. Without this, any path that skips every cell
# reports success.
[ "$pass" -gt 0 ] || { printf '\033[31mno assertions ran\033[0m\n'; exit 1; }
[ "$fail" -eq 0 ]
