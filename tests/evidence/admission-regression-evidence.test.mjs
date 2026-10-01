import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { auditAdmissionRegression } from '../../evals/requirement-fidelity/oracles/admission-regression-evidence.mjs';

const fixture = new URL('../../evals/requirement-fidelity/fixtures/basic/', import.meta.url);
const names = ['SPEC.md', 'definitions.md', 'package.json', 'limit.mjs', 'limit.test.mjs'];
const before = Object.fromEntries(names.map(p => [p, readFileSync(new URL(p, fixture), 'utf8')]));
const sha = text => createHash('sha256').update(text).digest('hex');
const useful = before['limit.test.mjs'] + "test('rejects upper boundary', () => assert.equal(permit(4), false));\n";
const after = { ...before, 'limit.mjs': before['limit.mjs'].replace('<= 4', '<= 3'), 'limit.test.mjs': useful };
// Trusted fixture copies only. These are offline derived inputs, never model runs.
function run(files) {
  const dir = mkdtempSync(join(tmpdir(), 'admission-audit-'));
  try {
    for (const [path, bytes] of Object.entries(files)) writeFileSync(join(dir, path), bytes);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap'], { cwd: dir, encoding: 'utf8', env });
    if (result.error) throw result.error;
    return { status: result.status, body: result.stdout + result.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const baseline = run(before), red = run({ ...before, 'limit.test.mjs': useful }), green = run(after);
const receipt = { testSha256: sha(useful), fixedSha256: sha(after['limit.mjs']), bugSha256: sha(before['limit.mjs']), fixed: green, restored: red };
const call = (id, name, args) => ({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'toolCall', id, name, arguments: args }] } });
const result = (id, name, r) => ({ type: 'message_end', message: { role: 'toolResult', toolCallId: id, toolName: name, isError: r.status !== 0, content: [{ type: 'text', text: r.body }] } });
function pair(id, name, args, r = { status: 0, body: 'Successfully wrote file' }) { return [call(id, name, args), result(id, name, r)]; }
function input() {
  return { before, after, mutation: receipt, events: [
    ...names.flatMap(p => pair(p, 'read', { path: p }, { status: 0, body: before[p] })),
    ...pair('baseline', 'bash', { command: 'npm test' }, baseline),
    ...pair('test', 'write', { path: 'limit.test.mjs', content: useful }),
    ...pair('red', 'bash', { command: 'npm test' }, red),
    ...pair('fix', 'write', { path: 'limit.mjs', content: after['limit.mjs'] }),
    ...pair('green', 'bash', { command: 'npm test' }, green)
  ] };
}
function remove(x, id) { x.events = x.events.filter(e => e.message.toolCallId !== id && e.message.content?.[0]?.id !== id); }
function replaceResult(x, id, r) { x.events[x.events.findIndex(e => e.message.toolCallId === id)] = result(id, 'bash', r); }

test('ordered successful baseline, assertion red, fix and bound retained mutation evidence qualify', () => {
  const audited = auditAdmissionRegression(input());
  assert.equal(audited.status, 'PASS', JSON.stringify(audited));
});
test('full event stream permits system and user string messages', () => {
  const x = input();
  x.events.unshift({ type: 'message_end', message: { role: 'system', content: '' } },
    { type: 'message_end', message: { role: 'user', content: 'Fix admission' } });
  assert.equal(auditAdmissionRegression(x).status, 'PASS');
});

test('visible regression criterion assigns baseline execution to trace, not a report field', () => {
  const spec = JSON.parse(readFileSync(new URL('../../build/tests/specification.yaml', import.meta.url), 'utf8'));
  const scenario = spec.scenarios.find(s => s.title === 'A real admission bug earns a lasting boundary regression');
  assert.match(scenario.checklist[1], /Baseline execution and ordering belong to actual trace evidence, not an additional final-report field/);
});

for (const [name, change] of [
  ['missing baseline', x => remove(x, 'baseline')],
  ['failed baseline', x => replaceResult(x, 'baseline', red)],
  ['no failing regression', x => replaceResult(x, 'red', green)],
  ['no green result', x => replaceResult(x, 'green', red)],
  ['empty result body', x => replaceResult(x, 'baseline', { status: 0, body: '' })],
  ['runtime failure is not regression', x => replaceResult(x, 'red', { status: 1, body: 'SyntaxError: unexpected token\n# tests 1\n# pass 0\n# fail 1' })],
  ['fix before test', x => { const fix = x.events.splice(16, 2); x.events.splice(12, 0, ...fix); }],
  ['fix before red completes', x => { const fix = x.events.splice(16, 2); x.events.splice(15, 0, ...fix); }],
  ['test removed after green', x => { x.events.push(...pair('remove', 'write', { path: 'limit.test.mjs', content: before['limit.test.mjs'] })); x.after = { ...after, 'limit.test.mjs': before['limit.test.mjs'] }; }],
  ['unbound mutation receipt', x => { x.mutation = { ...receipt, testSha256: sha('different') }; }],
  ['unknown shell mutation cannot be skipped', x => x.events.push(...pair('unknown', 'bash', { command: 'python3 change.py' }))],
  ['source mutation', x => x.events.push(...pair('source', 'write', { path: 'SPEC.md', content: 'changed' }))]
]) test(name + ' cannot qualify', () => { const x = input(); change(x); assert.notEqual(auditAdmissionRegression(x).status, 'PASS'); });

for (const [name, change] of [
  ['unpaired call', x => x.events.pop()],
  ['duplicate result', x => x.events.push(x.events.at(-1))],
  ['duplicate call', x => x.events.push(x.events[0])],
  ['result before call', x => { [x.events[0], x.events[1]] = [x.events[1], x.events[0]]; }],
  ['malformed message', x => x.events.push({ type: 'message_end' })],
  ['malformed event among valid events', x => x.events.push({})],
  ['hash-only records instead of events', x => { x.events = [{ schema: 2, tool: 'bash', resultHash: sha(green.body) }]; }]
]) test(name + ' fails visibly', () => { const x = input(); change(x); assert.throws(() => auditAdmissionRegression(x), /event|call|result|message/i); });

test('source result after mutation invocation cannot qualify even before mutation result', () => {
  const x = input();
  assert.equal(auditAdmissionRegression(x).status, 'PASS');
  const sourceResult = x.events.splice(1, 1)[0];
  x.events.splice(12, 0, sourceResult);
  assert.notEqual(auditAdmissionRegression(x).status, 'PASS');
});

for (const path of names) {
  test(`${path} must finish a qualifying read before mutation invocation`, () => {
    const x = input();
    const end = x.events.splice(x.events.findIndex(e => e.message.toolCallId === path), 1)[0];
    x.events.splice(12, 0, end);
    assert.notEqual(auditAdmissionRegression(x).status, 'PASS');
  });
  test(`${path} later unnecessary re-read preserves an earlier qualifying completion`, () => {
    const x = input();
    x.events.splice(13, 0, ...pair('again', 'read', { path }, { status: 0, body: before[path] }));
    assert.equal(auditAdmissionRegression(x).status, 'PASS');
  });
}

for (const [name, change] of [
  ['missing source read', x => remove(x, 'SPEC.md')],
  ['partial source read', x => { x.events[1].message.content[0].text = before['SPEC.md'].slice(0, 20); }],
  ['failed full source read', x => { x.events[1].message.isError = true; }],
  ['unknown read path', x => { x.events[0].message.content[0].arguments.path = 'unknown.md'; }]
]) test(name + ' cannot establish source authority', () => {
  const x = input(); change(x);
  assert.notEqual(auditAdmissionRegression(x).status, 'PASS');
});

test('additional post-green coverage needs manual verification, not a false execution violation', () => {
  const x = input();
  const extended = useful + "test('another accepted value', () => assert.equal(permit(2), true));\n";
  x.events.push(...pair('extend', 'write', { path: 'limit.test.mjs', content: extended }));
  x.after = { ...after, 'limit.test.mjs': extended };
  assert.equal(auditAdmissionRegression(x).status, 'UNVERIFIED');
});

test('ineffective retained tests with real restored-bug success cannot qualify', () => {
  const weak = before['limit.test.mjs'] + "test('another happy path', () => assert.equal(permit(1), true));\n";
  const x = input();
  x.events[12].message.content[0].arguments.content = weak;
  x.after = { ...after, 'limit.test.mjs': weak };
  x.mutation = { ...receipt, testSha256: sha(weak), fixed: run(x.after), restored: run({ ...before, 'limit.test.mjs': weak }) };
  assert.equal(x.mutation.restored.status, 0);
  assert.notEqual(auditAdmissionRegression(x).status, 'PASS');
});
