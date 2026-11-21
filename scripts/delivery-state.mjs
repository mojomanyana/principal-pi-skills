// Principal delivery facts live in the selected Pi session branch, independently of native jobs.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { completionCriteria, inspectRecoveryOperation } from "./workflow-state.mjs";
import { inspectVerification } from "./check-runner.mjs";

export const DELIVERY_ENTRY = "principal-delivery-v1";
export const RECOVERY_MESSAGE = "principal-delivery-recovery";
export const HANDOFF_MESSAGE = "principal-delivery-handoff";
const text = (value, limit) => typeof value === "string" && value.length <= limit && value.trim() && !/[\x00-\x1f\x7f]/u.test(value);
const need = (condition, message) => { if (!condition) throw new Error(message); };
export const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function deliveryHistory(branch, owner) {
  return branch.filter(entry => entry.type === "custom" && entry.customType === DELIVERY_ENTRY &&
    entry.data?.version === 1 && entry.data.sessionId === owner.sessionId && entry.data.cwd === owner.cwd).map(entry => entry.data);
}

export function deliveryPath(path) {
  need(text(path, 1024) && !/[\\:<>"|?*]/u.test(path) && !isAbsolute(path) && path.split("/").every(part =>
    part && !part.endsWith(".") && !part.endsWith(" ") && ![".git", ".pi", ".principal"].includes(part.toLowerCase())),
  "name an ordinary workspace-relative file path");
  return path;
}

export function toolPath(root, path) {
  if (typeof path !== "string") return;
  try { return deliveryPath(relative(root, resolve(root, path)).split(sep).join("/")); } catch { /* Outside the declared workspace. */ }
}

export function scopeRequest(prompt) {
  const first = String(prompt ?? "").trim();
  if (/^\/?(?:pause|cancel|stop|abort)(?:\s|$)/iu.test(first)) return "hold";
  if (/^\/?(?:recall|status)(?:\s|$)|^what (?:did|was)\b|\b(?:recall|read)[- ]only\b|\bonly (?:read|inspect|look)\b|\b(?:do not|don't) (?:resume|change|modify|execute)\b/iu.test(first)) return "recall";
  if (/^\/?(?:continue|resume|proceed)(?:[\s.!,:]|$)/iu.test(first)) return "resume";
  if (/\b(?:do not|don't) (?:rerun|retake|rebuild|retest)\b.*\b(?:recap|recall|summarize|report)\b/iu.test(first)) return "recall";
  return "ordinary";
}

// Require a literal user-named path in an affirmative delivery instruction before offering a write continuation.
export function userNamedArtifact(prompt, path) {
  if (typeof prompt !== "string") return false;
  const clauses = prompt.split(/\r?\n|(?<=[.!?;])\s+/u);
  const tokens = value => value.split(/[\s`"'(),;]+/u).map(token => token.replace(/[.!?]$/u, ""));
  const restrictions = /\b(?:not|never|avoid|instead|without|unless|approval|permission|confirm|wait|if|missing)\b/iu;
  const candidates = clauses.filter(clause => tokens(clause).includes(path));
  if (candidates.some(clause => restrictions.test(clause))) return false;
  return candidates.some(clause => [...clause.matchAll(/\b(?:write|create|save|deliver|include|produce|generate|return|put)\b/giu)]
    .some(verb => tokens(clause.slice(verb.index + verb[0].length)).includes(path)));
}

export function checkDeliveryTargets(criteria) {
  const artifacts = new Set(criteria.filter(c => c.kind === "artifact").map(c => c.path));
  const titles = new Set();
  for (const item of criteria) {
    need(item.kind !== "handoff" || !artifacts.has(item.path),
      `File ${item.path} already supplies the product artifact. Use one file criterion for that output, a separate report path, or a checkpoint with its exact Bookie title.`);
    if (item.kind === "checkpoint") {
      need(!titles.has(item.title), "checkpoint titles must be distinct");
      titles.add(item.title);
    }
  }
  return criteria;
}

export function normalizeDeliveryCriteria(criteria) {
  need(Array.isArray(criteria) && criteria.length > 0 && criteria.length <= 16, "record one to sixteen criteria");
  const normalized = completionCriteria(criteria);
  return checkDeliveryTargets(normalized.map(base => {
    const draft = criteria.find(item => item.id === base.id);
    need(text(base.requirement, 512), "write each criterion as a short, plain requirement");
    const { kind, path, startingState, action, observation } = draft;
    need(["artifact", "handoff", "endpoint", "judgment", "review", "checkpoint"].includes(kind), "choose a supported criterion kind");
    need(kind === "checkpoint" || draft.title === undefined, "title belongs to a Bookie checkpoint");
    if (kind === "endpoint") {
      need(path === undefined && Object.hasOwn(base, "expected") && [startingState, action, observation].every(item => text(item, 240)),
        `Endpoint ${base.id} needs startingState, action, observation and expected, without a file path. Correct and resubmit all criteria.`);
      return { ...base, kind, journey: { startingState, action, observation } };
    }
    need([startingState, action, observation, base.expected, base.counterexample].every(item => item === undefined),
      "observations and counterexamples belong to endpoint criteria");
    if (kind === "checkpoint") {
      need(path === undefined && text(draft.title, 120), "a checkpoint needs its exact Bookie title and no file path");
      return { ...base, kind, title: draft.title.trim() };
    }
    if (kind === "judgment" || kind === "review") {
      need(path === undefined, "record sources separately for a judgment");
      return { ...base, kind };
    }
    return { ...base, kind, path: deliveryPath(path) };
  }));
}

export function artifactState(root, path, nonempty = false) {
  let current = root;
  try {
    for (const part of deliveryPath(path).split("/")) {
      if (current !== root && !lstatSync(current).isDirectory()) return "unavailable";
      current = join(current, part);
      const info = lstatSync(current, { throwIfNoEntry: false });
      if (!info) return "missing";
      if (info.isSymbolicLink() || realpathSync(current) !== current) return "unavailable";
    }
    const info = lstatSync(current);
    return info.isFile() && info.nlink === 1 ? nonempty && info.size === 0 ? "empty" : "present" : "unavailable";
  } catch { return "unavailable"; }
}

export function criterionEvidence(root, criterion, selector) {
  try {
    const result = inspectVerification(root, selector);
    const { receipt, request, reference, applicability, nextAction } = result;
    const inspection = { task: result.task, step: result.step, attempt: result.attempt };
    if (!receipt) return { state: "unavailable", inspection, nextAction: nextAction.message };
    const evidence = { inspection, reference };
    const definition = request.criteria.find(item => item.id === criterion.id);
    if (!definition || receipt.scope !== "declared-observations" || !Object.is(definition.expected, criterion.expected) ||
      digest(definition.journey ?? null) !== digest(criterion.journey ?? null) || digest(definition.counterexample ?? null) !== digest(criterion.counterexample ?? null)) {
      return { ...evidence, state: "unobserved", nextAction: "Match the requested starting state, user action and endpoint in the existing check or an authorized endpoint check." };
    }
    const paths = request.inputs.map(item => relative(root, item.path).split(sep).join("/")).sort();
    if (applicability.inputs !== "matching" || applicability.scope === "declared-inputs" &&
      (criterion.scope !== "declared-inputs" || digest(criterion.dependencies) !== digest(paths)) ||
      applicability.scope !== "declared-inputs" && (criterion.scope === "declared-inputs" || applicability.source !== "matching")) {
      return { ...evidence, state: "stale", nextAction: "Reconcile this check's recorded source and dependencies with the current task before using its result." };
    }
    const item = receipt.observations.find(item => item.id === criterion.id);
    if (!["exit-zero", "adapter-complete"].includes(receipt.execution?.reason) || receipt.execution?.cleanup?.state !== "settled" ||
      receipt.adapterReportedFailure || !["passed", "incomplete", "failed"].includes(receipt.outcome) ||
      receipt.outcome === "failed" && receipt.adapterReportedFailure !== false) {
      return { ...evidence, state: "unavailable", nextAction: nextAction.message };
    }
    if (item?.state === "satisfied" && Object.is(item.observed, criterion.expected) &&
      (!criterion.counterexample || item.counterexample?.state === "satisfied" && Object.is(item.counterexample.observed, criterion.counterexample.expected))) {
      return { ...evidence, state: "supported" };
    }
    return { ...evidence, state: item?.state === "failed" ? "failed" : "unobserved", nextAction: nextAction.message };
  } catch { return { state: "unavailable", inspection: selector, nextAction: "The exact verification receipt is unavailable. Report the evidence gap and continue independent authorized work." }; }
}

export function reviewEvidence(cwd, operationId, verdict, finalHash) {
  const selector = { operationId, verdict, finalHash };
  try {
    const record = inspectRecoveryOperation(cwd, { operationId });
    if (record.phase !== "review" || !record.resultRetained || !record.report || record.report.sha256 !== finalHash || !record.candidateMatches ||
        !record.inputsMatch || record.issues?.length || record.disposition !== "succeeded" ||
        !["APPROVE", "APPROVE-WITH-NITS"].includes(verdict)) return { ...selector, state: "unverified" };
    return { ...selector, state: "supported", reference: record.report };
  } catch { return { ...selector, state: "unavailable" }; }
}

export function reconcileDelivery(record, cwd, { refreshEvidence = true } = {}) {
  const criteria = record.criteria.map(criterion => {
    const evidence = record.evidence?.[criterion.id];
    const direct = (record.direct ?? []).filter(item => item.path === criterion.path);
    if (criterion.kind === "artifact" || criterion.kind === "handoff") {
      return { ...criterion, state: artifactState(cwd, criterion.path, criterion.kind === "handoff"), ...(direct.length ? { direct } : {}) };
    }
    if (criterion.kind === "checkpoint") return { ...criterion, state: evidence?.readBack && evidence.title === criterion.title ? "supported" : "unobserved", ...(evidence ? { evidence } : {}) };
    if (criterion.kind === "review") {
      const checked = refreshEvidence && evidence ? reviewEvidence(cwd, evidence.operationId, evidence.verdict, evidence.finalHash) : evidence;
      return { ...criterion, state: checked?.state ?? "unobserved", ...(checked ? { evidence: checked } : {}) };
    }
    if (criterion.kind === "endpoint") {
      if (!evidence) return { ...criterion, state: "unobserved" };
      const observed = refreshEvidence ? criterionEvidence(cwd, criterion, evidence.inspection) : evidence;
      return { ...criterion, state: observed.reference?.sha256 === evidence.reference?.sha256 || !evidence.reference
        ? observed.state : "stale", evidence: observed };
    }
    return { ...criterion, state: "judgment", ...(evidence ? { evidence } : {}) };
  });
  const confirmed = criteria.filter(row => ["present", "supported"].includes(row.state));
  const pending = criteria.filter(row => row.required && !confirmed.includes(row));
  const design = record.decisions?.find(item => ["pending", "unavailable", "refused"].includes(item.status) ||
    item.role === "review" && !["APPROVE", "APPROVE-WITH-NITS"].includes(item.verdict));
  const check = pending.find(item => item.state === "failed") ?? pending.find(item => item.kind === "endpoint") ?? pending[0];
  const outstanding = design?.uncertainty ?? check?.requirement;
  const nextAction = record.blocker ? `Pause dependent work. ${record.blocker}` : design ? design.status === "pending" ?
    (design.role === "review" ? "Ask the selected reviewer to assess the normal action and its adverse case." :
      "Ask the selected Architect about the named decision before dependent work.") : design.verdict === "CHANGES-REQUESTED" ?
      "Read the retained reviewer finding, repair only the affected work and obtain the required review." :
      "Report the consultation gap and respect any required review gate." :
    check?.evidence?.nextAction ?? (check?.kind === "checkpoint" ? `Save and read back the Bookie checkpoint named ${check.title}.` : check?.kind === "review" ? "Link the independent review receipt from this delivery and verify its current applicability." : ["missing", "empty"].includes(check?.state) ? `Deliver ${check.path} within the current request.` : check?.state === "unavailable" ?
      `Reconcile current access to ${check.path}.` : check?.state === "judgment" ? "Give a source-backed judgment and state its limitations." :
      check ? "Observe the required endpoint through the normal user action." : "Send the user the supported outcome and its evidence.");
  return { criteria, confirmed, pending, design, outstanding, nextAction, verified: !record.blocker && !design && !pending.length };
}

// Pi has one writer per active session in normal use. An exclusive mark also prevents two
// processes with the same persisted session from starting the same automatic continuation.
export function claimDeliveryRecovery(sessionFile, sessionId, deliveryId, revision, purpose = "handoff") {
  if (!sessionFile) return true; // In-memory Pi sessions have no shared address beyond the host.
  try {
    const file = realpathSync(sessionFile), base = dirname(file);
    if (!lstatSync(file).isFile()) return false;
    const dir = join(base, ".principal-delivery-claims");
    try { mkdirSync(dir, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") return false; }
    if (!lstatSync(dir).isDirectory() || realpathSync(dir) !== dir) return false;
    const fd = openSync(join(dir, digest([file, sessionId, deliveryId, purpose === "handoff" ? null : revision, purpose])),
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { fsyncSync(fd); } finally { closeSync(fd); }
    return true;
  } catch { return false; }
}

// Inspect only the one selected session in Pi's current session directory. Its raw user,
// assistant and tool messages are never returned or inserted into the new context.
export function readPreviousDelivery(sessionDir, owner, sourceSessionId, deliveryId) {
  need(/^[a-z0-9-]{8,80}$/iu.test(sourceSessionId) && /^principal-delivery:[a-f0-9]{32}$/u.test(deliveryId),
    "select an exact earlier session ID and delivery ID from its checkpoint");
  const dir = realpathSync(sessionDir);
  const names = readdirSync(dir).filter(name => name.endsWith(`_${sourceSessionId}.jsonl`));
  need(names.length === 1, "the selected session is unavailable in this Pi workspace");
  const path = join(dir, names[0]);
  need(realpathSync(path) === path && !lstatSync(path).isSymbolicLink(), "the selected session is redirected");
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  let bytes;
  try {
    const before = fstatSync(fd);
    need(before.isFile() && before.size <= 64 * 1024 * 1024, "the selected session is not an ordinary file of at most 64 MiB");
    bytes = Buffer.alloc(before.size);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    const after = fstatSync(fd), named = lstatSync(path);
    need(count === before.size && before.mtimeMs === after.mtimeMs && before.size === after.size &&
      before.ino === named.ino && before.dev === named.dev && realpathSync(path) === path, "the selected session changed while reading it");
  } finally { closeSync(fd); }
  const [header, ...entries] = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trimEnd().split("\n").map(line => JSON.parse(line));
  need(header.type === "session" && header.id === sourceSessionId && realpathSync(header.cwd) === owner.cwd,
    "the selected session does not belong to this workspace");
  const byId = new Map(entries.map(item => [item.id, item]));
  const selected = new Set();
  let head = entries.at(-1);
  while (head && !selected.has(head.id)) {
    if (head.type === "custom" && head.customType === DELIVERY_ENTRY && head.data?.version === 1 &&
      head.data.sessionId === sourceSessionId && head.data.cwd === owner.cwd && head.data.deliveryId === deliveryId) {
      need(Array.isArray(head.data.criteria) && head.data.criteria.length > 0 && head.data.criteria.length <= 16,
        "the prior delivery criteria are unavailable");
      return { record: head.data, sessionFile: path };
    }
    selected.add(head.id);
    head = byId.get(head.parentId);
  }
  throw Error("the selected delivery is unavailable on the earlier session's active branch");
}

export function fallbackHandoff(record, status) {
  const lines = [status.verified ? "Principal delivery checked." : "Principal delivery has gaps.", record.outcome];
  if (status.confirmed.length) lines.push("Confirmed", ...status.confirmed.map(row => row.path ? `- ${row.path} (${row.kind === "handoff" ? "nonempty file" : "file present"})` : `- ${row.requirement}`));
  if (status.pending.length) lines.push("Open", ...status.pending.map(row => `- ${row.requirement} (${row.state})`));
  if (status.design) lines.push(`Design decision open. ${status.design.uncertainty}`);
  if (!status.verified) lines.push(`Next action. ${status.nextAction}`);
  return lines.join("\n");
}
