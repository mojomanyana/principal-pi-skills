// An exact native Review can judge its bound task output. Bookkeeping alone never approves.
import { createHash } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, readSync, realpathSync } from "node:fs";
import { criterionCoverage } from "./check-runner.mjs";
import { inspectOperation, inspectRecoveryOperation } from "./workflow-state.mjs";

const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash("sha256").update(value).digest("hex");
const same = (a, b) => canonical(a) === canonical(b);
const assert = (condition, message) => { if (!condition) throw Error(message); };

function reportText(path, sha256) {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fstatSync(fd);
    assert(stat.isFile() && stat.size > 0 && stat.size <= 96000, "review receipt is absent or exceeds bound");
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < bytes.length) { const n = readSync(fd, bytes, offset, bytes.length - offset, offset); assert(n > 0, "review report shortened"); offset += n; }
    assert(readSync(fd, Buffer.alloc(1), 0, 1, bytes.length) === 0 && fstatSync(fd).size === stat.size && hash(bytes) === sha256, "review report changed");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally { closeSync(fd); }
}

function receipt(text, binding) {
  const matches = [...text.matchAll(/^```principal-review\r?\n([^]*?)^```[ \t]*$/gmu)];
  assert(matches.length === 1 && Buffer.byteLength(matches[0][1]) <= 12000, "one explicit review receipt required");
  const parsed = JSON.parse(matches[0][1]);
  const keys = ["version", "bindingId", "scope", "verdict", "quality", "alignment", "evidence"];
  assert(parsed && keys.every(key => Object.hasOwn(parsed, key)) && Object.keys(parsed).every(key => keys.includes(key) || key === "criterionJudgments") && parsed.version === 1 && parsed.bindingId === binding.id,
    "review receipt binding mismatch");
  assert(["task", "integrated"].includes(binding.reviewScope) && parsed.scope === binding.reviewScope && ["APPROVE", "APPROVE-WITH-NITS", "CHANGES-REQUESTED", "UNVERIFIED"].includes(parsed.verdict), "review receipt scope or verdict unsupported");
  for (const key of ["quality", "alignment", "evidence"]) {
    const row = parsed[key];
    assert(row && Object.keys(row).length === 2 && ["pass", "fail", "unverified"].includes(row.status) &&
      typeof row.reason === "string" && row.reason.trim() && row.reason.length <= 2000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(row.reason), "review dimension and reason required");
  }
  // Require the ordinary human-readable verdict to agree; never search for APPROVE anywhere.
  const verdicts = [...text.matchAll(/^Verdict: (APPROVE-WITH-NITS|APPROVE|CHANGES-REQUESTED|UNVERIFIED)[ \t]*\r?$/gmu)];
  assert(verdicts.length === 1 && verdicts[0][1] === parsed.verdict, "review verdicts disagree or are ambiguous");
  const statuses = [parsed.quality.status, parsed.alignment.status, parsed.evidence.status];
  if (["APPROVE", "APPROVE-WITH-NITS"].includes(parsed.verdict)) assert(statuses.every(value => value === "pass"), "approval contradicts dimension judgments");
  if (parsed.verdict === "CHANGES-REQUESTED") assert(statuses.includes("fail"), "changes requested needs a substantive failed dimension");
  if (parsed.criterionJudgments !== undefined) {
    assert(Array.isArray(parsed.criterionJudgments) && parsed.criterionJudgments.length <= 32, "bounded criterion judgments required");
    const seen = new Set();
    for (const row of parsed.criterionJudgments) {
      assert(row && Object.keys(row).length === 4 && ["operationId", "id", "status", "evidence"].every(key => Object.hasOwn(row, key)) &&
        /^principal:[a-f0-9]{64}$/.test(row.operationId) && typeof row.id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(row.id) &&
        ["pass", "fail", "unverified"].includes(row.status) &&
        binding.inputs.some(input => same(input, row.evidence)), "judgment requires an exact prepared review input");
      const key = row.operationId + "/" + row.id;
      assert(!seen.has(key), "duplicate criterion judgment");
      seen.add(key);
    }
  }
  return parsed;
}

/** Extract an opaque handle from existing native storage; this does not grant acceptance. */
export function observeReviewReference(repo, operationId) {
  const result = inspectOperation(repo, { operationId });
  assert(result.phase === "review" && result.reviewBinding && result.resultRetained && result.report, "review has no bound retained result");
  return { kind: "principal-review", repo: result.root, operationId: result.operation_id,
    bindingId: result.reviewBinding.id, reportSha256: result.report.sha256 };
}

/** Read only the already-authorized producer record to identify additional roots needing trusted selection. */
export function reviewReferenceRepositories(reference, { repositories } = {}) {
  assert(reference?.kind === "principal-review" && Array.isArray(repositories) && repositories.includes(reference.repo), "review repository not selected");
  const review = inspectOperation(reference.repo, { operationId: reference.operationId }), binding = review.reviewBinding;
  assert(review.phase === "review" && binding?.id === reference.bindingId && review.report?.sha256 === reference.reportSha256, "review binding unavailable");
  const { id, ...body } = binding;
  assert(id === `principal-review-binding:${hash(canonical(body))}`, "review binding changed");
  const members = binding.integrationSubject?.resources ?? [];
  assert(Array.isArray(members) && members.length <= 16, "invalid integration member set");
  return [...new Set([reference.repo, ...members.map(member => member.repo)])];
}

/** Trusted owner observation for Bookie's neutral judgment interface. No result body is disclosed. */
export function resolveReviewReference(reference, purpose, { repositories, resolveOutput, resolveIntegration } = {}) {
  let exact;
  try {
    exact = structuredClone(reference);
    assert(exact && Object.keys(exact).length === 5 && Object.keys(exact).every(key => ["kind", "repo", "operationId", "bindingId", "reportSha256"].includes(key)) &&
      exact.kind === "principal-review" && /^principal:[a-f0-9]{64}$/u.test(exact.operationId) && /^principal-review-binding:[a-f0-9]{64}$/u.test(exact.bindingId) && /^[a-f0-9]{64}$/u.test(exact.reportSha256), "invalid review reference");
    purpose = structuredClone(purpose);
    assert(Array.isArray(repositories) && repositories.map(repo => realpathSync(repo)).includes(exact.repo) && realpathSync(exact.repo) === exact.repo && typeof resolveOutput === "function", "review repository not selected");
    const checked = () => {
      const review = inspectOperation(exact.repo, { operationId: exact.operationId }), binding = review.reviewBinding;
      assert(review.phase === "review" && review.completionValid && binding?.id === exact.bindingId && review.report?.sha256 === exact.reportSha256 && review.owner?.sessionId,
        "review is not current, bound and complete");
      const { id, ...body } = binding;
      assert(id === `principal-review-binding:${hash(canonical(body))}` && same(binding.inputs, review.inputs), "review binding or inputs changed");
      assert(purpose?.purpose === "judgment" && purpose.reviewScope === binding.reviewScope && ["initiativeId", "taskId", "taskRevision", "outputId"].every(key => purpose[key] === binding[key]), "review belongs to another task revision or output");
      const source = binding.sourceRecovery === undefined ? inspectOperation(exact.repo, { operationId: binding.sourceOperationId })
        : inspectRecoveryOperation(exact.repo, { operationId: binding.sourceOperationId });
      if (binding.sourceRecovery !== undefined) assert(same(binding.sourceRecovery, source.sourceRecovery), "recovered source reference changed");
      assert(["build", "debug"].includes(source.phase) && (source.completionValid || binding.sourceRecovery !== undefined && source.sourceRecovery !== undefined) && source.disposition === "succeeded" &&
        (binding.sourceRecovery === undefined ? same(source.output, review.candidate) : source.output?.id === review.candidate.id && source.output?.root === review.candidate.root && source.output?.algorithm === review.candidate.algorithm), "source output is no longer current");
      const author = source.runtime?.runtime?.final, reviewer = review.runtime?.runtime?.final;
      assert(author?.sessionId && reviewer?.sessionId && author.sessionId !== reviewer.sessionId && reviewer.sessionId !== review.owner.sessionId &&
        source.runtime.executionId !== review.runtime.executionId, "review does not have independent native child identity");
      const output = resolveOutput(binding.outputReference.reference, { repositories });
      assert(output.status === "current", "bound output changed");
      const integration = binding.integrationSubject === undefined ? undefined :
        typeof resolveIntegration === "function" ? resolveIntegration(binding.integrationSubject, { repositories }) : undefined;
      assert(binding.integrationSubject === undefined || (binding.reviewScope === "integrated" && integration?.status === "current"), "integrated review member changed or is not selected");
      const parsed = receipt(reportText(review.report.path, exact.reportSha256), binding);
      for (const row of parsed.criterionJudgments ?? []) {
        const owner = [source, review].find(operation => operation.operation_id === row.operationId);
        assert(owner?.criteria?.some(criterion => criterion.id === row.id && !Object.hasOwn(criterion, "expected")),
          "independent criterion judgment must name a declared qualitative criterion");
      }
      const verdict = parsed.verdict === "CHANGES-REQUESTED" ? "rejected" : parsed.verdict === "UNVERIFIED" ? "unverified" : "accepted";
      assert((verdict === "accepted" && review.disposition === "succeeded") || (verdict === "rejected" && review.disposition === "changes-requested") || (verdict === "unverified" && ["unverified", "blocked"].includes(review.disposition)), "review disposition contradicts its explicit judgment");
      const coverage = [];
      if (verdict === "accepted") {
        for (const operation of [source, review]) {
          if (!operation.criteria?.length) continue;
          // The reviewer may validate current evidence acquired after Build.
          // The source candidate and task identity still govern its applicability.
          const evidence = [...new Map([...(operation.evidence ?? []), ...review.inputs, ...(review.evidence ?? [])]
            .map(ref => [ref.path + ":" + ref.sha256, ref])).values()];
          const scoped = criterionCoverage({ ...operation, evidence });
          const judgments = operation.criteria.filter(criterion => criterion.required && !Object.hasOwn(criterion, "expected") &&
            parsed.criterionJudgments?.some(row => row.operationId === operation.operation_id && row.id === criterion.id && row.status === "pass"));
          coverage.push({ operationId: operation.operation_id, required: scoped.required,
            supported: scoped.supported + judgments.length, observed: scoped.supported, independentlyJudged: judgments.length });
        }
      }
      const openCriteria = coverage.some(item => item.supported < item.required);
      return { binding, parsed, verdict: openCriteria ? "unverified" : verdict, recordedVerdict: verdict, coverage, output, integration, report: review.report };
    };
    const value = checked();
    return { status: "current", reference: structuredClone(exact),
      judgment: { subjectRevision: value.binding.taskRevision, outputId: value.binding.outputId,
        outputReference: structuredClone(value.binding.outputReference), reviewScope: value.binding.reviewScope, verdict: value.verdict },
      observed: { ...(value.coverage.length ? { recordedVerdict: value.recordedVerdict, requiredCriterionCoverage: value.coverage } : {}),
        scope: value.parsed.scope, quality: value.parsed.quality.status, alignment: value.parsed.alignment.status, evidence: value.parsed.evidence.status,
        ...(value.binding.integrationSubject ? { integrationSubjectId: value.binding.integrationSubject.id, integrationMembers: value.binding.integrationSubject.resources.length } : {}),
        report: value.report, sourceOperationId: value.binding.sourceOperationId, reviewOperationId: exact.operationId,
        independence: "distinct-native-child-sessions", inputEvidence: "prepared-exact-references-and-explicit-review-judgment", approval: false },
      assertCurrent: async () => {
        // These exact retained tickets perform fresh reads; they do not cache currentness.
        await value.output.assertCurrent();
        await value.integration?.assertCurrent();
        // Recheck native identity, inputs, binding, all members and receipt after awaits.
        const fresh = checked();
        assert(fresh.verdict === value.verdict && same(fresh.coverage, value.coverage), "criterion evidence changed after review observation");
      } };
  } catch {
    return { status: "unverified", reference: exact ?? reference };
  }
}
