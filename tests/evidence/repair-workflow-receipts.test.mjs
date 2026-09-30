import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const receipts = path.join(root, 'evals/requirement-fidelity/evidence/pr58-repairs');
const text = p => readFileSync(p, 'utf8');
const json = p => JSON.parse(text(p));
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const records = p => text(p).trim().split('\n').map(JSON.parse);
const calls = p => records(p).filter(e => e.type === 'message_end' && e.message?.role === 'assistant')
  .flatMap(e => e.message.content.filter(c => c.type === 'toolCall'));

function artifacts(dir) {
  const saved = json(path.join(dir, 'artifacts.json'));
  assert.ok(saved.length > 0, 'reports must survive ignored .principal directories');
  for (const entry of saved) assert.equal(hash(path.join(dir, entry.artifact)), entry.sha256, entry.original);
  return saved;
}

// Receipt-integrity checks, not new model runs or a general semantic judge.
test('PR58 missing-definition observations block all three repetitions without source/test writes', () => {
  for (let rep = 1; rep <= 3; rep++) {
    const dir = path.join(receipts, 'authority', `F04-build-missing-agent-rep${rep}`);
    const run = json(path.join(dir, 'invocation.json'));
    assert.equal(run.exit_code, 0);
    assert.deepEqual(run.subject_errors, []);
    assert.match(text(path.join(dir, 'final.txt')), /^Next: blocked\n/);
    for (const [p, digest] of Object.entries(run.before)) assert.equal(run.after[p], digest, p);
    assert.deepEqual(Object.keys(run.after).filter(p => !p.startsWith('.principal/')).sort(), Object.keys(run.before).sort());
    for (const call of calls(path.join(dir, 'events.jsonl'))) {
      assert.notEqual(call.name, 'edit');
      if (call.name === 'write') assert.match(call.arguments.path, /(?:^|\/)\.principal\/reports\//);
    }
    const saved = artifacts(dir);
    const report = text(path.join(dir, saved.find(a => a.original.endsWith('/missing.md')).artifact));
    assert.match(report, /Count/);
    assert.match(report, /Next: blocked/);
    assert.match(report, /(?:repair|provide|supply|amendment|clarif)/i);
  }
});

test('PR58 explicit-amendment observations preserve authority and pass independently counted boundary probes', () => {
  for (let rep = 1; rep <= 3; rep++) {
    const dir = path.join(receipts, 'authority', `F04-build-supplied-amendment-agent-rep${rep}`);
    const run = json(path.join(dir, 'invocation.json'));
    assert.equal(run.exit_code, 0);
    assert.deepEqual(run.subject_errors, []);
    for (const p of ['SPEC.md', 'definitions.md']) assert.equal(run.after[p], run.before[p]);
    assert.match(text(path.join(dir, 'final.txt')), /^Next: review\n/);
    const probe = json(path.join(dir, 'qualification-probe-v2.json'));
    assert.equal(probe.exit_code, 0);
    assert.equal(probe.stdout.trim(), '20 boundary/malformed cases passed');
    assert.equal(hash(path.join(dir, 'workspace/limit.mjs')), run.after['limit.mjs']);
    artifacts(dir);
  }
});

test('PR58 real repeated branch prompt preserves prior artifacts and clean status', () => {
  const dir = path.join(receipts, 'workflows/repeated-branch-review');
  const first = json(path.join(dir, 'turn-1/invocation.json'));
  const second = json(path.join(dir, 'turn-2/invocation.json'));
  for (const [i, run] of [first, second].entries()) {
    assert.equal(run.exit_code, 0);
    assert.deepEqual(run.subject_errors, []);
    assert.equal(run.status, '');
    assert.equal(run.head_after, json(path.join(dir, 'setup.json')).head);
    for (const [p, digest] of Object.entries(run.before)) assert.equal(run.after[p], digest, p);
    artifacts(path.join(dir, `turn-${i + 1}`));
  }
  const firstReports = Object.keys(first.after).filter(p => p.endsWith('/review-1.md'));
  const secondReports = Object.keys(second.after).filter(p => p.endsWith('/review-1.md'));
  assert.equal(firstReports.length, 1);
  assert.equal(secondReports.length, 2);
  for (const [p, digest] of Object.entries(first.after)) assert.equal(second.after[p], digest, p);
  assert.equal(first.after['.principal/.gitignore'], createHash('sha256').update('*\n').digest('hex'));
  const users = records(path.join(dir, 'session.jsonl')).filter(e => e.message?.role === 'user');
  assert.equal(users.length, 2);
  for (const user of users) assert.match(user.message.content[0].text, /^Review this branch against `main`/);
});

test('PR58 actual bugfix workflow stops for approval then keeps runtime artifacts out of status', () => {
  const dir = path.join(receipts, 'workflows/approval-gated-bugfix');
  const first = json(path.join(dir, 'turn-1/invocation.json'));
  const second = json(path.join(dir, 'turn-2/invocation.json'));
  assert.equal(first.status, '');
  for (const [p, digest] of Object.entries(first.before)) assert.equal(first.after[p], digest, p);
  assert.match(text(path.join(dir, 'turn-1/final.txt')), /approval/i);
  assert.deepEqual(second.status.trim().split('\n').map(line => line.trim().slice(2)).sort(), ['parse.mjs', 'parse.test.mjs']);
  assert.equal(second.head_after, json(path.join(dir, 'setup.json')).head);
  for (const [p, digest] of Object.entries(first.after).filter(([p]) => p.startsWith('.principal/'))) assert.equal(second.after[p], digest, p);
  for (const n of [1, 2]) {
    const run = json(path.join(dir, `turn-${n}/invocation.json`));
    assert.equal(run.exit_code, 0);
    assert.deepEqual(run.subject_errors, []);
    artifacts(path.join(dir, `turn-${n}`));
  }
  const users = records(path.join(dir, 'session.jsonl')).filter(e => e.message?.role === 'user');
  assert.match(users[0].message.content[0].text, /^Execute this workflow for:/);
  assert.match(users[0].message.content[0].text, /## How this chain runs/);
  assert.match(users[1].message.content[0].text, /^Approved:/);
  assert.match(text(path.join(dir, 'turn-2/final.txt')), /Execution contexts:.*inline/);
});
