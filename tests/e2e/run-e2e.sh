#!/usr/bin/env bash
# Live workflow E2E — the four cells the improvement plan calls for.
#
#   | Workflow | Subagents |            what it proves
#   |----------|-----------|-------------------------------------------------
#   | feature  | absent    | the spine runs inline and SAYS it ran inline
#   | bugfix   | absent    | same, through the debug->build->review path
#   | feature  | present   | it delegates instead, and the digest stops
#   | bugfix   | present   |   claiming inline
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
# Each cell is a full workflow run (plan/debug -> build -> review -> git-ops) against a real
# model, so this spends real tokens. Needs `pi` on PATH and a provider configured in the
# developer's ~/.pi/agent — the credentials are COPIED into the throwaway home so the run
# does not touch the real one.
#
# Usage:  bash tests/e2e/run-e2e.sh [cell...]     (default: all four)
#         MODEL=... PROVIDER=... bash tests/e2e/run-e2e.sh feature-absent
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
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8'))[0].filename")"
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
  ( cd "$home/proj" && HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" timeout 900 \
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

# A digest is evidence only if it reports the work that actually happened. `grep -qi digest`
# matched the workflow's own vocabulary, so a run that announced "## Step 7: Digest" and then
# aborted scored green. Anchor on the commit the fixture repo really has instead.
assert_digest() {  # transcript, proj
  local out=$1 proj=$2 sha
  sha=$(git -C "$proj" log -1 --format=%h 2>/dev/null)
  if [ -n "$sha" ] && grep -q "$sha" <<<"$out"; then
    ok "digest reports the commit the repo actually has ($sha)"
  else
    bad "digest does not name the real commit (${sha:-none}) — it may be narration, not a result"
  fi
}

# Same problem: "root cause" appears in a digest that says "I could not determine the root
# cause". Require the phrase AND the absence of a stated non-finding.
assert_root_cause() {  # transcript
  local flat
  flat=$(printf '%s' "$1" | tr -d '*_`|#' | tr -s '[:space:]' ' ' | tr '[:upper:]' '[:lower:]')
  if ! grep -q "root cause" <<<"$flat"; then
    bad "no root cause in the digest"
  elif grep -qE "root cause:? *(none|unknown|not (found|determined|identified)|n/a)" <<<"$flat"; then
    bad "digest states it did NOT find a root cause"
  else
    ok "digest carries the root cause"
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

cell_feature() {  # subagents: yes|no
  local subs=$1 home out
  say "feature x subagents ${subs}"
  home=$(setup_home "$subs")
  out=$(run_workflow "$home" principal-feature \
    "add a file named greet.txt containing the word hello")

  local proj="$home/proj"
  if [ "$(git -C "$proj" log --oneline | wc -l)" -gt 1 ]; then ok "the spine committed"; else bad "no commit — the workflow did not reach git-ops"; fi
  # Existence is not delivery: an empty greet.txt passed the old check, so assert the content
  # the task actually asked for.
  if [ ! -f "$proj/greet.txt" ]; then bad "greet.txt missing"
  elif grep -qi "hello" "$proj/greet.txt"; then ok "the change landed in the caller's checkout, with the right content"
  else bad "greet.txt exists but does not contain 'hello'"; fi
  if [ -z "$(git -C "$proj" status --porcelain)" ]; then ok "working tree clean (build's change was committed, not left loose)"; else bad "tree dirty after the spine finished"; fi

  assert_digest "$out" "$proj"
  assert_delegation "$out" "$subs"
  assert_dev_repo_untouched
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-feature-$subs.txt"
  rm -rf "$home"
}

cell_bugfix() {  # subagents: yes|no
  local subs=$1 home out
  say "bugfix x subagents ${subs}"
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
  out=$(run_workflow "$home" principal-bugfix \
    "sum([1,2,3]) returns 3 instead of 6 in sum.js — the last element is dropped")

  local proj="$home/proj"
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

  assert_digest "$out" "$proj"
  assert_root_cause "$out"
  assert_delegation "$out" "$subs"
  assert_dev_repo_untouched
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-bugfix-$subs.txt"
  rm -rf "$home"
}

# --self-test: exercise the delegation classifier against the last captured transcripts.
# Costs no model calls. The classifier is the only thing standing between an inline fallback
# and a green `present` cell, so it gets checked in BOTH directions or not at all.
if [ "${1:-}" = --self-test ]; then
  for f in "$ROOT"/tests/e2e/last-*.txt; do
    [ -f "$f" ] || continue
    case "$(basename "$f")" in *-no.txt) want=inline ;; *-yes.txt) want=delegated ;; *) continue ;; esac
    got=$(classify_delegation "$(cat "$f")")
    if [ "$got" = "$want" ]; then ok "$(basename "$f") classified $got"
    else bad "$(basename "$f") classified $got, expected $want"; fi
  done
  [ "$pass" -gt 0 ] || { echo "no transcripts to self-test against (run the cells first)"; exit 1; }
  printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]; exit
fi

CELLS=("${@:-feature-absent bugfix-absent feature-present bugfix-present}")
for c in ${CELLS[@]}; do
  case "$c" in
    feature-absent)  cell_feature no  ;;
    feature-present) cell_feature yes ;;
    bugfix-absent)   cell_bugfix  no  ;;
    bugfix-present)  cell_bugfix  yes ;;
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
