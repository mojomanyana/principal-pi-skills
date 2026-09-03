#!/usr/bin/env node
/**
 * principal-pi-assurance — portable v3 assurance state for the two workflow prompts.
 *
 * The prompts remain the controller: they choose phases, invoke skills/agents, and keep the
 * one durable writer in Build. This tool owns the deterministic part prose cannot provide:
 * profile parsing, legal state transitions, append-only receipts, task-packet validation,
 * freshness checks, and critical-control gates. State lives outside the working tree (under
 * git's common directory, or XDG state for a non-repository cwd), so recording governance
 * never edits the product being built.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA_VERSION = "1.0";
export const PROFILES = ["lean", "standard", "critical"];
export const FINISH_CHOICES = ["merge", "pr", "keep", "discard"];
const RISK_LEVELS = ["unknown", "tiny", "substantive", "consequential"];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHA_RE = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
const DIGEST_RE = /^[a-f0-9]{64}$/i;
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ENTITY_ID_RE = /^(?!(?:constructor|prototype)$)[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PHASES = new Set([
  "architect",
  "plan",
  "plan-critique",
  "debug",
  "build",
  "review",
  "review-specification",
  "review-quality",
  "review-whole-change",
  "git-ops",
]);
const EVIDENCE_KINDS = new Set([
  "red",
  "green",
  "exact-target",
  "full-suite",
  "build",
  "lint",
  "requirements-trace",
  "risk-specific",
]);
const SIDE_EFFECTS = new Set([
  "migration",
  "push",
  "publish",
  "deletion",
  "credential-rotation",
  "production-access",
]);
const BACKFILL_CONTROLS = ["frozen-diff-review", "requirements-trace", "risk-specific"];
const ASSURANCE_SOURCES = new Set(["default", "flag", "alias", "natural-language", "policy", "user", "user-downgrade"]);
const GATES = ["pre-build", "task-complete", "finalize", "finish", "repair", "side-effect"];
const GATE_CODES = new Set(["OK", "BLOCKED_ASSURANCE", "BLOCKED_CRITICAL_ASSURANCE"]);
const ISO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/;

export const EVENT_CONTRACT = `# principal-pi-assurance event contract v1
Append: principal-pi-assurance event --run-id ID <<<'{"type":"...",...}'
Inspect: principal-pi-assurance show --run-id ID
Gate: principal-pi-assurance gate --run-id ID --gate pre-build|task-complete|finalize|finish|repair|side-effect [--task-id ID] [--action ACTION]
The CLI supplies at, seq, run_id and hash-chain fields. Payload shapes:
  risk_classified {type, level:tiny|substantive|consequential, reason; level is monotonic}
  workspace_attached {type, workspace_id, mode:caller|owned-isolated, path, writer:"build"; ID/root binding is immutable}
  design_approved {type, design_digest, validation_strategy, observability, rollback_strategy, abort_strategy, one_way_doors:[], approved_by:"user"}
  plan_recorded {type, plan_digest}
  plan_critique_recorded {type, verdict:APPROVE|CHANGES-REQUESTED, context_id, plan_digest}
  task_packet_recorded {type, packet:<assurance-task-packet-v1>; critical packets follow plan critique; task IDs are immutable}
  task_packet_superseded {type, task_id, reason; only after a new plan makes the packet stale}
  phase_started {type, phase, task_id?, workspace_id?, definition_digest?; all three bindings required for critical Build}
  phase_completed {type, phase; plan changes require plan_recorded}
  phase_blocked {type, phase, reason}
  code_changed {type, head_sha, tree_sha, task_id?, changed_paths:[]; scoped critical changes require the matching active Build phase}
  evidence_recorded {type, kind:red|green|exact-target|full-suite|build|lint|requirements-trace|risk-specific, command, exit_code, head_sha, tree_sha, task_id?, workspace_id?}
  review_recorded {type, axis:specification|quality|whole-change|combined, verdict:APPROVE|APPROVE-WITH-NITS|CHANGES-REQUESTED|UNVERIFIED, context_id, head_sha, tree_sha, task_id?, workspace_id?, spec_verdict+quality_verdict required for whole-change}
  finding_recorded {type, finding_id, summary, evidence?}
  finding_adjudicated {type, finding_id, disposition:accepted|rejected|needs-context, reason}
  repair_started {type, finding_id, task_id?, workspace_id?, definition_digest?; bindings required for critical}
  repair_suspended {type, finding_id, reason; audited interruption before escalation rebinds}
  repair_completed {type, finding_id, head_sha, tree_sha, changed_paths:[], task_id?, workspace_id?, definition_digest?}
  assurance_escalated {type, to:"critical", source:policy|natural-language|user, reason, scope?, base_sha+head_sha+tree_sha after implementation began}
  assurance_downgraded {type, to:lean|standard, authorized_by:"user", reason}
  backfill_completed {type, receipts:[{control:frozen-diff-review|requirements-trace|risk-specific, base_sha, head_sha, tree_sha, result:"pass", evidence, context_id?}]}
  side_effect_approved {type, action:migration|push|publish|deletion|credential-rotation|production-access, approved_by:"user", reason}
  finish_selected {type, choice:merge|pr|keep|discard, explicit_request:true only for discard}
  finalization_completed {type, final_branch, head_sha, tree_sha; only after gate finalize and the Git operation}
  gate_evaluated {type, gate, code:OK|BLOCKED_ASSURANCE|BLOCKED_CRITICAL_ASSURANCE, missing_count, task_id?, action?; the gate command appends this itself — never append it by hand}
Never edit events.jsonl/snapshot.json. A failed critical gate prints BLOCKED_CRITICAL_ASSURANCE.`;

const fail = (message) => {
  throw new Error(message);
};
const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const validTimestamp = (value) => {
  if (!nonEmpty(value)) return false;
  const match = ISO_TIMESTAMP_RE.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const maxDay = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
  return d >= 1 && d <= maxDay && Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
    (offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59));
};
const safeEntityId = (value) => ENTITY_ID_RE.test(value ?? "");
const safeRepoPath = (value, { allowGlob = false } = {}) => {
  if (!nonEmpty(value) || isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value) || value.includes("\\")) return false;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return false;
  if (!allowGlob && /[*?\[\]]/.test(value)) return false;
  return true;
};
const ownValue = (object, key) => (object && Object.hasOwn(object, key) ? object[key] : undefined);
const clone = (value) => structuredClone(value);

/** Stable JSON is the event-log hashing and task-packet digest format. */
export function canonicalJson(value) {
  const ancestors = new Set();
  const encode = (current, path) => {
    if (current === null || typeof current === "string" || typeof current === "boolean") {
      return JSON.stringify(current);
    }
    if (typeof current === "number") {
      if (!Number.isFinite(current)) fail(`${path} must contain only finite JSON numbers`);
      return JSON.stringify(current);
    }
    if (typeof current !== "object") fail(`${path} must contain only JSON values`);
    if (ancestors.has(current)) fail(`${path} must not contain a circular reference`);
    ancestors.add(current);
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) fail(`${path} must be a plain JSON array`);
        const allowedKeys = new Set(["length", ...Array.from({ length: current.length }, (_, index) => String(index))]);
        if (Reflect.ownKeys(current).some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
          fail(`${path} must be a plain JSON array without extra properties`);
        }
        const values = [];
        for (let index = 0; index < current.length; index++) {
          const descriptor = Object.getOwnPropertyDescriptor(current, index);
          if (!descriptor) fail(`${path} must not contain sparse arrays`);
          if (!descriptor.enumerable || !("value" in descriptor)) fail(`${path}[${index}] must be an enumerable JSON value`);
          values.push(encode(descriptor.value, `${path}[${index}]`));
        }
        return `[${values.join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) fail(`${path} must contain only plain JSON objects`);
      const keys = Reflect.ownKeys(current);
      if (keys.some((key) => typeof key !== "string")) fail(`${path} must not contain symbol keys`);
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (!descriptor?.enumerable || !("value" in descriptor)) fail(`${path}.${key} must be an enumerable JSON value`);
      }
      return `{${keys
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode(current[key], `${path}.${key}`)}`)
        .join(",")}}`;
    } finally {
      ancestors.delete(current);
    }
  };
  return encode(value, "value");
}

export const digest = (value) =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");

function shellWords(text) {
  const words = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = re.exec(text))) words.push((match[1] ?? match[2] ?? match[3]).replace(/\\"/g, '"'));
  return words;
}

const POLICY_TRIGGERS = [
  ["database/schema migration", /\b(migrat(?:e|ion|ing)|schema change|drop(?:ping)? (?:a )?(?:production\s+)?(?:table|column))\b/i],
  ["authentication or authorization", /\b(auth(?:entication|orization)?|authn|authz|authoriz(?:e|ation|ing)|oauth|permission boundary|access control)\b/i],
  ["billing or payments", /\b(billing|payments?|invoices?|charges?|refunds?)\b/i],
  ["destructive data operation", /\b(truncate|destructive data|delete (?:all\s+)?(?:(?:production|customer)\s+)?data|data purge|wipe (?:all\s+)?(?:customer\s+)?records?)\b/i],
  ["public API break", /\b(breaking (?:api|change)|public api break|backwards-incompatible (?:api )?change|remove (?:a )?public endpoint)\b/i],
  ["credential or secrets work", /\b(credentials?|secrets?|api key|token rotation|private key)\b/i],
  ["protected history", /\b(force[- ]push|rewrite (?:main|master|develop)|rewrite history[^.\n]{0,60}protected (?:[a-z0-9._/-]+ )?branch|protected history)\b/i],
  ["production side effect", /\b(production (?:deploy|access|change|operation)|run in prod|roll out[^.\n]{0,60}to production)\b/i],
];

function flagValue(words, name) {
  const values = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i] === name) {
      if (!words[i + 1] || words[i + 1].startsWith("--")) fail(`${name} requires a value`);
      values.push(words[++i]);
    } else if (words[i].startsWith(`${name}=`)) {
      values.push(words[i].slice(name.length + 1));
    }
  }
  if (values.length > 1 && new Set(values.map((v) => v.toLowerCase())).size > 1) {
    fail(`conflicting ${name} values: ${values.join(", ")}`);
  }
  return values.at(-1) ?? null;
}

/** Parse command flags and the bounded natural-language critical request patterns. */
export function parseWorkflowRequest(request) {
  if (!nonEmpty(request)) fail("workflow request must be a non-empty string");
  const words = shellWords(request);
  const rawProfile = flagValue(words, "--assurance");
  const rawScope = flagValue(words, "--critical-scope");
  if (rawProfile !== null && !nonEmpty(rawProfile)) fail("--assurance requires a non-empty value");
  if (rawScope !== null && !nonEmpty(rawScope)) fail("--critical-scope requires a non-empty value");

  let requested = "standard";
  let source = "default";
  let reason = "No assurance profile was requested; standard is the default.";
  // Interpret explicit assurance intent per clause so a local negation does not veto a later,
  // affirmative escalation in the same request.
  const naturalCriticalRequest = request.split(/\bthen\b|[,.;\n]/i).some((clause) => {
    const affirmative =
      /\btreat (?:this|the (?:run|task)|this work) as (?:a )?critical(?:[- ]assurance)?\b/i.test(clause) ||
      /\b(?:escalate|elevate|raise) (?:this|the)?\s*(?:run|task)?\s*(?:to|into) critical(?: assurance| mode)?\b/i.test(clause) ||
      /\b(?:use\s+)?critical assurance\b/i.test(clause) ||
      /\bhigh assurance\b/i.test(clause);
    const negated =
      /\b(?:do not|don't|no need to|not)\b[^.\n]{0,40}\b(?:critical assurance|critical[- ]assurance|critical mode)\b/i.test(clause) ||
      /\bcritical assurance\b[^.\n]{0,30}\b(?:is |seems )?(?:unnecessary|not needed)\b/i.test(clause);
    return affirmative && !negated;
  });

  if (rawProfile) {
    const normalized = rawProfile.toLowerCase();
    if (![...PROFILES, "high"].includes(normalized)) {
      fail(`unknown assurance profile ${JSON.stringify(rawProfile)}; expected lean, standard, or critical`);
    }
    if (rawScope && !["critical", "high"].includes(normalized)) {
      fail("--critical-scope conflicts with a non-critical --assurance profile");
    }
    requested = normalized === "high" ? "critical" : normalized;
    source = normalized === "high" ? "alias" : "flag";
    reason = normalized === "high" ? "The high alias requests critical assurance." : `The user requested ${requested} assurance.`;
  } else if (rawScope) {
    requested = "critical";
    source = "flag";
    reason = "A critical scope was supplied, which explicitly requests critical assurance.";
  } else if (naturalCriticalRequest) {
    requested = "critical";
    source = "natural-language";
    reason = "The user requested critical assurance in natural language.";
  }

  const scope = rawScope
    ? {
        type: rawScope === "entire-run" ? "entire-run" : "selectors",
        selectors:
          rawScope === "entire-run"
            ? []
            : rawScope
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
      }
    : { type: "entire-run", selectors: [] };
  const scopeErrors = validateScope(scope);
  if (scopeErrors.length) fail(scopeErrors.join("; "));

  let effective = requested;
  let riskTrigger = null;
  // The policy elevation is deliberately standard -> critical. An explicit lean request is
  // not silently rewritten; one-way operations still retain their existing approval gates.
  if (requested === "standard") {
    // A risk word in the artifact being edited is not itself a risky operation. This narrow
    // exemption covers explicit docs/comment corrections and test-only renames; coordinated or
    // operational work below still wins and elevates.
    const tinyDocumentation =
      /\b(?:fix|correct|clarify|reword|rewrap|reformat|rename|update|remove)\b[^.\n]{0,80}\b(?:typo|spelling|comments?|readme|docs?|documentation|runbook wording|tests?[/\\][^\s]*|test (?:file|helper|utility|title))\b/i.test(request) &&
      !/\b(execute|apply|run (?:the )?migration|rotate|delete data|deploy|push|publish)\b/i.test(request);
    const riskAction = /\b(add|implement|enable|introduce|wire|change|modify|migrate|execute|apply|rotate|delete|deploy|integrate|drop|truncate|remove|break|refund|charge|revoke|purge|force|run|access|process|authorize)\b/i;
    const coordinatedWork = /\b(and|plus|then|also)\b|[,;]/i.test(request) && riskAction.test(request);
    const riskImplementation =
      /\b(?:add|implement|enable|introduce|wire|migrate|execute|apply|rotate|deploy|integrate|drop|truncate|refund|charge|revoke|purge|process|authorize)\b[^.\n]{0,100}\b(?:auth(?:entication|orization)?|authn|authz|billing|payments?|invoices?|charges?|refunds?|credentials?|secrets?|production|schema|migration|table|column|public api|customer data)\b/i.test(request) ||
      /\b(?:delete (?:all )?(?:production |customer )?data|remove (?:a )?public endpoint|force[- ]push|rewrite history|roll out)\b/i.test(request);
    const candidate = POLICY_TRIGGERS.find(([, pattern]) => pattern.test(request))?.[0] ?? null;
    riskTrigger = tinyDocumentation && !coordinatedWork && !riskImplementation ? null : candidate;
    if (riskTrigger) {
      effective = "critical";
      source = "policy";
      reason = `Policy elevated standard to critical because the request includes ${riskTrigger}.`;
    }
  }

  return {
    assurance: { requested, effective, source, reason, scope },
    risk_trigger: riskTrigger,
  };
}

function selectorPattern(selector) {
  const escaped = selector.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const globbed = escaped.replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*");
  return new RegExp(`^${globbed}$`);
}

export function matchesCriticalScope(scope, { task_id = null, paths = [] } = {}) {
  if (!scope || scope.type === "entire-run") return true;
  for (const selector of scope.selectors ?? []) {
    if (task_id && selector === task_id) return true;
    const pattern = selectorPattern(selector);
    if (paths.some((path) => pattern.test(path))) return true;
  }
  return false;
}

function errorsForObject(value, required, label) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [`${label} must be an object`];
  for (const field of required) if (!Object.hasOwn(value, field)) errors.push(`${label}.${field} is required`);
  return errors;
}

function validateScope(scope, label = "critical scope") {
  const errors = errorsForObject(scope, ["type", "selectors"], label);
  if (errors.length === 1 && errors[0] === `${label} must be an object`) return errors;
  for (const field of Object.keys(scope ?? {})) {
    if (!["type", "selectors"].includes(field)) errors.push(`${label}.${field} is not allowed`);
  }
  if (!scope || !["entire-run", "selectors"].includes(scope.type)) errors.push(`${label}.type must be entire-run or selectors`);
  if (!Array.isArray(scope?.selectors) || scope.selectors.some((item) => !nonEmpty(item))) {
    errors.push(`${label}.selectors must be an array of non-empty strings`);
  } else if (scope.selectors.some((item) => !safeEntityId(item) && !safeRepoPath(item, { allowGlob: true }))) {
    errors.push(`${label}.selectors must be safe task IDs or repository-relative path patterns`);
  } else if (new Set(scope.selectors).size !== scope.selectors.length) {
    errors.push(`${label}.selectors must contain unique items`);
  } else if (scope.type === "selectors" && scope.selectors.length === 0) {
    errors.push(`${label}.selectors must not be empty for a selector scope`);
  } else if (scope.type === "entire-run" && scope.selectors.length !== 0) {
    errors.push(`${label} entire-run selectors must be empty`);
  }
  return errors;
}

export function validateTaskPacket(packet) {
  const required = [
    "schema_version",
    "run_id",
    "task_id",
    "title",
    "authority",
    "global_constraints",
    "out_of_scope",
    "critical_scope",
    "files",
    "dependencies",
    "done_command",
    "review_risk",
    "workspace_id",
    "plan_digest",
    "definition_digests",
  ];
  const errors = errorsForObject(packet, required, "task_packet");
  if (errors.length === 1 && errors[0] === "task_packet must be an object") return { ok: false, errors };
  for (const field of Object.keys(packet)) {
    if (!required.includes(field)) errors.push(`task_packet.${field} is not allowed`);
  }
  if (packet.schema_version !== SCHEMA_VERSION) errors.push(`task_packet.schema_version must be ${SCHEMA_VERSION}`);
  for (const field of ["run_id", "task_id", "title", "done_command", "review_risk", "workspace_id"]) {
    if (Object.hasOwn(packet, field) && !nonEmpty(packet[field])) errors.push(`task_packet.${field} must be a non-empty string`);
  }
  if (packet.run_id && !RUN_ID_RE.test(packet.run_id)) errors.push("task_packet.run_id must be a safe path-independent identifier");
  for (const field of ["task_id", "workspace_id"]) {
    if (packet[field] && !safeEntityId(packet[field])) errors.push(`task_packet.${field} must be a safe identifier`);
  }
  if (Array.isArray(packet.dependencies) && packet.dependencies.some((id) => !safeEntityId(id))) {
    errors.push("task_packet.dependencies must contain safe task identifiers");
  }
  for (const field of ["authority", "global_constraints", "out_of_scope", "files", "dependencies"]) {
    if (Object.hasOwn(packet, field) && (!Array.isArray(packet[field]) || packet[field].some((v) => !nonEmpty(v)))) {
      errors.push(`task_packet.${field} must be an array of non-empty strings`);
    }
    if (Array.isArray(packet[field]) && new Set(packet[field]).size !== packet[field].length) {
      errors.push(`task_packet.${field} must contain unique items`);
    }
  }
  if (packet.authority && packet.authority.length === 0) errors.push("task_packet.authority must not be empty");
  if (Array.isArray(packet.files) && packet.files.some((path) => !safeRepoPath(path, { allowGlob: true }))) {
    errors.push("task_packet.files must contain safe repository-relative path patterns");
  }
  if (!packet.critical_scope || typeof packet.critical_scope !== "object" || Array.isArray(packet.critical_scope)) {
    errors.push("task_packet.critical_scope must be an object");
  } else {
    for (const field of Object.keys(packet.critical_scope)) {
      if (!["applies", "matched_by"].includes(field)) errors.push(`task_packet.critical_scope.${field} is not allowed`);
    }
    if (typeof packet.critical_scope.applies !== "boolean") errors.push("task_packet.critical_scope.applies must be boolean");
    if (!Array.isArray(packet.critical_scope.matched_by) || packet.critical_scope.matched_by.some((value) => !nonEmpty(value))) {
      errors.push("task_packet.critical_scope.matched_by must be an array of non-empty strings");
    } else {
      if (new Set(packet.critical_scope.matched_by).size !== packet.critical_scope.matched_by.length) {
        errors.push("task_packet.critical_scope.matched_by must contain unique items");
      }
      if (packet.critical_scope.applies && packet.critical_scope.matched_by.length === 0) {
        errors.push("task_packet.critical_scope.matched_by must explain an applicable critical scope");
      }
    }
  }
  if (!DIGEST_RE.test(packet.plan_digest ?? "")) errors.push("task_packet.plan_digest must be a sha256 digest");
  if (!packet.definition_digests || typeof packet.definition_digests !== "object" || Array.isArray(packet.definition_digests)) {
    errors.push("task_packet.definition_digests must be an object");
  } else {
    const entries = Object.entries(packet.definition_digests);
    if (entries.length === 0) errors.push("task_packet.definition_digests must not be empty");
    for (const [name, value] of entries) {
      if (!DIGEST_RE.test(value)) errors.push(`task_packet.definition_digests.${name} must be a sha256 digest`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateRunState(state) {
  const required = [
    "schema_version",
    "run_id",
    "workflow",
    "request",
    "assurance",
    "risk_trigger",
    "risk",
    "status",
    "frozen_diff",
    "critical_backfill_required",
    "plan_digest",
    "tasks",
    "workspaces",
    "active_workspace_id",
    "definition_digests",
    "evidence",
    "reviews",
    "findings",
    "approvals",
    "finish",
    "used_context_ids",
    "finalization",
    "current_head_sha",
    "current_tree_sha",
    "last_change_seq",
    "last_authority_seq",
    "phases",
    "event_seq",
    "event_digest",
  ];
  const errors = errorsForObject(state, required, "run_state");
  if (errors.length === 1 && errors[0] === "run_state must be an object") return { ok: false, errors };
  const allowedStateFields = new Set([...required, "backfill", "plan_critique", "design"]);
  for (const field of Object.keys(state)) {
    if (!allowedStateFields.has(field)) errors.push(`run_state.${field} is not allowed`);
  }
  if (state.schema_version !== SCHEMA_VERSION) errors.push(`run_state.schema_version must be ${SCHEMA_VERSION}`);
  if (!RUN_ID_RE.test(state.run_id ?? "")) errors.push("run_state.run_id must be a safe path-independent identifier");
  if (!["feature", "bugfix"].includes(state.workflow)) errors.push("run_state.workflow must be feature or bugfix");
  if (!nonEmpty(state.request)) errors.push("run_state.request must be a non-empty string");
  const assuranceErrors = errorsForObject(
    state.assurance,
    ["requested", "effective", "source", "reason", "scope", "activated_at"],
    "run_state.assurance",
  );
  errors.push(...assuranceErrors);
  if (state.assurance) {
    for (const field of Object.keys(state.assurance)) {
      if (!["requested", "effective", "source", "reason", "scope", "activated_at"].includes(field)) {
        errors.push(`run_state.assurance.${field} is not allowed`);
      }
    }
    if (!PROFILES.includes(state.assurance.requested)) errors.push("run_state.assurance.requested is invalid");
    if (!PROFILES.includes(state.assurance.effective)) errors.push("run_state.assurance.effective is invalid");
    if (!ASSURANCE_SOURCES.has(state.assurance.source)) errors.push("run_state.assurance.source is invalid");
    if (!nonEmpty(state.assurance.reason)) errors.push("run_state.assurance.reason must be non-empty");
    if (!validTimestamp(state.assurance.activated_at)) errors.push("run_state.assurance.activated_at must be an ISO date-time");
    errors.push(...validateScope(state.assurance.scope, "run_state.assurance.scope"));
  }
  if (state.risk_trigger !== null && typeof state.risk_trigger !== "string") {
    errors.push("run_state.risk_trigger must be string or null");
  }
  const riskErrors = errorsForObject(state.risk, ["level", "reason"], "run_state.risk");
  errors.push(...riskErrors);
  if (state.risk) {
    if (!RISK_LEVELS.includes(state.risk.level)) errors.push("run_state.risk.level is invalid");
    if (!nonEmpty(state.risk.reason)) errors.push("run_state.risk.reason must be non-empty");
    if (state.risk.classified_at !== undefined && !validTimestamp(state.risk.classified_at)) {
      errors.push("run_state.risk.classified_at must be an ISO date-time");
    }
  }
  if (!["active", "blocked", "finished"].includes(state.status)) errors.push("run_state.status is invalid");
  if (typeof state.critical_backfill_required !== "boolean") {
    errors.push("run_state.critical_backfill_required must be boolean");
  }
  if (state.plan_digest !== null && !DIGEST_RE.test(state.plan_digest ?? "")) {
    errors.push("run_state.plan_digest must be sha256 or null");
  }
  if (state.design !== undefined) {
    const designFields = [
      "approved", "design_digest", "validation_strategy", "observability", "rollback_strategy",
      "abort_strategy", "one_way_doors", "approved_by", "approved_at",
    ];
    const designErrors = errorsForObject(state.design, designFields, "run_state.design");
    errors.push(...designErrors);
    if (Object.keys(state.design ?? {}).some((field) => !designFields.includes(field)) ||
        state.design?.approved !== true || !DIGEST_RE.test(state.design?.design_digest ?? "") ||
        ["validation_strategy", "observability", "rollback_strategy", "abort_strategy"].some(
          (field) => !nonEmpty(state.design?.[field]),
        ) ||
        !Array.isArray(state.design?.one_way_doors) || state.design.one_way_doors.some((door) => !nonEmpty(door)) ||
        new Set(state.design?.one_way_doors ?? []).size !== (state.design?.one_way_doors ?? []).length ||
        state.design?.approved_by !== "user" || !validTimestamp(state.design?.approved_at)) {
      errors.push("run_state.design is invalid");
    }
  }
  if (state.frozen_diff !== null) {
    const frozenErrors = errorsForObject(
      state.frozen_diff, ["base_sha", "head_sha", "tree_sha", "frozen_at", "evidence"], "run_state.frozen_diff",
    );
    errors.push(...frozenErrors);
    if (Object.keys(state.frozen_diff ?? {}).some((field) => !["base_sha", "head_sha", "tree_sha", "frozen_at", "evidence"].includes(field))) {
      errors.push("run_state.frozen_diff contains unsupported fields");
    }
    if (!SHA_RE.test(state.frozen_diff?.base_sha ?? "") || !SHA_RE.test(state.frozen_diff?.head_sha ?? "") ||
        !SHA_RE.test(state.frozen_diff?.tree_sha ?? "") || !validTimestamp(state.frozen_diff?.frozen_at) ||
        !Array.isArray(state.frozen_diff?.evidence)) {
      errors.push("run_state.frozen_diff requires base/head/tree, ISO time, and evidence");
    }
  }
  if (!Number.isInteger(state.event_seq) || state.event_seq < 0) errors.push("run_state.event_seq must be non-negative");
  if (!Number.isInteger(state.last_change_seq) || state.last_change_seq < 0 || state.last_change_seq > state.event_seq) {
    errors.push("run_state.last_change_seq must be an event sequence in this run");
  }
  if (state.event_digest !== null && !DIGEST_RE.test(state.event_digest ?? "")) {
    errors.push("run_state.event_digest must be sha256 or null");
  }
  for (const field of ["tasks", "workspaces", "definition_digests", "findings"]) {
    if (state[field] && (typeof state[field] !== "object" || Array.isArray(state[field]))) errors.push(`run_state.${field} must be an object`);
  }
  for (const field of ["tasks", "workspaces", "findings"]) {
    for (const id of Object.keys(state[field] ?? {})) {
      if (!safeEntityId(id)) errors.push(`run_state.${field} contains unsafe identifier ${id}`);
    }
  }
  for (const [taskId, task] of Object.entries(state.tasks ?? {})) {
    const label = `run_state.tasks.${taskId}`;
    const packetResult = validateTaskPacket(task?.packet);
    if (!packetResult.ok) errors.push(`${label}.packet is invalid: ${packetResult.errors.join("; ")}`);
    if (!["ready", "building", "changed", "completed", "blocked", "superseded"].includes(task?.status)) {
      errors.push(`${label}.status is invalid`);
    }
    if (!DIGEST_RE.test(task?.task_digest ?? "") || !validTimestamp(task?.recorded_at)) {
      errors.push(`${label} requires a task digest and ISO recorded_at`);
    }
    if (task?.completed_seq !== null && (!Number.isInteger(task?.completed_seq) || task.completed_seq < 1 || task.completed_seq > state.event_seq)) {
      errors.push(`${label}.completed_seq is invalid`);
    }
    if (task?.status === "superseded" && (!validTimestamp(task.superseded_at) || !nonEmpty(task.superseded_reason))) {
      errors.push(`${label} requires superseded_at and superseded_reason`);
    }
  }
  for (const [workspaceId, workspace] of Object.entries(state.workspaces ?? {})) {
    const label = `run_state.workspaces.${workspaceId}`;
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace) ||
        Object.keys(workspace ?? {}).some((field) => !["workspace_id", "path", "mode", "writer", "attached_at"].includes(field)) ||
        workspace.workspace_id !== workspaceId || !nonEmpty(workspace.path) ||
        !["caller", "owned-isolated"].includes(workspace.mode) || workspace.writer !== "build" ||
        !validTimestamp(workspace.attached_at)) {
      errors.push(`${label} is invalid`);
    }
  }
  for (const [name, value] of Object.entries(state.definition_digests ?? {})) {
    if (!DIGEST_RE.test(value)) errors.push(`run_state.definition_digests.${name} must be sha256`);
  }
  if (state.active_workspace_id !== null && !safeEntityId(state.active_workspace_id)) {
    errors.push("run_state.active_workspace_id must be null or a safe identifier");
  } else if (state.active_workspace_id !== null && !Object.hasOwn(state.workspaces ?? {}, state.active_workspace_id)) {
    errors.push("run_state.active_workspace_id must name a recorded workspace");
  }
  if (state.current_head_sha !== null && !SHA_RE.test(state.current_head_sha ?? "")) {
    errors.push("run_state.current_head_sha must be a Git object ID or null");
  }
  if (state.current_tree_sha !== null && !SHA_RE.test(state.current_tree_sha ?? "")) {
    errors.push("run_state.current_tree_sha must be a Git tree ID or null");
  }
  for (const [name, phase] of Object.entries(state.phases ?? {})) {
    const label = `run_state.phases.${name}`;
    if (!PHASES.has(name) || !phase || typeof phase !== "object" || Array.isArray(phase)) {
      errors.push(`${label} is invalid`);
      continue;
    }
    if (!["started", "completed", "blocked"].includes(phase.status)) errors.push(`${label}.status is invalid`);
    if (phase.task_id !== null && !safeEntityId(phase.task_id)) errors.push(`${label}.task_id is invalid`);
    if (phase.workspace_id !== null && !safeEntityId(phase.workspace_id)) errors.push(`${label}.workspace_id is invalid`);
    if (phase.definition_digest !== null && !DIGEST_RE.test(phase.definition_digest ?? "")) {
      errors.push(`${label}.definition_digest must be sha256 or null`);
    }
    for (const field of Object.keys(phase)) {
      if (!["status", "task_id", "workspace_id", "definition_digest", "started_at", "completed_at", "reason", "round"].includes(field)) {
        errors.push(`${label}.${field} is not allowed`);
      }
    }
    if (!validTimestamp(phase.started_at) || !Number.isInteger(phase.round) || phase.round < 1) {
      errors.push(`${label} requires an ISO started_at and positive round`);
    }
    if (phase.completed_at !== undefined && !validTimestamp(phase.completed_at)) {
      errors.push(`${label}.completed_at must be an ISO date-time`);
    }
  }
  for (const field of ["evidence", "reviews", "approvals", "used_context_ids"]) {
    if (field in state && !Array.isArray(state[field])) errors.push(`run_state.${field} must be an array`);
  }
  if (Array.isArray(state.used_context_ids)) {
    if (state.used_context_ids.some((id) => !safeEntityId(id))) errors.push("run_state.used_context_ids must contain safe identifiers");
    if (new Set(state.used_context_ids).size !== state.used_context_ids.length) errors.push("run_state.used_context_ids must be unique");
  }
  for (const [index, receipt] of (Array.isArray(state.evidence) ? state.evidence : []).entries()) {
    const label = `run_state.evidence[${index}]`;
    const receiptFields = ["kind", "command", "exit_code", "head_sha", "tree_sha", "task_id", "workspace_id", "recorded_at", "seq"];
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) ||
        Object.keys(receipt ?? {}).some((field) => !receiptFields.includes(field)) ||
        !EVIDENCE_KINDS.has(receipt.kind) || !nonEmpty(receipt.command) || !Number.isInteger(receipt.exit_code) ||
        !SHA_RE.test(receipt.head_sha ?? "") || !SHA_RE.test(receipt.tree_sha ?? "") ||
        !validTimestamp(receipt.recorded_at) || !Number.isInteger(receipt.seq) || receipt.seq < 1 || receipt.seq > state.event_seq ||
        (receipt.task_id !== null && !safeEntityId(receipt.task_id)) ||
        (receipt.workspace_id !== null && !safeEntityId(receipt.workspace_id))) {
      errors.push(`${label} is invalid`);
    }
  }
  for (const [index, review] of (Array.isArray(state.reviews) ? state.reviews : []).entries()) {
    const label = `run_state.reviews[${index}]`;
    if (!review || typeof review !== "object" || Array.isArray(review)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    if (!["specification", "quality", "whole-change", "combined"].includes(review.axis)) errors.push(`${label}.axis is invalid`);
    if (!["APPROVE", "APPROVE-WITH-NITS", "CHANGES-REQUESTED", "UNVERIFIED"].includes(review.verdict)) errors.push(`${label}.verdict is invalid`);
    for (const field of ["spec_verdict", "quality_verdict"]) {
      if (review[field] !== null && !["APPROVE", "CHANGES-REQUESTED", "UNVERIFIED"].includes(review[field])) {
        errors.push(`${label}.${field} is invalid`);
      }
    }
    if (!safeEntityId(review.context_id) || !SHA_RE.test(review.head_sha ?? "") || !SHA_RE.test(review.tree_sha ?? "")) {
      errors.push(`${label} requires safe context/head/tree identity`);
    }
    if (review.task_id !== null && !safeEntityId(review.task_id)) errors.push(`${label}.task_id is invalid`);
    if (review.workspace_id !== null && !safeEntityId(review.workspace_id)) errors.push(`${label}.workspace_id is invalid`);
    if (!validTimestamp(review.recorded_at)) errors.push(`${label}.recorded_at must be an ISO date-time`);
    if (!Number.isInteger(review.seq) || review.seq < 1 || review.seq > state.event_seq) errors.push(`${label}.seq is invalid`);
    if (review.axis === "whole-change" && review.verdict === "APPROVE" &&
        (review.spec_verdict !== "APPROVE" || review.quality_verdict !== "APPROVE")) {
      errors.push(`${label} whole-change APPROVE requires both sub-verdicts`);
    }
  }
  if (state.finish !== null) {
    const finishErrors = errorsForObject(state.finish, ["choice", "explicit_request", "selected_at"], "run_state.finish");
    errors.push(...finishErrors);
    for (const field of Object.keys(state.finish ?? {})) {
      if (!["choice", "explicit_request", "selected_at"].includes(field)) errors.push(`run_state.finish.${field} is not allowed`);
    }
    if (!FINISH_CHOICES.includes(state.finish?.choice) || typeof state.finish?.explicit_request !== "boolean" ||
        !validTimestamp(state.finish?.selected_at)) {
      errors.push("run_state.finish is invalid");
    }
  }
  if (state.finalization !== null) {
    const finalizationErrors = errorsForObject(
      state.finalization,
      ["choice", "candidate_head_sha", "final_branch", "head_sha", "tree_sha", "completed_at"],
      "run_state.finalization",
    );
    errors.push(...finalizationErrors);
    for (const field of Object.keys(state.finalization ?? {})) {
      if (!["choice", "candidate_head_sha", "final_branch", "head_sha", "tree_sha", "completed_at"].includes(field)) {
        errors.push(`run_state.finalization.${field} is not allowed`);
      }
    }
    if (!FINISH_CHOICES.includes(state.finalization?.choice)) errors.push("run_state.finalization.choice is invalid");
    if (!SHA_RE.test(state.finalization?.candidate_head_sha ?? "") ||
        !SHA_RE.test(state.finalization?.head_sha ?? "") || !SHA_RE.test(state.finalization?.tree_sha ?? "")) {
      errors.push("run_state.finalization requires candidate/final head and tree IDs");
    }
    if (!nonEmpty(state.finalization?.final_branch)) errors.push("run_state.finalization.final_branch must be non-empty");
    if (!validTimestamp(state.finalization?.completed_at)) errors.push("run_state.finalization.completed_at must be an ISO date-time");
    if (state.finish?.choice !== state.finalization?.choice || state.current_head_sha !== state.finalization?.head_sha ||
        state.current_tree_sha !== state.finalization?.tree_sha || state.status !== "finished" ||
        state.phases?.["git-ops"]?.status !== "completed") {
      errors.push("run_state.finalization must match finish choice, final identity, Git-Ops completion, and finished status");
    }
  } else if (state.status === "finished") {
    errors.push("run_state.finished status requires finalization");
  }
  if (!Number.isInteger(state.last_authority_seq) || state.last_authority_seq < 0 || state.last_authority_seq > state.event_seq) {
    errors.push("run_state.last_authority_seq must be an event sequence in this run");
  }
  return { ok: errors.length === 0, errors };
}

export function createInitialState({ workflow, request, runId, now, definitionDigests = {} }) {
  if (!["feature", "bugfix"].includes(workflow)) fail("workflow must be feature or bugfix");
  if (!RUN_ID_RE.test(runId ?? "")) fail("run_id must be a safe path-independent identifier");
  if (!validTimestamp(now)) fail("activated_at must be an ISO timestamp");
  const parsed = parseWorkflowRequest(request);
  const state = {
    schema_version: SCHEMA_VERSION,
    run_id: runId,
    workflow,
    request,
    assurance: { ...parsed.assurance, activated_at: now },
    risk_trigger: parsed.risk_trigger,
    risk: { level: "unknown", reason: "Not classified yet." },
    status: "active",
    frozen_diff: null,
    critical_backfill_required: false,
    plan_digest: null,
    current_head_sha: null,
    current_tree_sha: null,
    last_change_seq: 0,
    last_authority_seq: 0,
    phases: {},
    tasks: {},
    workspaces: {},
    active_workspace_id: null,
    definition_digests: clone(definitionDigests),
    evidence: [],
    reviews: [],
    used_context_ids: [],
    findings: {},
    approvals: [],
    finish: null,
    finalization: null,
    event_seq: 0,
    event_digest: null,
  };
  const result = validateRunState(state);
  if (!result.ok) fail(`invalid initial run state: ${result.errors.join("; ")}`);
  return state;
}

function profileRank(profile) {
  return PROFILES.indexOf(profile);
}

function latestReview(state, axis, taskId = null, workspaceId = null) {
  return [...state.reviews]
    .reverse()
    .find(
      (review) =>
        review.axis === axis &&
        review.task_id === taskId &&
        (workspaceId === null || review.workspace_id === workspaceId),
    );
}

function freshnessFloor(state) {
  return Math.max(state.last_change_seq, state.last_authority_seq);
}

function assuredIdentity(state) {
  return {
    head_sha: state.finalization?.candidate_head_sha ?? state.current_head_sha,
    tree_sha: state.finalization?.tree_sha ?? state.current_tree_sha,
  };
}

function freshEvidence(state, kind, taskId = null, workspaceId = null, afterSeq = 0) {
  const identity = assuredIdentity(state);
  return [...state.evidence].reverse().find(
    (receipt) =>
      receipt.kind === kind &&
      receipt.exit_code === 0 &&
      receipt.seq > Math.max(freshnessFloor(state), afterSeq) &&
      (!identity.head_sha || receipt.head_sha === identity.head_sha) &&
      (!identity.tree_sha || receipt.tree_sha === identity.tree_sha) &&
      receipt.task_id === taskId &&
      (workspaceId === null || receipt.workspace_id === workspaceId),
  );
}

function scopedCritical(state, taskId = null) {
  if (state.assurance.effective !== "critical") return false;
  if (!taskId) return true;
  const packet = ownValue(state.tasks, taskId)?.packet;
  // A path selector cannot be evaluated without the packet's file list. Fail closed until
  // authority exists; after the packet is recorded, non-matching tasks use standard controls.
  if (!packet && state.assurance.scope.type === "selectors") return true;
  return matchesCriticalScope(state.assurance.scope, { task_id: taskId, paths: packet?.files ?? [] });
}

function gateResult(state, missing) {
  return {
    ok: missing.length === 0,
    code: missing.length === 0 ? "OK" : state.assurance.effective === "critical" ? "BLOCKED_CRITICAL_ASSURANCE" : "BLOCKED_ASSURANCE",
    missing,
  };
}

/** Return a deterministic gate result; the CLI prints its BLOCKED token verbatim. */
export function evaluateGate(state, gate, { task_id = null, action = null } = {}) {
  const valid = validateRunState(state);
  if (!valid.ok) fail(`cannot evaluate invalid state: ${valid.errors.join("; ")}`);
  const missing = [];

  if (gate === "pre-build") {
    if (!scopedCritical(state, task_id)) return gateResult(state, missing);
    const workspace = ownValue(state.workspaces, state.active_workspace_id);
    if (!workspace || workspace.mode !== "owned-isolated") missing.push("an owned isolated workspace");
    if (!workspace || workspace.writer !== "build") missing.push("a single writer lease held by build");
    if (state.risk.level === "unknown") missing.push("an explicit authority and risk classification");
    if (state.risk.level === "consequential" && !state.design?.approved) {
      missing.push("an approved design with rollback, abort strategy, and one-way doors");
    }
    const critique = state.plan_critique;
    if (!critique || critique.verdict !== "APPROVE" || critique.plan_digest !== state.plan_digest) {
      missing.push("an independent APPROVE plan critique for the current plan digest");
    }
    const task = task_id ? ownValue(state.tasks, task_id) : null;
    if (!task) missing.push(`a validated task packet${task_id ? ` for ${task_id}` : ""}`);
    if (task?.status === "superseded") missing.push("a current non-superseded task packet");
    if (task && workspace && task.packet.workspace_id !== workspace.workspace_id) {
      missing.push("a task packet bound to the active owned workspace");
    }
    if (task && task.packet.plan_digest !== state.plan_digest) missing.push("a task packet bound to the current plan digest");
    if (task) {
      const staleDefinitions = Object.entries(task.packet.definition_digests).filter(
        ([name, value]) => state.definition_digests[name] !== value,
      );
      if (staleDefinitions.length) missing.push(`current definition digest(s): ${staleDefinitions.map(([name]) => name).join(", ")}`);
      const applies = matchesCriticalScope(state.assurance.scope, {
        task_id,
        paths: task.packet.files,
      });
      if (task.packet.critical_scope.applies !== applies || (applies && task.packet.critical_scope.matched_by.length === 0)) {
        missing.push("a task packet with an accurate critical-scope match");
      }
      for (const dependencyId of task.packet.dependencies) {
        const dependency = ownValue(state.tasks, dependencyId);
        if (!dependency) {
          missing.push(`a recorded dependency task packet for ${dependencyId}`);
          continue;
        }
        if (matchesCriticalScope(state.assurance.scope, { task_id: dependencyId, paths: dependency.packet.files })) {
          const dependencyGate = evaluateGate(state, "task-complete", { task_id: dependencyId });
          if (!dependencyGate.ok) {
            missing.push(`${dependencyId} critical dependency completion controls: ${dependencyGate.missing.join("; ")}`);
          }
        }
      }
    }
    if (state.critical_backfill_required) missing.push("completed critical escalation backfill for the frozen diff");
    return gateResult(state, missing);
  }

  if (gate === "task-complete") {
    if (!task_id) fail("task-complete gate requires task_id");
    const identity = assuredIdentity(state);
    if (!scopedCritical(state, task_id)) return gateResult(state, missing);
    const task = ownValue(state.tasks, task_id);
    const workspaceId = task?.packet.workspace_id ?? null;
    const workspace = workspaceId ? ownValue(state.workspaces, workspaceId) : null;
    if (!task) missing.push("a validated task packet");
    if (task && task.status !== "completed") missing.push("a completed Build phase for the task");
    if (task && task.packet.plan_digest !== state.plan_digest) missing.push("a task packet bound to the current plan digest");
    if (task) {
      const staleDefinitions = Object.entries(task.packet.definition_digests).filter(
        ([name, value]) => state.definition_digests[name] !== value,
      );
      if (staleDefinitions.length) missing.push(`current definition digest(s): ${staleDefinitions.map(([name]) => name).join(", ")}`);
    }
    if (!workspace || workspace.mode !== "owned-isolated" || state.active_workspace_id !== workspaceId) {
      missing.push("the task packet's active owned workspace");
    }
    const completedSeq = task?.completed_seq ?? 0;
    if (!freshEvidence(state, "exact-target", task_id, workspaceId, completedSeq)) {
      missing.push("fresh exact-target evidence after the completed Build phase from the task packet workspace");
    }
    const spec = latestReview(state, "specification", task_id, workspaceId);
    const quality = latestReview(state, "quality", task_id, workspaceId);
    if (!spec || spec.verdict !== "APPROVE" || spec.seq <= Math.max(freshnessFloor(state), completedSeq) ||
        spec.head_sha !== identity.head_sha || spec.tree_sha !== identity.tree_sha) {
      missing.push("a fresh specification APPROVE review for the task");
    }
    if (!quality || quality.verdict !== "APPROVE" || quality.seq <= Math.max(freshnessFloor(state), completedSeq) ||
        quality.head_sha !== identity.head_sha || quality.tree_sha !== identity.tree_sha) {
      missing.push("a fresh quality/security APPROVE review for the task");
    }
    if (spec && quality && spec.context_id === quality.context_id) missing.push("specification and quality reviews from separate fresh contexts");
    return gateResult(state, missing);
  }

  if (gate === "finalize" || gate === "finish") {
    const finalGate = gate === "finish";
    const identity = assuredIdentity(state);
    if (state.critical_backfill_required) missing.push("completed critical escalation backfill for the frozen diff");
    const startedPhases = Object.entries(state.phases).filter(([, phase]) => phase.status === "started").map(([name]) => name);
    const disallowedStarted = finalGate ? startedPhases : startedPhases.filter((name) => name !== "git-ops");
    const blockedPhases = Object.entries(state.phases).filter(([, phase]) => phase.status === "blocked").map(([name]) => name);
    if (disallowedStarted.length) missing.push(`completion of active phase(s): ${disallowedStarted.join(", ")}`);
    if (blockedPhases.length || state.status === "blocked") {
      missing.push(`resolution of blocked phase(s): ${blockedPhases.join(", ") || "run status"}`);
    }
    if (!state.finish) missing.push("an explicit finish choice: merge, pr, or keep");
    if (finalGate && !state.finalization) missing.push("a persisted Git-Ops finalization completion");
    if (finalGate && state.status !== "finished") missing.push("finished run status");
    if (!finalGate && state.finalization) missing.push("finalization has already completed");
    if (state.risk.level === "unknown") missing.push("an explicit authority and risk classification");
    const finishWorkspaceId = state.assurance.effective === "critical" ? state.active_workspace_id : null;
    if (!freshEvidence(state, "exact-target", null, finishWorkspaceId)) missing.push("fresh exact-target evidence after the last relevant change");
    const completionReview = [...state.reviews]
      .reverse()
      .find((review) => ["combined", "whole-change"].includes(review.axis) && review.task_id === null);
    const completionReviewRequired = state.assurance.effective !== "critical" && state.risk.level !== "tiny";
    if (!completionReview && completionReviewRequired) {
      missing.push("a fresh completion review with an APPROVE verdict");
    } else if (
      completionReview &&
      (completionReview.verdict !== "APPROVE" ||
        completionReview.seq <= freshnessFloor(state) ||
        completionReview.head_sha !== identity.head_sha ||
        completionReview.tree_sha !== identity.tree_sha)
    ) {
      missing.push("a fresh completion review with an APPROVE verdict");
    }
    if (state.assurance.effective === "critical") {
      const workspace = ownValue(state.workspaces, state.active_workspace_id);
      if (!workspace || workspace.mode !== "owned-isolated") missing.push("the active owned isolated workspace");
      for (const [kind, label] of [
        ["full-suite", "fresh full-suite/build/lint evidence"],
        ["requirements-trace", "a fresh requirements trace"],
        ["risk-specific", "fresh risk-specific checks"],
      ]) {
        if (!freshEvidence(state, kind, null, state.active_workspace_id)) missing.push(label);
      }
      const whole = latestReview(state, "whole-change", null, state.active_workspace_id);
      if (
        !whole ||
        whole.verdict !== "APPROVE" ||
        whole.spec_verdict !== "APPROVE" ||
        whole.quality_verdict !== "APPROVE" ||
        whole.seq <= freshnessFloor(state) ||
        whole.head_sha !== identity.head_sha ||
        whole.tree_sha !== identity.tree_sha
      ) {
        missing.push("a fresh independent whole-change APPROVE review with both specification and quality approved");
      }
      const taskReviewContexts = new Set(
        state.reviews
          .filter((review) => ["specification", "quality"].includes(review.axis) && review.seq > freshnessFloor(state))
          .map((review) => review.context_id),
      );
      if (whole && taskReviewContexts.has(whole.context_id)) missing.push("a whole-change review from a third fresh context");
      const scopedTasks = Object.entries(state.tasks).filter(([taskId, task]) =>
        task.status !== "superseded" &&
        matchesCriticalScope(state.assurance.scope, { task_id: taskId, paths: task.packet.files }),
      );
      const latestTaskControlSeq = scopedTasks.reduce((latest, [taskId, task]) => {
        const spec = latestReview(state, "specification", taskId, task.packet.workspace_id);
        const quality = latestReview(state, "quality", taskId, task.packet.workspace_id);
        const exactTarget = freshEvidence(state, "exact-target", taskId, task.packet.workspace_id, task.completed_seq ?? 0);
        return Math.max(latest, task.completed_seq ?? 0, exactTarget?.seq ?? 0, spec?.seq ?? 0, quality?.seq ?? 0);
      }, 0);
      if (whole && whole.seq <= latestTaskControlSeq) {
        missing.push("a whole-change review recorded after every scoped task completion, task evidence, and task review");
      }
      if (scopedTasks.length === 0) missing.push("at least one validated task packet in critical scope");
      for (const [taskId, task] of scopedTasks) {
        const preBuildGate = evaluateGate(state, "pre-build", { task_id: taskId });
        if (!preBuildGate.ok) missing.push(`${taskId} critical pre-build controls: ${preBuildGate.missing.join("; ")}`);
        if (task.status !== "completed") missing.push(`${taskId} completed Build phase after a successful pre-build gate`);
        const taskGate = evaluateGate(state, "task-complete", { task_id: taskId });
        if (!taskGate.ok) missing.push(`${taskId} critical task completion controls: ${taskGate.missing.join("; ")}`);
      }
    }
    const findings = Object.values(state.findings);
    const pending = findings.filter((finding) => finding.disposition === "pending");
    if (pending.length) missing.push(`adjudication for finding(s): ${pending.map((finding) => finding.finding_id).join(", ")}`);
    const unresolved = findings.filter((finding) => finding.disposition === "needs-context");
    if (unresolved.length) missing.push(`context for finding(s): ${unresolved.map((finding) => finding.finding_id).join(", ")}`);
    const activeRepairs = findings.filter((finding) => finding.repair?.status === "started");
    if (activeRepairs.length) missing.push(`completion of active repair(s): ${activeRepairs.map((finding) => finding.finding_id).join(", ")}`);
    const unrepaired = findings.filter(
      (finding) => finding.disposition === "accepted" && finding.repair?.status !== "completed",
    );
    if (unrepaired.length) missing.push(`completed repair for accepted finding(s): ${unrepaired.map((finding) => finding.finding_id).join(", ")}`);
    return gateResult(state, missing);
  }

  if (gate === "side-effect") {
    if (!SIDE_EFFECTS.has(action)) fail(`unknown side effect ${JSON.stringify(action)}`);
    if (state.critical_backfill_required) missing.push("completed critical escalation backfill for the frozen diff");
    const approval = [...state.approvals]
      .reverse()
      .find((candidate) => candidate.action === action && candidate.approved_by === "user");
    if (!approval || approval.seq !== state.event_seq) missing.push(`fresh just-in-time user approval for ${action}`);
    return gateResult(state, missing);
  }

  if (gate === "repair") {
    const needsContext = Object.values(state.findings).filter((finding) => finding.disposition === "needs-context");
    if (needsContext.length) missing.push(`the load-bearing question for ${needsContext.map((finding) => finding.finding_id).join(", ")}`);
    return gateResult(state, missing);
  }

  fail(`unknown gate ${JSON.stringify(gate)}`);
}

function validateChangedPaths(paths, label) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) => !nonEmpty(path))) {
    fail(`${label} requires changed_paths as non-empty strings`);
  }
  if (paths.some((path) => !safeRepoPath(path))) {
    fail(`${label} changed_paths must be canonical repository-relative paths without glob or traversal segments`);
  }
  if (new Set(paths).size !== paths.length) fail(`${label} changed_paths must be unique`);
}

function activeCriticalBuild(state, taskId, label) {
  const task = taskId ? ownValue(state.tasks, taskId) : null;
  if (!task) fail(`${label} requires a validated task packet`);
  const gate = evaluateGate(state, "pre-build", { task_id: taskId });
  if (!gate.ok) fail(`${gate.code}: ${gate.missing.join("; ")}`);
  const build = state.phases.build;
  if (!build || build.status !== "started" || build.task_id !== taskId) {
    fail(`${label} requires the matching active Build phase`);
  }
  if (build.workspace_id !== state.active_workspace_id || build.workspace_id !== task.packet.workspace_id) {
    fail(`${label} requires the task packet's active Build workspace`);
  }
  if (build.definition_digest !== state.definition_digests["skill:build"]) {
    fail(`${label} requires the current Build definition digest`);
  }
  return task;
}

function enforceCriticalMutation(state, taskId, changedPaths, label) {
  if (state.assurance.effective !== "critical") return false;
  const task = taskId ? ownValue(state.tasks, taskId) : null;
  const packetCritical = scopedCritical(state, taskId ?? null);
  const pathCritical = matchesCriticalScope(state.assurance.scope, { task_id: taskId, paths: changedPaths });
  if (!packetCritical && !pathCritical) return false;
  if (!task) fail(`${label} requires a validated task packet`);
  const unauthorized = changedPaths.filter(
    (path) => !task.packet.files.some((selector) => selectorPattern(selector).test(path)),
  );
  if (unauthorized.length) fail(`${label} changed path(s) outside the task packet: ${unauthorized.join(", ")}`);
  if (pathCritical && !task.packet.critical_scope.applies) {
    fail(`${label} requires a task packet whose critical scope covers the actual changed paths`);
  }
  activeCriticalBuild(state, taskId, label);
  return true;
}

/** Apply one validated event to a derived snapshot. */
export function applyEvent(input, rawEvent) {
  const state = clone(input);
  const event = clone(rawEvent);
  if (!nonEmpty(event.type)) fail("event.type is required");
  if (!validTimestamp(event.at)) fail("event.at must be an ISO date-time");
  // `gate_evaluated` observes and never mutates the derived state, so the `finish` gate can still
  // record its own outcome after `finalization_completed` has already finished the run.
  if (state.status === "finished" && event.type !== "gate_evaluated") fail("finished run state is immutable");
  const seq = event.seq ?? state.event_seq + 1;
  if (!Number.isInteger(seq) || seq !== state.event_seq + 1) fail(`event sequence must be ${state.event_seq + 1}`);
  for (const field of ["task_id", "workspace_id", "context_id", "finding_id"]) {
    if (event[field] != null && !safeEntityId(event[field])) fail(`${field} must be a safe identifier`);
  }

  switch (event.type) {
    case "assurance_escalated": {
      if (event.to !== "critical") fail("assurance escalation can only elevate to critical");
      if (profileRank(state.assurance.effective) >= profileRank("critical")) fail("run is already critical");
      if (!nonEmpty(event.reason)) fail("assurance escalation requires a reason");
      if (!["policy", "natural-language", "user"].includes(event.source)) fail("assurance escalation source is invalid");
      const implementationBegan = state.last_change_seq > 0 || state.phases.build?.status === "started" || state.phases.build?.status === "completed";
      if (implementationBegan) {
        if (!SHA_RE.test(event.base_sha ?? "") || !SHA_RE.test(event.head_sha ?? "") ||
            !SHA_RE.test(event.tree_sha ?? "")) {
          fail("mid-run escalation after implementation began requires base_sha, head_sha, and tree_sha for the frozen diff");
        }
        state.frozen_diff = {
          base_sha: event.base_sha,
          head_sha: event.head_sha,
          tree_sha: event.tree_sha,
          frozen_at: event.at,
          evidence: clone(state.evidence),
        };
        state.current_head_sha = event.head_sha;
        state.current_tree_sha = event.tree_sha;
        state.critical_backfill_required = true;
      }
      state.assurance.effective = "critical";
      state.assurance.source = event.source;
      state.assurance.reason = event.reason;
      state.assurance.activated_at = event.at;
      if (event.scope) {
        const scopeErrors = validateScope(event.scope);
        if (scopeErrors.length) fail(scopeErrors.join("; "));
        state.assurance.scope = clone(event.scope);
      }
      state.last_authority_seq = seq;
      break;
    }
    case "assurance_downgraded":
      if (!["lean", "standard"].includes(event.to)) fail("assurance downgrade target must be lean or standard");
      if (event.authorized_by !== "user") fail("assurance downgrade requires explicit user authorization");
      if (!nonEmpty(event.reason)) fail("assurance downgrade requires a recorded reason");
      if (profileRank(event.to) >= profileRank(state.assurance.effective)) fail("assurance downgrade must lower the effective profile");
      state.assurance.effective = event.to;
      state.assurance.source = "user-downgrade";
      state.assurance.reason = event.reason;
      state.assurance.activated_at = event.at;
      state.critical_backfill_required = false;
      state.last_authority_seq = seq;
      break;
    case "risk_classified":
      if (!["tiny", "substantive", "consequential"].includes(event.level)) fail("risk level must be tiny, substantive, or consequential");
      if (!nonEmpty(event.reason)) fail("risk classification requires a reason");
      if (RISK_LEVELS.indexOf(event.level) < RISK_LEVELS.indexOf(state.risk.level)) {
        fail(`risk classification cannot be lowered from ${state.risk.level} to ${event.level}`);
      }
      state.risk = { level: event.level, reason: event.reason, classified_at: event.at };
      state.last_authority_seq = seq;
      break;
    case "workspace_attached": {
      if (!safeEntityId(event.workspace_id) || !nonEmpty(event.path)) fail("workspace event requires a safe workspace_id and path");
      if (!["caller", "owned-isolated"].includes(event.mode)) fail("workspace mode must be caller or owned-isolated");
      if (event.writer !== "build") fail("the single writer lease must be held by build");
      const existing = ownValue(state.workspaces, event.workspace_id);
      if (existing) {
        if (existing.path !== event.path || existing.mode !== event.mode || existing.writer !== event.writer) {
          fail(`workspace ${event.workspace_id} is already bound; workspace identity and root are immutable`);
        }
      } else {
        state.workspaces[event.workspace_id] = {
          workspace_id: event.workspace_id,
          path: event.path,
          mode: event.mode,
          writer: event.writer,
          attached_at: event.at,
        };
      }
      state.active_workspace_id = event.workspace_id;
      state.last_authority_seq = seq;
      break;
    }
    case "design_approved":
      if (!DIGEST_RE.test(event.design_digest ?? "")) fail("design approval requires a sha256 design_digest");
      for (const field of ["validation_strategy", "observability", "rollback_strategy", "abort_strategy"]) {
        if (!nonEmpty(event[field])) fail(`design approval requires ${field}`);
      }
      if (event.approved_by !== "user") fail("design approval approved_by must be user");
      if (!Array.isArray(event.one_way_doors) || event.one_way_doors.some((door) => !nonEmpty(door))) {
        fail("design approval requires one_way_doors as an array of non-empty strings");
      }
      if (new Set(event.one_way_doors).size !== event.one_way_doors.length) {
        fail("design approval one_way_doors must be unique");
      }
      state.design = {
        approved: true,
        design_digest: event.design_digest,
        validation_strategy: event.validation_strategy,
        observability: event.observability,
        rollback_strategy: event.rollback_strategy,
        abort_strategy: event.abort_strategy,
        one_way_doors: clone(event.one_way_doors),
        approved_by: "user",
        approved_at: event.at,
      };
      state.last_authority_seq = seq;
      break;
    case "plan_recorded":
      if (!DIGEST_RE.test(event.plan_digest ?? "")) fail("plan event requires a sha256 plan_digest");
      if (Object.values(state.findings).some((finding) => finding.repair?.status === "started")) {
        fail("complete the active repair before recording a replacement plan");
      }
      state.plan_digest = event.plan_digest;
      state.plan_critique = null;
      state.last_authority_seq = seq;
      break;
    case "plan_critique_recorded":
      if (!["APPROVE", "CHANGES-REQUESTED"].includes(event.verdict)) fail("plan critique verdict is invalid");
      if (!safeEntityId(event.context_id) || !DIGEST_RE.test(event.plan_digest ?? "")) fail("plan critique requires a safe context_id and plan_digest");
      if (state.used_context_ids.includes(event.context_id)) fail(`context_id ${event.context_id} was already used by an independent invocation`);
      state.plan_critique = {
        verdict: event.verdict,
        context_id: event.context_id,
        plan_digest: event.plan_digest,
        recorded_at: event.at,
        seq,
      };
      state.used_context_ids.push(event.context_id);
      state.last_authority_seq = seq;
      break;
    case "task_packet_recorded": {
      const result = validateTaskPacket(event.packet);
      if (!result.ok) fail(`invalid task packet: ${result.errors.join("; ")}`);
      if (event.packet.run_id !== state.run_id) fail("task packet run_id does not match this run");
      if (state.assurance.effective === "critical" &&
          (!state.plan_critique || state.plan_critique.verdict !== "APPROVE" ||
           state.plan_critique.plan_digest !== state.plan_digest)) {
        fail("critical task packets require an independent APPROVE critique of the current plan first");
      }
      if (ownValue(state.tasks, event.packet.task_id)) {
        fail(`task packet ${event.packet.task_id} already exists; task definitions are immutable`);
      }
      state.tasks[event.packet.task_id] = {
        packet: clone(event.packet),
        task_digest: digest(event.packet),
        status: "ready",
        completed_seq: null,
        recorded_at: event.at,
      };
      state.last_authority_seq = seq;
      break;
    }
    case "task_packet_superseded": {
      const task = ownValue(state.tasks, event.task_id);
      if (!task) fail(`unknown task packet ${event.task_id}`);
      if (!nonEmpty(event.reason)) fail("task packet supersession requires a reason");
      if (task.status === "superseded") fail(`task packet ${event.task_id} is already superseded`);
      if (task.packet.plan_digest === state.plan_digest) {
        fail("task packet may be superseded only after the current plan digest changes");
      }
      if (!state.plan_critique || state.plan_critique.verdict !== "APPROVE" ||
          state.plan_critique.plan_digest !== state.plan_digest) {
        fail("task packet supersession requires an APPROVE critique of the current replan");
      }
      if (state.phases.build?.status === "started" && state.phases.build.task_id === event.task_id) {
        fail("an active Build task cannot be superseded");
      }
      if (Object.values(state.findings).some(
        (finding) => finding.repair?.status === "started" && finding.repair.task_id === event.task_id,
      )) fail("a task with an active repair cannot be superseded");
      task.status = "superseded";
      task.superseded_at = event.at;
      task.superseded_reason = event.reason;
      state.last_authority_seq = seq;
      break;
    }
    case "phase_started": {
      if (!PHASES.has(event.phase)) fail(`unknown phase ${JSON.stringify(event.phase)}`);
      const previousPhase = state.phases[event.phase];
      if (previousPhase?.status === "started") fail(`${event.phase} is already started`);
      if (previousPhase?.status === "blocked" && previousPhase.task_id !== (event.task_id ?? null)) {
        fail(`${event.phase} blocked attempt must be resumed with the same task identity before another task starts`);
      }
      if (event.workspace_id && !ownValue(state.workspaces, event.workspace_id)) fail(`unknown phase workspace ${event.workspace_id}`);
      if (event.task_id && ownValue(state.tasks, event.task_id)?.status === "superseded") {
        fail(`task packet ${event.task_id} is superseded and cannot start a phase`);
      }
      if (event.definition_digest != null && !DIGEST_RE.test(event.definition_digest)) {
        fail("phase definition_digest must be sha256 or null");
      }
      if (event.phase === "build" && scopedCritical(state, event.task_id ?? null)) {
        const gate = evaluateGate(state, "pre-build", { task_id: event.task_id ?? null });
        if (!gate.ok) fail(`${gate.code}: ${gate.missing.join("; ")}`);
        if (event.workspace_id !== state.active_workspace_id) fail("critical Build phase must use the active owned workspace");
        if (event.definition_digest !== state.definition_digests["skill:build"]) {
          fail("critical Build phase requires the current Build definition digest");
        }
      }
      const otherBlocked = Object.entries(state.phases).some(
        ([name, phase]) => name !== event.phase && phase.status === "blocked",
      );
      state.status = otherBlocked ? "blocked" : "active";
      if (event.phase === "build" && event.task_id && ownValue(state.tasks, event.task_id)) {
        state.tasks[event.task_id].status = "building";
        state.tasks[event.task_id].completed_seq = null;
      }
      state.phases[event.phase] = {
        status: "started",
        task_id: event.task_id ?? null,
        workspace_id: event.workspace_id ?? state.active_workspace_id,
        definition_digest: event.definition_digest ?? null,
        started_at: event.at,
        round: (state.phases[event.phase]?.round ?? 0) + 1,
      };
      break;
    }
    case "phase_completed": {
      const phase = state.phases[event.phase];
      if (!phase || phase.status !== "started") fail(`${event.phase} was not started`);
      if (event.phase === "git-ops") fail("Git-Ops completes only through finalization_completed");
      phase.status = "completed";
      phase.completed_at = event.at;
      if (event.phase === "build" && phase.task_id && ownValue(state.tasks, phase.task_id)) {
        state.tasks[phase.task_id].status = "completed";
        state.tasks[phase.task_id].completed_seq = seq;
      }
      if (Object.hasOwn(event, "plan_digest")) fail("phase_completed cannot change plan_digest; use plan_recorded");
      state.status = Object.values(state.phases).some((candidate) => candidate.status === "blocked") ? "blocked" : "active";
      break;
    }
    case "phase_blocked": {
      const phase = state.phases[event.phase];
      if (!phase || phase.status !== "started") fail(`${event.phase} was not started`);
      if (!nonEmpty(event.reason)) fail("blocked phase requires a reason");
      phase.status = "blocked";
      phase.reason = event.reason;
      phase.completed_at = event.at;
      if (event.phase === "build" && phase.task_id && ownValue(state.tasks, phase.task_id)) {
        state.tasks[phase.task_id].status = "blocked";
        state.tasks[phase.task_id].completed_seq = null;
      }
      state.status = "blocked";
      break;
    }
    case "code_changed":
      if (state.critical_backfill_required) fail("critical escalation backfill must complete before source writes resume");
      if (event.task_id && ownValue(state.tasks, event.task_id)?.status === "superseded") {
        fail(`task packet ${event.task_id} is superseded and cannot receive source changes`);
      }
      if (!SHA_RE.test(event.head_sha ?? "") || !SHA_RE.test(event.tree_sha ?? "")) {
        fail("code change requires head_sha and tree_sha");
      }
      validateChangedPaths(event.changed_paths, "code change");
      enforceCriticalMutation(state, event.task_id ?? null, event.changed_paths, "critical code change");
      state.current_head_sha = event.head_sha;
      state.current_tree_sha = event.tree_sha;
      state.last_change_seq = seq;
      if (event.task_id && ownValue(state.tasks, event.task_id)) {
        state.tasks[event.task_id].status = "changed";
        state.tasks[event.task_id].completed_seq = null;
      }
      break;
    case "evidence_recorded": {
      if (!EVIDENCE_KINDS.has(event.kind)) fail(`unknown evidence kind ${JSON.stringify(event.kind)}`);
      if (!nonEmpty(event.command) || !Number.isInteger(event.exit_code)) fail("evidence requires command and integer exit_code");
      if (!SHA_RE.test(event.head_sha ?? "") || !SHA_RE.test(event.tree_sha ?? "")) {
        fail("evidence requires head_sha and tree_sha");
      }
      const workspaceId = event.workspace_id ?? state.active_workspace_id;
      if (workspaceId !== null && !Object.hasOwn(state.workspaces, workspaceId)) fail(`unknown evidence workspace ${workspaceId}`);
      state.evidence.push({
        kind: event.kind,
        command: event.command,
        exit_code: event.exit_code,
        head_sha: event.head_sha,
        tree_sha: event.tree_sha,
        task_id: event.task_id ?? null,
        workspace_id: workspaceId,
        recorded_at: event.at,
        seq,
      });
      break;
    }
    case "review_recorded": {
      if (!["specification", "quality", "whole-change", "combined"].includes(event.axis)) fail("review axis is invalid");
      if (!["APPROVE", "APPROVE-WITH-NITS", "CHANGES-REQUESTED", "UNVERIFIED"].includes(event.verdict)) fail("review verdict is invalid");
      for (const field of ["spec_verdict", "quality_verdict"]) {
        if (event[field] != null && !["APPROVE", "CHANGES-REQUESTED", "UNVERIFIED"].includes(event[field])) {
          fail(`${field} is invalid`);
        }
      }
      if (event.axis === "whole-change") {
        if (event.task_id != null) fail("whole-change review must not be scoped to one task");
        const axisVerdicts = [event.spec_verdict, event.quality_verdict];
        if (axisVerdicts.some((verdict) => !["APPROVE", "CHANGES-REQUESTED", "UNVERIFIED"].includes(verdict))) {
          fail("whole-change review requires specification and quality verdicts");
        }
        if (event.verdict === "APPROVE" && axisVerdicts.some((verdict) => verdict !== "APPROVE")) {
          fail("whole-change APPROVE requires both specification and quality APPROVE");
        }
      }
      if (!safeEntityId(event.context_id) || !SHA_RE.test(event.head_sha ?? "") || !SHA_RE.test(event.tree_sha ?? "")) {
        fail("review requires a safe context_id, head_sha, and tree_sha");
      }
      if (state.used_context_ids.includes(event.context_id)) fail(`context_id ${event.context_id} was already used by an independent invocation`);
      if (state.assurance.effective === "critical" && !Object.hasOwn(event, "workspace_id")) {
        fail("critical review requires explicit workspace_id attribution");
      }
      const workspaceId = event.workspace_id ?? state.active_workspace_id;
      if (workspaceId !== null && !Object.hasOwn(state.workspaces, workspaceId)) fail(`unknown review workspace ${workspaceId}`);
      if (state.assurance.effective === "critical") {
        const task = event.task_id ? ownValue(state.tasks, event.task_id) : null;
        const expectedWorkspaceId = task?.packet.workspace_id ?? state.active_workspace_id;
        if (workspaceId !== expectedWorkspaceId || workspaceId !== state.active_workspace_id) {
          fail("critical review must be attributed to the task packet's active writer workspace");
        }
        if ((state.current_head_sha && event.head_sha !== state.current_head_sha) ||
            (state.current_tree_sha && event.tree_sha !== state.current_tree_sha)) {
          fail("critical review must match the current candidate head/tree");
        }
      }
      state.reviews.push({
        axis: event.axis,
        verdict: event.verdict,
        spec_verdict: event.spec_verdict ?? null,
        quality_verdict: event.quality_verdict ?? null,
        context_id: event.context_id,
        head_sha: event.head_sha,
        tree_sha: event.tree_sha,
        task_id: event.task_id ?? null,
        workspace_id: workspaceId,
        recorded_at: event.at,
        seq,
      });
      state.used_context_ids.push(event.context_id);
      break;
    }
    case "finding_recorded":
      if (!safeEntityId(event.finding_id) || !nonEmpty(event.summary)) fail("finding requires a safe finding_id and summary");
      if (ownValue(state.findings, event.finding_id)) fail(`finding ${event.finding_id} already exists`);
      state.findings[event.finding_id] = {
        finding_id: event.finding_id,
        summary: event.summary,
        evidence: event.evidence ?? null,
        disposition: "pending",
        recorded_at: event.at,
      };
      break;
    case "finding_adjudicated": {
      const finding = ownValue(state.findings, event.finding_id);
      if (!finding) fail(`unknown finding ${event.finding_id}`);
      if (!["accepted", "rejected", "needs-context"].includes(event.disposition)) fail("finding disposition is invalid");
      if (!nonEmpty(event.reason)) fail("finding adjudication requires a reason");
      if (finding.repair) fail(`${event.finding_id} cannot be re-adjudicated after repair starts`);
      if (!["pending", "needs-context"].includes(finding.disposition)) {
        fail(`${event.finding_id} disposition ${finding.disposition} is final`);
      }
      finding.disposition = event.disposition;
      finding.reason = event.reason;
      finding.adjudicated_at = event.at;
      break;
    }
    case "repair_suspended": {
      const finding = ownValue(state.findings, event.finding_id);
      if (finding?.repair?.status !== "started") fail(`${event.finding_id} has no active repair to suspend`);
      if (!nonEmpty(event.reason)) fail("repair suspension requires a reason");
      finding.repair.status = "suspended";
      finding.repair.suspended_at = event.at;
      finding.repair.suspended_reason = event.reason;
      break;
    }
    case "repair_started": {
      if (state.critical_backfill_required) fail("critical escalation backfill must complete before repairs resume");
      const finding = ownValue(state.findings, event.finding_id);
      if (!finding) fail(`unknown finding ${event.finding_id}`);
      if (finding.disposition === "needs-context") fail(`${event.finding_id} needs-context; stop and ask the load-bearing question`);
      if (finding.disposition !== "accepted") fail(`${event.finding_id} is not an accepted finding`);
      if (finding.repair && finding.repair.status !== "suspended") {
        fail(`${event.finding_id} repair is already ${finding.repair.status}`);
      }
      if (Object.values(state.findings).some((candidate) => candidate.repair?.status === "started")) fail("finish the active accepted finding before starting another");
      const task = event.task_id ? ownValue(state.tasks, event.task_id) : null;
      if (task?.status === "superseded") fail(`task packet ${event.task_id} is superseded and cannot start a repair`);
      if (task && task.packet.plan_digest !== state.plan_digest) {
        fail(`task packet ${event.task_id} is stale for the current plan and cannot start a repair`);
      }
      if (state.assurance.effective === "critical") {
        if (!task) fail("critical repair requires a validated task packet");
        if (event.workspace_id !== task.packet.workspace_id || event.workspace_id !== state.active_workspace_id) {
          fail("critical repair requires the task packet's active workspace binding");
        }
        if (event.definition_digest !== state.definition_digests["skill:build"]) {
          fail("critical repair requires the current Build definition digest");
        }
        if (scopedCritical(state, event.task_id)) activeCriticalBuild(state, event.task_id, "critical repair");
      }
      const previousAttempts = clone(finding.repair?.previous_attempts ?? []);
      if (finding.repair?.status === "suspended") {
        const previous = clone(finding.repair);
        delete previous.previous_attempts;
        previousAttempts.push(previous);
      }
      finding.repair = {
        status: "started",
        started_at: event.at,
        task_id: event.task_id ?? null,
        workspace_id: event.workspace_id ?? null,
        definition_digest: event.definition_digest ?? null,
        previous_attempts: previousAttempts,
      };
      break;
    }
    case "repair_completed": {
      if (state.critical_backfill_required) fail("critical escalation backfill must complete before repairs resume");
      const finding = ownValue(state.findings, event.finding_id);
      if (finding?.repair?.status !== "started") fail(`${event.finding_id} repair was not started`);
      if (event.task_id && ownValue(state.tasks, event.task_id)?.status === "superseded") {
        fail(`task packet ${event.task_id} is superseded and cannot complete a repair`);
      }
      if (!SHA_RE.test(event.head_sha ?? "") || !SHA_RE.test(event.tree_sha ?? "")) {
        fail("repair completion requires head_sha and tree_sha");
      }
      validateChangedPaths(event.changed_paths, "repair completion");
      for (const field of ["task_id", "workspace_id", "definition_digest"]) {
        if (finding.repair[field] !== (event[field] ?? null)) fail(`repair completion ${field} must match repair_started`);
      }
      if (state.assurance.effective === "critical" && !event.task_id) fail("critical repair completion requires task bindings");
      enforceCriticalMutation(state, event.task_id ?? null, event.changed_paths, "critical repair completion");
      finding.repair = {
        status: "completed",
        started_at: finding.repair.started_at,
        completed_at: event.at,
        task_id: finding.repair.task_id,
        workspace_id: finding.repair.workspace_id,
        definition_digest: finding.repair.definition_digest,
        previous_attempts: clone(finding.repair.previous_attempts ?? []),
      };
      state.current_head_sha = event.head_sha;
      state.current_tree_sha = event.tree_sha;
      state.last_change_seq = seq;
      if (event.task_id && ownValue(state.tasks, event.task_id)) {
        state.tasks[event.task_id].status = "changed";
        state.tasks[event.task_id].completed_seq = null;
      }
      break;
    }
    case "backfill_completed": {
      if (!state.frozen_diff) fail("critical backfill requires a frozen diff");
      if (!Array.isArray(event.receipts) || event.receipts.length === 0) fail("critical backfill requires receipts");
      const seen = new Set();
      for (const receipt of event.receipts) {
        if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) fail("backfill receipt must be an object");
        const allowed = new Set(["control", "base_sha", "head_sha", "tree_sha", "result", "evidence", "context_id"]);
        const extra = Object.keys(receipt).filter((field) => !allowed.has(field));
        if (extra.length) fail(`backfill receipt contains unsupported field(s): ${extra.join(", ")}`);
        if (!BACKFILL_CONTROLS.includes(receipt.control)) fail(`unknown backfill control ${JSON.stringify(receipt.control)}`);
        if (seen.has(receipt.control)) fail(`duplicate backfill control ${receipt.control}`);
        seen.add(receipt.control);
        if (receipt.base_sha !== state.frozen_diff.base_sha || receipt.head_sha !== state.frozen_diff.head_sha ||
            receipt.tree_sha !== state.frozen_diff.tree_sha) {
          fail(`backfill receipt ${receipt.control} must match the frozen base/head/tree SHAs`);
        }
        if (receipt.result !== "pass" || !nonEmpty(receipt.evidence)) {
          fail(`backfill receipt ${receipt.control} requires a passing result and concrete evidence`);
        }
        if (receipt.control === "frozen-diff-review") {
          if (!safeEntityId(receipt.context_id)) fail("backfill receipt frozen-diff-review requires a safe independent context_id");
          if (state.used_context_ids.includes(receipt.context_id)) {
            fail(`context_id ${receipt.context_id} was already used by an independent invocation`);
          }
          state.used_context_ids.push(receipt.context_id);
        }
      }
      const missingControls = BACKFILL_CONTROLS.filter((control) => !seen.has(control));
      if (missingControls.length) fail(`backfill receipts missing control(s): ${missingControls.join(", ")}`);
      state.critical_backfill_required = false;
      state.backfill = { receipts: clone(event.receipts), completed_at: event.at };
      state.last_authority_seq = seq;
      break;
    }
    case "finish_selected":
      if (state.finish) fail(`finish choice already selected as ${state.finish.choice}`);
      if (!FINISH_CHOICES.includes(event.choice)) fail(`finish choice must be ${FINISH_CHOICES.join(", ")}`);
      if (event.choice === "discard" && event.explicit_request !== true) fail("discard requires an explicit user request");
      state.finish = { choice: event.choice, explicit_request: event.explicit_request === true, selected_at: event.at };
      break;
    case "finalization_completed": { // the only legal Git-Ops phase completion
      if (!state.finish) fail("finalization requires an explicit finish choice");
      if (state.finalization) fail("finalization is already completed");
      const gitOps = state.phases["git-ops"];
      if (!gitOps || gitOps.status !== "started") fail("finalization requires an active Git-Ops phase");
      if (!nonEmpty(event.final_branch) || /[\r\n]/.test(event.final_branch)) fail("finalization requires a final_branch");
      if (!SHA_RE.test(event.head_sha ?? "") || !SHA_RE.test(event.tree_sha ?? "")) {
        fail("finalization requires final head_sha and tree_sha");
      }
      if (!state.current_tree_sha || event.tree_sha !== state.current_tree_sha) {
        fail("finalization tree must equal the verified candidate tree");
      }
      const ready = evaluateGate(state, "finalize");
      if (!ready.ok) fail(`${ready.code}: ${ready.missing.join("; ")}`);
      state.finalization = {
        choice: state.finish.choice,
        candidate_head_sha: state.current_head_sha,
        final_branch: event.final_branch,
        head_sha: event.head_sha,
        tree_sha: event.tree_sha,
        completed_at: event.at,
      };
      state.current_head_sha = event.head_sha;
      state.current_tree_sha = event.tree_sha;
      gitOps.status = "completed";
      gitOps.completed_at = event.at;
      state.status = "finished";
      break;
    }
    case "side_effect_approved":
      if (!SIDE_EFFECTS.has(event.action)) fail("side-effect approval action is invalid");
      if (event.approved_by !== "user" || !nonEmpty(event.reason)) fail("side-effect approval requires the user and a consequence-aware reason");
      state.approvals.push({ action: event.action, approved_by: "user", reason: event.reason, approved_at: event.at, seq });
      break;
    case "gate_evaluated":
      // Observation only. The log records that a gate ran and how it answered; the derived state is
      // deliberately unchanged, which is what lets this event exist without a snapshot schema change
      // and without disturbing the freshness floors (`last_change_seq`, `last_authority_seq`).
      if (!GATES.includes(event.gate)) fail(`gate_evaluated gate ${JSON.stringify(event.gate)} is invalid`);
      if (!GATE_CODES.has(event.code)) fail("gate_evaluated code must be OK, BLOCKED_ASSURANCE, or BLOCKED_CRITICAL_ASSURANCE");
      if (!Number.isInteger(event.missing_count) || event.missing_count < 0) {
        fail("gate_evaluated missing_count must be a non-negative integer");
      }
      if ((event.code === "OK") !== (event.missing_count === 0)) fail("gate_evaluated code and missing_count disagree");
      break;
    default:
      fail(`unknown event type ${JSON.stringify(event.type)}`);
  }

  state.event_seq = seq;
  if (event.event_digest) state.event_digest = event.event_digest;
  const result = validateRunState(state);
  if (!result.ok) fail(`event produced invalid state: ${result.errors.join("; ")}`);
  return state;
}

export function defaultStateDir(cwd = process.cwd(), env = process.env) {
  if (env.PI_ASSURANCE_STATE_DIR) return resolve(env.PI_ASSURANCE_STATE_DIR);
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const common = execFileSync("git", ["rev-parse", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return join(isAbsolute(common) ? common : resolve(root, common), "principal-pi-skills", "assurance-v1");
  } catch {
    const xdg = env.XDG_STATE_HOME || join(homedir(), ".local", "state");
    return join(xdg, "principal-pi-skills", digest(resolve(cwd)).slice(0, 16), "assurance-v1");
  }
}

function eventDigest(event) {
  const copy = { ...event };
  delete copy.event_digest;
  return digest(copy);
}

function atomicJson(path, value) {
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}

/** Append-only store with a derived, replaceable snapshot. */
export class AssuranceStore {
  constructor({ baseDir = defaultStateDir(), now = () => new Date().toISOString() } = {}) {
    this.baseDir = baseDir;
    this.now = now;
  }

  paths(runId) {
    if (!RUN_ID_RE.test(runId ?? "")) fail("run_id must be a safe path-independent identifier");
    const dir = join(this.baseDir, "runs", runId);
    return { dir, log: join(dir, "events.jsonl"), snapshot: join(dir, "snapshot.json"), lock: join(dir, ".lock") };
  }

  withLock(runId, fn) {
    const paths = this.paths(runId);
    mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
    try {
      mkdirSync(paths.lock);
    } catch {
      fail(`run ${runId} is busy; another process holds the state lock`);
    }
    try {
      return fn(paths);
    } finally {
      rmSync(paths.lock, { recursive: true, force: true });
    }
  }

  init({ workflow, request, runId = `run-${Date.now()}-${randomUUID().slice(0, 8)}`, definitionDigests = {} }) {
    return this.withLock(runId, (paths) => {
      if (existsSync(paths.log)) fail(`run ${runId} already exists`);
      const at = this.now();
      const state = createInitialState({ workflow, request, runId, now: at, definitionDigests });
      const event = {
        schema_version: SCHEMA_VERSION,
        seq: 1,
        type: "run_initialized",
        at,
        prev_digest: null,
        run_id: runId,
        workflow,
        request,
        definition_digests: definitionDigests,
      };
      event.event_digest = eventDigest(event);
      appendFileSync(paths.log, `${JSON.stringify(event)}\n`, { mode: 0o600 });
      state.event_seq = 1;
      state.event_digest = event.event_digest;
      atomicJson(paths.snapshot, state);
      return state;
    });
  }

  load(runId) {
    const paths = this.paths(runId);
    if (!existsSync(paths.log)) fail(`unknown run ${runId}`);
    const lines = readFileSync(paths.log, "utf8")
      .split("\n")
      .filter(Boolean);
    if (lines.length === 0) fail("event-log integrity failure: log is empty");
    let state = null;
    let previous = null;
    for (let index = 0; index < lines.length; index++) {
      let event;
      try {
        event = JSON.parse(lines[index]);
      } catch {
        fail(`event-log integrity failure at line ${index + 1}: invalid JSON`);
      }
      if (event.schema_version !== SCHEMA_VERSION) {
        fail(`event-log integrity failure at line ${index + 1}: unsupported schema version ${JSON.stringify(event.schema_version)}`);
      }
      if (event.run_id !== runId) fail(`event-log integrity failure at line ${index + 1}: run_id does not match selected run ${runId}`);
      if (event.seq !== index + 1) fail(`event-log integrity failure at line ${index + 1}: sequence mismatch`);
      if (event.prev_digest !== previous) fail(`event-log integrity failure at line ${index + 1}: previous digest mismatch`);
      if (event.event_digest !== eventDigest(event)) fail(`event-log integrity failure at line ${index + 1}: event digest mismatch`);
      if (index === 0) {
        if (event.type !== "run_initialized") fail("event-log integrity failure: first event must initialize the run");
        state = createInitialState({
          workflow: event.workflow,
          request: event.request,
          runId: event.run_id,
          now: event.at,
          definitionDigests: event.definition_digests,
        });
        state.event_seq = 1;
        state.event_digest = event.event_digest;
      } else {
        state = applyEvent(state, event);
        state.event_digest = event.event_digest;
      }
      previous = event.event_digest;
    }
    return state;
  }

  append(runId, payload) {
    return this.withLock(runId, (paths) => {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail("event payload must be an object");
      canonicalJson(payload); // reject values JSON.stringify would omit or rewrite before hashing
      const reserved = ["schema_version", "seq", "at", "prev_digest", "run_id", "event_digest"];
      const overridden = reserved.find((field) => Object.hasOwn(payload, field));
      if (overridden) fail(`event payload contains reserved metadata field ${overridden}`);
      const state = this.load(runId);
      const event = {
        ...payload,
        schema_version: SCHEMA_VERSION,
        seq: state.event_seq + 1,
        at: this.now(),
        prev_digest: state.event_digest,
        run_id: runId,
      };
      if (event.run_id !== runId) fail("event run_id cannot differ from the selected run");
      event.event_digest = eventDigest(event);
      const next = applyEvent(state, event);
      next.event_digest = event.event_digest;
      appendFileSync(paths.log, `${JSON.stringify(event)}\n`, { mode: 0o600 });
      atomicJson(paths.snapshot, next);
      return next;
    });
  }
}

function definitionDigests() {
  const paths = [
    ...["decide", "architect", "plan", "build", "review", "debug", "git-ops"].map((name) => [`skill:${name}`, `${name}/SKILL.md`]),
    ...["principal-plan", "principal-review", "principal-debug"].map((name) => [`agent:${name}`, `agents/${name}.md`]),
    ...["principal-feature", "principal-bugfix"].map((name) => [`prompt:${name}`, `prompts/${name}.md`]),
  ];
  return Object.fromEntries(paths.map(([name, path]) => [name, digest(readFileSync(join(ROOT, path), "utf8"))]));
}

function cliFlag(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1]) fail(`${name} requires a value`);
  return args[index + 1];
}

function stdin() {
  return readFileSync(0, "utf8");
}

export function runCli(argv, { cwd = process.cwd(), env = process.env, out = console.log, err = console.error, input = stdin } = {}) {
  try {
    const [command] = argv;
    const stateDir = cliFlag(argv, "--state-dir", defaultStateDir(cwd, env));
    const store = new AssuranceStore({ baseDir: stateDir });

    if (command === "contract") {
      out(EVENT_CONTRACT);
      return 0;
    }
    if (command === "init") {
      const workflow = cliFlag(argv, "--workflow");
      const requestFlag = cliFlag(argv, "--request");
      const request = requestFlag ?? JSON.parse(input()).request;
      const runId = cliFlag(argv, "--run-id");
      const state = store.init({ workflow, request, runId: runId ?? undefined, definitionDigests: definitionDigests() });
      out(JSON.stringify({ run_id: state.run_id, state_dir: stateDir, assurance: state.assurance }, null, 2));
      return 0;
    }
    if (command === "show") {
      out(JSON.stringify(store.load(cliFlag(argv, "--run-id")), null, 2));
      return 0;
    }
    if (command === "event") {
      const runId = cliFlag(argv, "--run-id");
      const raw = cliFlag(argv, "--json", null) ?? stdin();
      const payload = JSON.parse(raw);
      out(JSON.stringify(store.append(runId, payload), null, 2));
      return 0;
    }
    if (command === "gate") {
      const runId = cliFlag(argv, "--run-id");
      const gate = cliFlag(argv, "--gate");
      const taskId = cliFlag(argv, "--task-id");
      const action = cliFlag(argv, "--action");
      const result = evaluateGate(store.load(runId), gate, { task_id: taskId, action });
      // A gate outcome nobody can produce as evidence is the hole this event closes, so recording
      // failure is an error rather than a silent pass. A blocked gate still returns 3: the block is
      // the more important fact, and swallowing it to report a logging problem would invert them.
      let recorded = true;
      try {
        store.append(runId, {
          type: "gate_evaluated",
          gate,
          code: result.code,
          missing_count: result.missing.length,
          ...(taskId ? { task_id: taskId } : {}),
          ...(action ? { action } : {}),
        });
      } catch (error) {
        recorded = false;
        err(`gate outcome could not be recorded: ${error.message}`);
      }
      if (!result.ok) {
        err(`${result.code}\nMissing controls:\n${result.missing.map((item) => `- ${item}`).join("\n")}`);
        return 3;
      }
      if (!recorded) return 1;
      out("OK");
      return 0;
    }
    if (command === "validate-task") {
      const file = cliFlag(argv, "--file");
      const packet = JSON.parse(file ? readFileSync(resolve(cwd, file), "utf8") : stdin());
      const result = validateTaskPacket(packet);
      if (!result.ok) {
        err(result.errors.join("\n"));
        return 1;
      }
      out(digest(packet));
      return 0;
    }
    if (command === "digest") {
      const file = cliFlag(argv, "--file");
      out(digest(file ? readFileSync(resolve(cwd, file), "utf8") : stdin()));
      return 0;
    }
    if (command === "where") {
      out(stateDir);
      return 0;
    }

    err("usage: principal-pi-assurance <contract|init|show|event|gate|validate-task|digest|where> [options]");
    return 2;
  } catch (error) {
    err(`✗ ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (invokedDirectly) process.exit(runCli(process.argv.slice(2)));
