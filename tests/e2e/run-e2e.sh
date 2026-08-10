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
PI_PKG="$(dirname "$(readlink -f "$(command -v pi)")")/.."
EXT="$PI_PKG/examples/extensions/subagent"

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
  home=$(mktemp -d); proj="$home/proj"; mkdir -p "$proj"
  cp ~/.pi/agent/auth.json ~/.pi/agent/models-store.json "$home/.pi/agent/" 2>/dev/null || true
  # Persistent identity, not `-c` on our own commit: the workflow's git-ops phase runs its
  # OWN `git commit`, and without a configured identity it correctly stops and asks. That is
  # right behaviour from the skill and a broken fixture from us.
  ( cd "$proj" && git init -q -b main \
      && git config user.email e2e@local && git config user.name e2e \
      && git commit -q --allow-empty -m base )
  HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" pi install "npm:$TARBALL" >/dev/null 2>&1
  mkdir -p "$home/.pi/agent"
  cp ~/.pi/agent/auth.json ~/.pi/agent/models-store.json "$home/.pi/agent/" 2>/dev/null || true
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
    mkdir -p "$home/.pi/agent/extensions/subagent"
    cp "$EXT/index.ts" "$EXT/agents.ts" "$home/.pi/agent/extensions/subagent/" 2>/dev/null
    HOME="$home" PI_CODING_AGENT_DIR="$home/.pi/agent" \
      node "$home/.pi/agent/npm/node_modules/principal-pi-skills/scripts/install-agents.mjs" \
      install >/dev/null 2>&1
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

cell_feature() {  # subagents: yes|no
  local subs=$1 home out
  say "feature x subagents ${subs}"
  home=$(setup_home "$subs")
  out=$(run_workflow "$home" principal-feature \
    "add a file named greet.txt containing the word hello")

  local proj="$home/proj"
  if [ "$(git -C "$proj" log --oneline | wc -l)" -gt 1 ]; then ok "the spine committed"; else bad "no commit — the workflow did not reach git-ops"; fi
  if [ -f "$proj/greet.txt" ]; then ok "the change landed in the caller's checkout"; else bad "greet.txt missing"; fi
  if [ -z "$(git -C "$proj" status --porcelain)" ]; then ok "working tree clean (build's change was committed, not left loose)"; else bad "tree dirty after the spine finished"; fi

  grep -qi "digest" <<<"$out" && ok "closed with a digest" || bad "no digest"
  if [ "$subs" = no ]; then
    grep -qiE "inline" <<<"$out" && ok "digest names the inline fallback" \
      || bad "ran inline but did not say so — the honesty requirement"
  else
    # Guard against a vacuous pass: an aborted run has no "inline" claim either, so require
    # positive evidence the spine actually delegated before crediting it.
    if grep -qiE "no .*subagent available|inline phases: .*(plan|review)" <<<"$out"; then
      bad "claims inline while subagents ARE installed"
    elif grep -qiE "subagent|delegat|principal-(plan|review|debug)" <<<"$out"; then
      ok "delegated to a subagent rather than running inline"
    else
      bad "no evidence of delegation — and no inline claim either; the run produced neither"
    fi
  fi
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
  # Require the file to EXIST before judging it: `! grep -q` on a missing file succeeds,
  # so the old form scored a deleted sum.js as "fixed".
  if [ ! -f "$proj/sum.js" ]; then bad "sum.js is gone — the fix cannot be verified"
  elif grep -q "xs.length - 1" "$proj/sum.js"; then bad "sum.js still drops the last element"
  else ok "the off-by-one is actually fixed"; fi
  if [ -z "$(git -C "$proj" status --porcelain)" ]; then ok "working tree clean"; else bad "tree dirty"; fi

  grep -qi "digest" <<<"$out" && ok "closed with a digest" || bad "no digest"
  grep -qiE "root cause" <<<"$out" && ok "digest carries the root cause" || bad "no root cause in the digest"
  assert_dev_repo_untouched
  printf '%s\n' "$out" > "$ROOT/tests/e2e/last-bugfix-$subs.txt"
  rm -rf "$home"
}

CELLS=("${@:-feature-absent bugfix-absent feature-present bugfix-present}")
for c in ${CELLS[@]}; do
  case "$c" in
    feature-absent)  cell_feature no  ;;
    feature-present) cell_feature yes ;;
    bugfix-absent)   cell_bugfix  no  ;;
    bugfix-present)  cell_bugfix  yes ;;
    *) echo "unknown cell: $c" ;;
  esac
done

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
