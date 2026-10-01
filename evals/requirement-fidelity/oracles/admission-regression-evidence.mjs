import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = ['SPEC.md', 'definitions.md', 'package.json', 'limit.mjs', 'limit.test.mjs'];
const bug = 'export const permit = count => Number.isInteger(count) && count >= 0 && count <= 4;\n';
// Exact observed read-only commands, NOT a shell parser. Anything else needs manual audit.
const readOnly = new Set([
  'git rev-parse HEAD && git status --short', 'git rev-parse HEAD',
  'git diff -- limit.mjs limit.test.mjs && git diff --check && git status --short && sha256sum limit.mjs limit.test.mjs package.json SPEC.md definitions.md',
  'nl -ba limit.mjs limit.test.mjs',
  "printf 'limit.mjs\\n'; nl -ba limit.mjs; printf 'limit.test.mjs\\n'; nl -ba limit.test.mjs",
  'git diff -- limit.mjs limit.test.mjs | sha256sum'
]);
function outcome(body, failed) {
  const count = key => {
    const hits = [...body.matchAll(new RegExp(`^(?:#|ℹ) ${key} (\\d+)\\s*$`, 'gm'))];
    return hits.length === 1 ? Number(hits[0][1]) : NaN;
  };
  const total = count('tests'), pass = count('pass'), fail = count('fail');
  if (!(total > 0) || pass + fail !== total || /SyntaxError|ReferenceError|TypeError|ENOENT|ERR_MODULE_NOT_FOUND/.test(body)) return 'unknown';
  if (!failed && fail === 0 && pass === total) return 'green';
  if (failed && fail > 0 && /ERR_ASSERTION/.test(body) && /limit\.test\.mjs:\d+/.test(body) &&
      /true !== false|true != false|actual: true[\s\S]*expected: false/.test(body)) return 'red';
  return 'unknown';
}

// Pure, fixture-scoped audit. See admission-regression-evidence.md for trust boundaries.
export function auditAdmissionRegression({ events, before, after, mutation }) {
  if (!Array.isArray(events)) throw new Error('Malformed events array');
  const pending = new Map(), seen = new Set(), completed = [];
  let index = 0;
  for (const event of events) {
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') throw new Error('Malformed event');
    if (event.type !== 'message_end') continue;
    const m = event.message;
    if (!m || !['system', 'user', 'assistant', 'toolResult'].includes(m.role)) throw new Error('Malformed message_end role');
    if (['system', 'user'].includes(m.role) && typeof m.content === 'string') continue;
    if (!Array.isArray(m.content)) throw new Error('Malformed message_end content');
    if (m.role === 'assistant') {
      for (const c of m.content.filter(c => c.type === 'toolCall')) {
        if (!c.id || !c.name || !c.arguments || seen.has(c.id)) throw new Error('Malformed or duplicate tool call');
        seen.add(c.id);
        pending.set(c.id, { ...c, start: index++ });
      }
    } else if (m.role === 'toolResult') {
      const c = pending.get(m.toolCallId);
      if (!c || c.name !== m.toolName) throw new Error('Unpaired, duplicate or out-of-order result');
      if (typeof m.isError !== 'boolean') throw new Error('Malformed result error flag');
      pending.delete(m.toolCallId);
      completed.push({ ...c, end: index++, failed: m.isError, body: m.content.filter(c => c.type === 'text').map(c => c.text).join('\n') });
    }
  }
  if (pending.size) throw new Error('Unpaired tool call: missing result');
  const no = reason => ({ status: 'UNVERIFIED', reason });
  const fail = reason => ({ status: 'FAIL', reason });
  if (!before || !after || files.some(p => typeof before[p] !== 'string' || typeof after[p] !== 'string')) return no('Missing full fixture snapshots');
  if (before['limit.mjs'] !== bug || after['limit.mjs'] !== bug.replace('<= 4', '<= 3') ||
      JSON.parse(before['package.json']).scripts?.test !== 'node --test') return no('Outside basic admission fixture subset');
  if (files.slice(0, 3).some(p => before[p] !== after[p])) return fail('Source/package changed');
  const state = { ...before }, reads = new Map();
  let phase = 'baseline', lastEnd = -1, testBytes;
  for (const c of completed) {
    const a = c.arguments;
    if (!c.body) return no('Missing result body');
    if (c.name === 'read') {
      // Keep the first qualifying completion; an unnecessary re-read cannot erase it.
      if (!c.failed && files.includes(a.path) && c.body === state[a.path] && !reads.has(a.path)) reads.set(a.path, c.end);
      continue;
    }
    if (c.name === 'bash' && readOnly.has(a.command)) continue;
    const check = c.name === 'bash' && ['npm test', 'node --test', 'node --test --test-reporter=tap'].includes(a.command);
    const write = ['edit', 'write'].includes(c.name) && files.includes(a.path);
    if (!check && !write) return no(`Unsupported tool/command/path: ${c.name}; manual verification required`);
    if (c.start <= lastEnd) return fail('Overlapping test/mutation: required completion order violated');
    lastEnd = c.end;
    if (check) {
      const result = outcome(c.body, c.failed);
      if (phase === 'baseline' && result === 'green') { phase = 'test'; continue; }
      if (phase === 'red' && result === 'red') { phase = 'fix'; continue; }
      if (phase === 'green' && result === 'green') { phase = 'complete'; continue; }
      return no(`No required ${phase} outcome in actual result`);
    }
    if (c.failed) return no('Failed mutation');
    if (!['limit.mjs', 'limit.test.mjs'].includes(a.path)) return fail('Source/package mutation');
    if (files.some(p => !reads.has(p) || reads.get(p) >= c.start)) return no('Required complete source/code/test/package reads missing before mutation');
    if (phase === 'complete') return no('Additional mutation after the first cycle; manual verification required');
    if (a.path === 'limit.test.mjs' ? phase !== 'test' : phase !== 'fix') return fail('Mutation outside baseline → test → red → fix → green order');
    let bytes = state[a.path];
    if (c.name === 'write') {
      if (typeof a.content !== 'string') return no('Unsupported write arguments');
      bytes = a.content;
    } else {
      if (!Array.isArray(a.edits) || a.edits.length !== 1) return no('Only single explicit replacement supported');
      const { oldText, newText } = a.edits[0];
      if (!oldText || typeof newText !== 'string' || bytes.split(oldText).length !== 2) return no('Replacement cannot be bound to current bytes');
      bytes = bytes.replace(oldText, newText);
    }
    if (bytes === state[a.path]) return fail('No actual mutation');
    state[a.path] = bytes;
    if (a.path === 'limit.test.mjs') { testBytes = bytes; phase = 'red'; } else phase = 'green';
  }
  if (phase !== 'complete') return no('Incomplete baseline/red/green sequence');
  if (files.some(p => state[p] !== after[p])) return fail('Retained snapshot differs from observed mutations');
  if (!mutation || mutation.testSha256 !== sha(testBytes) || mutation.fixedSha256 !== sha(after['limit.mjs']) || mutation.bugSha256 !== sha(bug)) return no('Missing or mismatched candidate-bound mutation receipt');
  if (!mutation.fixed?.body || !mutation.restored?.body) return no('Missing independent mutation result bodies');
  if (mutation.fixed.status !== 0 || outcome(mutation.fixed.body, false) !== 'green') return no('Independent candidate suite did not succeed');
  if (mutation.restored.status === 0) return fail('Retained tests still pass with original bug restored');
  if (mutation.restored.status !== 1 || outcome(mutation.restored.body, true) !== 'red') return no('Restored bug did not produce meaningful assertion failure');
  return { status: 'PASS', testSha256: sha(testBytes), fixedSha256: sha(after['limit.mjs']), bugSha256: sha(bug), scope: 'Execution order and retained rejection-of-4 regression only; not final prose or full QUAL-1 acceptance' };
}
