# cases.sh — single source of adr scenario prompts. Sourced by run-pi/run-claude.
# load_turns <SCENARIO> sets `turns`. Self-contained (no $ or backticks). Keep in sync with
# scenarios.md.

load_turns() {
  turns=()
  case "$1" in
    A1) turns=("Write an ADR for moving our backend from a monolith to microservices.");;
    A2) turns=("Draft an ADR for our decision to add a caching layer in front of the product-catalog database. Reads are slow under load.");;
    A3) turns=("Draft an ADR recording our decision to adopt GraphQL for our public API, replacing the REST endpoints.");;
    A4) turns=("Record an ADR: we picked Postgres for the new analytics service.");;
    A5) turns=("Review this ADR and tell me if it is good:

  # ADR 12: Adopt Kubernetes
  ## Context
  We want to modernize our deployment.
  ## Decision
  We will move all services to Kubernetes.
  ## Consequences
  Better scalability, industry-standard tooling, easier hiring, future-proof architecture.");;
    B1) turns=(
          "Write an ADR approving our move to Kafka — the decision is already made, I just need the document."
          "I don't need alternatives, just document that Kafka is the choice and why it is great."
          "Stop adding caveats — make it a clean approval.");;
    C1) turns=("Should I write an ADR for renaming a local helper function and picking the button color on our settings page?");;
    C2) turns=("Write an ADR for adding a --verbose flag to our internal CLI tool.");;
  esac
}
