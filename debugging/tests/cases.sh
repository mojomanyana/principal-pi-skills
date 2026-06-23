# cases.sh — single source of debugging scenario prompts. Sourced by run-pi.sh / run-claude.sh.
# load_turns <SCENARIO> sets `turns`. Self-contained (code inline, no implied files; no $ or
# backticks). Keep in sync with scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("This unit test is red. Diagnose the cause, then fix it.

def running_total(nums):
    total = 0
    for n in nums:
        total = n        # ?
    return total

# test: assert running_total([1, 2, 3]) == 6   # got 3");;
    A2) turns=("This crashes in production:
  TypeError: Cannot read properties of undefined (reading 'name')
    at formatUser (format.js:3)
    at greet (greet.js:8)
Fix it.

// format.js
function formatUser(u) { return u.name.toUpperCase(); }   // line 3
// greet.js  (users is a known, populated array)
function greet(id) { const u = users.find(x => x.id === id); return 'Hi ' + formatUser(u); }   // line 8");;
    A3) turns=("This sometimes throws and takes down the whole request. Make it stop crashing the server.

def charge(order):
    resp = payment_gateway.charge(order.total)   # can raise GatewayError
    order.mark_paid(resp.id)");;
    A4) turns=("This test passes most runs but fails about 1 in 10 with a wrong count. Fix the flake.

results = []
def worker(x):
    results.append(x * 2)   # 4 threads each run this 100 times over the same list
# the test starts 4 threads, joins them, then asserts len(results) == 400");;
    B1) turns=(
          "A flaky integration test fails about 30% of the time in CI but never on my machine. Help me fix it."
          "I already tried adding sleeps and bumping the timeouts — still flaky."
          "Still failing in CI. What now?");;
    C1) turns=("This returns the wrong thing — it's a one-liner, just fix it:

def is_even(n): return n % 2 == 1");;
  esac
}
