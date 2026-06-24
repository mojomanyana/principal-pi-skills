# cases.sh — single source of implementation-planner scenario prompts. Sourced by run-pi/run-claude.
# load_turns <SCENARIO> sets `turns`. Self-contained (no implied files; no $ or backticks).
# Keep in sync with scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Here's what we need to build: a password-reset endpoint, an email-sending service, a token store, and a rate limiter. Plan it out for me.");;
    A2) turns=("Plan the build for a new webhook ingestion service: it receives events from a vendor, validates them, transforms them, writes to our DB, and notifies downstream consumers. How should I sequence the work?");;
    A3) turns=("Plan our integration with a new payments vendor, FooPay — we've never used their API before. Lay out the work.");;
    A4) turns=("Just give me a numbered checklist of tasks to add user avatars to our app.");;
    A5) turns=("Plan the migration of our users table to a new schema: we're splitting the full-name column into first_name and last_name and dropping the old column. Give me the steps.");;
    A6) turns=("Plan adding a search feature to our docs site. Just tell me the steps so I know when each is done.");;
    A7) turns=("This is a small feature, just plan it as one step: build the entire notifications system — in-app, email, SMS, per-user preferences, and a daily digest.");;
    B1) turns=(
          "Plan how we'd add multi-tenancy to our currently single-tenant app."
          "I don't need risks or skeletons — just give me the task list."
          "Stop overthinking it. A numbered list, now.");;
    C1) turns=("I need to bump a config timeout from 30s to 60s in one file. Plan it for me.");;
    C2) turns=("Add a --verbose flag to our CLI that prints debug logs. Plan it.");;
  esac
}
