import { createHash } from "node:crypto";

const digest = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value, (_key, field) =>
  field && typeof field === "object" && !Array.isArray(field)
    ? Object.fromEntries(Object.keys(field).sort().map(key => [key, field[key]]))
    : field);
const kinds = ["improve-skill", "new-skill", "new-subagent", "lesson"];

// Only these fixed repair hints are exposed in tool errors, never input bodies.
export class ProposalInputError extends Error {}
function requireInput(condition, message) {
  if (!condition) throw new ProposalInputError(message);
}
function phrase(value, label, max) {
  requireInput(typeof value === "string" && value.trim() && value.length <= max &&
    !/[\u0000-\u001f\u007f]/u.test(value), `Give ${label} as a short, single line (up to ${max} characters).`);
  return value.trim();
}

function durableReference(reference) {
  // Bookie renews the access bundle on /new. Its exact source identity persists.
  if (reference.kind !== "bookie-context-input") return reference;
  const { bundleId: _sessionBundle, ...source } = reference;
  return source;
}

function mentionsTask(source, id) {
  // A copied prefix such as T-1 in T-10 cannot turn one task into two.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, "u").test(source);
}

function supportingTasks(cases) {
  // Retries, alternate names for one record, and a source reused across bundles
  // are one case. Merge transitively so ordering cannot inflate the count.
  let groups = [];
  for (const row of cases.filter(item => item.basis === "task-record" && item.stance === "supports")) {
    const keys = new Set([`task:${row.taskId.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ")}`,
      `body:${row.sourceDigest}`, ...row.references.map(ref => {
        if (ref.kind === "bookie-context-input") return `bookie:${ref.uid ?? ref.path}`;
        if (ref.kind === "file") return `file:${ref.path}`;
        return `ref:${canonical(ref)}`;
      })]);
    const separate = [];
    for (const group of groups) {
      if ([...group].some(key => keys.has(key))) for (const key of group) keys.add(key);
      else separate.push(group);
    }
    groups = [...separate, keys];
  }
  return groups.length;
}

// Input availability is established by the caller's live resolveHandoff, never by a tool parameter.
// Exact citation matching establishes provenance. The coordinator and user judge what it means.
export function buildLearningProposal(handoff, resolved, draft) {
  requireInput(resolved?.state === "ready" && resolved.handoffId === handoff?.id &&
    handoff.profile === "task" && !handoff.optional.length, "Prepare a task handoff with every selected source required.");
  requireInput(draft && kinds.includes(draft.kind), "Select an existing-skill improvement, new skill, new subagent or lesson.");
  requireInput(Array.isArray(draft.cases) && draft.cases.length > 0 &&
    draft.cases.length === resolved.inputs.length && draft.cases.length <= 8,
    "Include one case for every selected source, up to eight, including limiting evidence.");
  const coverage = draft.coverage ?? "unknown";
  requireInput(["gap", "covered", "unknown"].includes(coverage), "Check whether the current skill or registry already covers the change.");
  const card = { version: 1, kind: draft.kind, scope: handoff.scope, coverage, target: phrase(draft.target, "the destination", 120),
    change: phrase(draft.change, "the proposed change", 360), alternative: phrase(draft.alternative, "the simpler alternative considered", 240),
    limits: phrase(draft.limits, "the limits or exceptions", 240), trial: phrase(draft.trial, "the outcome check and comparison", 360),
    caveats: handoff.caveats };
  if (draft.kind === "new-subagent") {
    requireInput(draft.boundary, "Describe the separate responsibility, inputs, output and minimum tools of the proposed subagent.");
    card.boundary = Object.fromEntries(["reason", "inputs", "output", "tools"].map(key =>
      [key, phrase(draft.boundary[key], `subagent ${key}`, 180)]));
  } else requireInput(draft.boundary === undefined, "Only a new subagent needs a separate role boundary.");

  const seen = new Set();
  card.evidence = draft.cases.map(row => {
    const source = resolved.inputs.find(input => input.id === row?.inputId);
    requireInput(source && !seen.has(source.id), "Use each prepared input ID exactly once.");
    requireInput(source.references.length === 1, "Select one exact source per case so the task and quote come from the same record.");
    seen.add(source.id);
    const taskId = phrase(row.taskId, "a task identifier present in the source", 120);
    const quote = phrase(row.quote, "a short exact outcome excerpt", 360);
    requireInput(mentionsTask(source.excerpt, taskId) && source.excerpt.includes(quote),
      "Use the task name or ID and an exact outcome excerpt from the selected source.");
    requireInput(["task-record", "report", "fixture"].includes(row.basis) &&
      ["supports", "limits", "contradicts"].includes(row.stance), "Identify each source's basis and whether it supports or limits the proposal.");
    const sourceDigest = digest(source.excerpt);
    return { taskId, basis: row.basis, stance: row.stance, quote, sourceDigest, references: source.references.map(durableReference) };
  }).sort((a, b) => Buffer.compare(Buffer.from(canonical(a)), Buffer.from(canonical(b))));
  const supportingTaskCount = supportingTasks(card.evidence);
  const conflicts = card.evidence.some(row => row.stance === "contradicts");
  const state = draft.kind === "lesson" || coverage === "covered" ? "lesson" :
    supportingTaskCount < 2 || conflicts || coverage === "unknown" ? "needs-evidence" : "proposed";
  // The revision covers the exact evidence, scope, limitations and intended change.
  const proposalId = `proposal:${digest(canonical(card))}`;
  return { version: 1, state, proposalId, handoffId: handoff.id, card, supportingTaskCount,
    approval: false, administrativeWrites: false, executionAuthorized: false,
    nextAction: state === "lesson" ? "Keep the scoped lesson with its evidence for the next applicable task." :
      state === "proposed" ? "Show the exact revision, evidence, alternative and trial. Ask the user whether to adopt it." :
      coverage === "unknown" ? "Inspect the current skill or agent registry and record the remaining gap." :
      conflicts ? "Resolve the contrary evidence or narrow the proposal before asking for adoption." :
      "Keep this as a hypothesis until there are supporting records from different tasks." };
}
