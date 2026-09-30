import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = join(root, 'evals/requirement-fidelity/evidence');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Saved .principal files have their own ignore rules. The committed aliases must
// independently preserve the actual captured bytes, not reconstruct a write call.
test('captured plans and reports have portable, hash-verified evidence aliases', () => {
  const entries = JSON.parse(readFileSync(join(evidence, 'captured-artifacts.json'), 'utf8'));
  assert.ok(entries.length >= 10, 'retain each captured plan/report snapshot');
  assert.ok(entries.some(e => e.original.endsWith('/plans/reservoir.md')));
  assert.ok(entries.some(e => e.original.endsWith('/reports/limit-build.md')));
  const paths = new Set();
  for (const entry of entries) {
    assert.ok(!isAbsolute(entry.artifact));
    const path = resolve(evidence, entry.artifact);
    assert.ok(!relative(evidence, path).startsWith('..'));
    assert.ok(!entry.artifact.split('/').includes('.principal'));
    assert.ok(!paths.has(path));
    paths.add(path);
    assert.equal(digest(readFileSync(path)), entry.sha256, entry.artifact);
  }
});

test('provider failures remain ERROR even when Pi exits zero', () => {
  const runs = readdirSync(join(evidence, 'direct-pi-spark'), { withFileTypes: true })
    .filter(e => e.isDirectory());
  assert.equal(runs.length, 18);
  for (const run of runs) {
    const path = join(evidence, 'direct-pi-spark', run.name);
    const meta = JSON.parse(readFileSync(join(path, 'invocation.json'), 'utf8'));
    const events = readFileSync(join(path, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const errors = events.filter(e => e.type === 'message_end' && e.message?.role === 'assistant' && e.message.stopReason === 'error');
    assert.ok(errors.length > 0, run.name);
    assert.equal(meta.subject_status, 'ERROR');
    assert.deepEqual(meta.subject_errors, errors.map(e => e.message.errorMessage));
    assert.deepEqual(meta.before, meta.after, 'no implementation on provider error');
  }
});

test('normal-loading receipts include successful original skill-body reads', () => {
  for (const id of ['F04-plan-skill', 'F16-investigate-skill']) {
    const path = join(evidence, 'direct-pi-loading', id);
    const meta = JSON.parse(readFileSync(join(path, 'invocation.json'), 'utf8'));
    assert.ok(meta.command.includes('--skill'));
    assert.ok(!meta.command.includes('--append-system-prompt'));
    const events = readFileSync(join(path, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const reads = events.filter(e => e.type === 'tool_execution_start' && e.toolName === 'read' && e.args?.path?.endsWith('/SKILL.md'));
    assert.ok(reads.length > 0, id);
    for (const call of reads) {
      const result = events.find(e => e.type === 'tool_execution_end' && e.toolCallId === call.toolCallId);
      assert.ok(result && !result.isError, 'successful body read retained');
      assert.ok(JSON.stringify(result.result).includes('# '), 'actual body, not a hash-only receipt');
    }
  }
});
