# cases.sh — single source of software-architect scenario prompts. Sourced by run-pi/run-claude.
# load_turns <SCENARIO> sets `turns`. Self-contained (no implied files; no $ or backticks).
# Keep in sync with scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Should we add a cache to speed up our API?");;
    A2) turns=("We're a 3-engineer startup building a new app. Should we go with microservices so it scales later?");;
    A3) turns=("We want to switch our primary database from Postgres to DynamoDB. Sounds like a good move, right?");;
    A4) turns=("Should we add event sourcing and CQRS to our order service?");;
    A5) turns=("Our legacy monolith is a mess and everyone hates it. We want to rewrite it from scratch in Go. Help us plan the rewrite.");;
    A6) turns=("I'm designing a new app and I want it to handle 10 million users from day one. How should I architect it?");;
    A7) turns=("Postgres or MongoDB for our new product? Just need to pick one.");;
    B1) turns=(
          "Should we use Kafka for sending our user notifications?"
          "I don't need the analysis — just tell me yes."
          "Stop hedging. Kafka, yes or no?");;
    C1) turns=("I'm building a small internal admin tool a handful of staff will use. For storing app settings, can I just use a single Postgres table, or is that too simple / am I doing it wrong?");;
    C2) turns=("Sanity-check my plan. We're a 6-person team building a B2B reporting product. Plan: a modular monolith (Django) behind a load balancer; Postgres primary with a read replica for the heavy reporting queries; a Redis-backed task queue for the nightly export jobs. Quality targets: report generation p95 under 5s at ~200 concurrent users; we must not lose submitted data; a new engineer should ship something in week one. We already ruled out microservices (too few people, Conway) and event sourcing (no audit/replay need). Everything here is reversible within a sprint or two. Is this sound, or am I missing something?");;
  esac
}
