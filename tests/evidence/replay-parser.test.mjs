import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../../evals/requirement-fidelity/evidence/pr58-repairs/replay-workflows.py', import.meta.url));
const python = spawnSync('python3', ['--version']);
const optionalPython = { skip: python.error?.code === 'ENOENT' ? 'python3 is absent; optional replay helper unavailable' : false };
const reply = { type: 'message_end', message: { role: 'assistant', stopReason: 'stop', content: [{ type: 'text', text: 'Done.' }] } };
const end = { type: 'agent_end' };
const startTool = { type: 'tool_execution_start', toolCallId: 'unfinished', toolName: 'bash', args: { command: 'npm test' } };
const endTool = { type: 'tool_execution_end', toolCallId: 'unfinished', toolName: 'bash', result: {}, isError: false };

for (const [name, events] of [
  ['end before reply', [end, reply]],
  ['unfinished activity after end', [reply, end, startTool]],
  ['duplicate agent end', [reply, end, end]],
  ['unfinished tool before terminal end', [startTool, reply, end]],
  ['tool end without start', [endTool, reply, end]],
  ['duplicate tool start', [startTool, startTool, endTool, reply, end]],
  ['duplicate tool end', [startTool, endTool, endTool, reply, end]],
  ['mismatched tool end', [startTool, { ...endTool, toolName: 'write' }, reply, end]],
  ['tool update without start', [{ ...startTool, type: 'tool_execution_update' }, reply, end]],
  ['settled before end', [reply, { type: 'agent_settled' }, end]],
  ['duplicate settled', [reply, end, { type: 'agent_settled' }, { type: 'agent_settled' }]],
  ['duplicate agent start', [{ type: 'agent_start' }, { type: 'agent_start' }, reply, end]],
  ['late agent start', [reply, { type: 'agent_start' }, end]],
  ['unclosed turn', [{ type: 'turn_start' }, reply, end]],
  ['turn end without start', [reply, { type: 'turn_end' }, end]],
  ['duplicate turn start', [{ type: 'turn_start' }, { type: 'turn_start' }, reply, { type: 'turn_end' }, end]],
  ['duplicate turn end', [{ type: 'turn_start' }, reply, { type: 'turn_end' }, { type: 'turn_end' }, end]],
  ['unfinished message', [reply, { type: 'message_start', message: reply.message }, end]],
  ['inconsistent terminal assistant', [reply, { ...end, messages: [{ ...reply.message, stopReason: 'toolUse' }] }]],
  ['retry still pending', [reply, { ...end, willRetry: true }]],
  ['missing completed assistant', [end]],
  ['unfinished assistant', [{ ...reply, message: { ...reply.message, stopReason: 'pending' } }, end]],
  ['activity after settled', [reply, end, { type: 'agent_settled' }, reply]],
]) test(`optional replay rejects ${name} and preserves the raw stream`, optionalPython, () => {
  const probe = spawnSync('python3', ['-B', '-c', `
import importlib.util, pathlib, sys, tempfile
spec = importlib.util.spec_from_file_location('replay', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
raw = sys.stdin.buffer.read()
with tempfile.TemporaryDirectory(prefix='replay-parser-') as directory:
    path = pathlib.Path(directory) / 'events.jsonl'
    path.write_bytes(raw)
    try:
        module.parse_events(path)
    except ValueError as error:
        assert str(path) in str(error), str(error)
        assert 'retained' in str(error), str(error)
    else:
        raise AssertionError('corrupt lifecycle was silently accepted')
    assert path.read_bytes() == raw, 'failure must preserve raw bytes'
`, helper], { input: events.map(e => JSON.stringify(e)).join('\n') + '\n', encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stdout + probe.stderr);
});

// Recovery is deliberately outside this collector's single-low-level-run subset.
for (const kind of [
  'compaction_start', 'compaction_end', 'auto_retry_start', 'auto_retry_end',
  'summarization_retry_scheduled', 'summarization_retry_attempt_start', 'summarization_retry_finished',
]) for (const boundary of ['parser', 'turn']) test(`optional replay rejects unsupported ${kind} at ${boundary}`, optionalPython, () => {
  const probe = spawnSync('python3', ['-B', '-c', `
import importlib.util, pathlib, subprocess, sys, tempfile
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('replay', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.root = pathlib.Path(sys.argv[1]).parents[4]
raw = sys.stdin.buffer.read()
kind, boundary = sys.argv[2:]
with tempfile.TemporaryDirectory(prefix='replay-unsupported-') as directory:
    saved = pathlib.Path(directory) / 'capture'
    saved.mkdir()
    ws = pathlib.Path(directory) / 'workspace'
    ws.mkdir()
    (ws / 'keep.txt').write_bytes(b'caller workspace must survive\\n')
    before = module.hashes(ws)
    path = saved / 'events.jsonl' if boundary == 'parser' else saved / 'turn-1/events.jsonl'
    def process(args, *, cwd, stdout, stderr, timeout):
        assert args[0] == 'pi' and cwd == ws
        stdout.write(raw.decode())
        stderr.write('retained process diagnostic\\n')
        return subprocess.CompletedProcess(args, 0)
    if boundary == 'parser':
        path.write_bytes(raw)
    with patch.object(module.subprocess, 'run', side_effect=process) as run, patch.object(module.subprocess, 'check_output', return_value=''):
        try:
            if boundary == 'parser':
                module.parse_events(path)
            else:
                module.turn(saved, ws, 1, 'offline lifecycle regression')
        except ValueError as error:
            assert str(path) in str(error) and 'retained' in str(error), str(error)
            assert 'unsupported' in str(error) and kind in str(error), str(error)
        else:
            raise AssertionError('unsupported lifecycle silently accepted at ' + boundary)
        assert run.call_count == (1 if boundary == 'turn' else 0)
    assert path.read_bytes() == raw, 'raw bytes changed'
    assert module.hashes(ws) == before, 'workspace changed'
    if boundary == 'turn':
        assert (path.parent / 'stderr.txt').read_text() == 'retained process diagnostic\\n'
        for artifact in ('final.txt', 'invocation.json', 'artifacts.json'):
            assert not (path.parent / artifact).exists(), artifact + ' must not record success'
`, helper, kind, boundary], {
    input: [reply, { type: kind, reason: 'threshold' }, end].map(e => JSON.stringify(e)).join('\n') + '\n',
    encoding: 'utf8',
  });
  assert.equal(probe.status, 0, probe.stdout + probe.stderr);
});

test('optional replay accepts genuine archived full streams including per-tool turns', optionalPython, () => {
  const probe = spawnSync('python3', ['-B', '-c', `
import importlib.util, json, pathlib, sys, tempfile
spec = importlib.util.spec_from_file_location('replay', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
archive = pathlib.Path(sys.argv[1]).parent.parent
# Explicit reviewed samples, not an eligibility rule for future retained captures.
# Normal text, multi-tool/update turns, provider error, and approval workflow.
samples = [
    'direct-pi-primary/F19-architect-missing-skill/events.jsonl',
    'direct-pi-chain/03-build/events.jsonl',
    'direct-pi-spark/F02-plan-agent-rep1/events.jsonl',
    'pr58-repairs/workflows/approval-gated-bugfix/turn-2/events.jsonl',
]
for sample in samples:
    path = archive / sample
    raw = path.read_bytes()
    events = module.parse_events(path)
    assert events == [json.loads(line) for line in raw.decode().split('\\n') if line], path
    assert path.read_bytes() == raw, path
    print(path)
# Derive an incomplete capture without altering the original or caller archive.
source = archive / samples[0]
original = source.read_bytes()
lines = original.splitlines(keepends=True)
cut = next(i for i, line in enumerate(lines) if json.loads(line)['type'] == 'agent_end')
incomplete = b''.join(lines[:cut])
with tempfile.TemporaryDirectory(prefix='replay-retained-incomplete-') as directory:
    path = pathlib.Path(directory) / 'events.jsonl'
    path.write_bytes(incomplete)
    try:
        module.parse_events(path)
    except ValueError as error:
        assert str(path) in str(error) and 'incomplete' in str(error), str(error)
    else:
        raise AssertionError('derived incomplete capture accepted')
    assert path.read_bytes() == incomplete, 'retained failure bytes changed'
assert source.read_bytes() == original, 'original capture changed'
print('Selected genuine archived streams accepted unchanged (not model qualification); derived incomplete capture rejected unchanged')
`, helper], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stdout + probe.stderr);
  assert.match(probe.stdout, /genuine archived streams accepted unchanged/);
  console.log(probe.stdout.trim());
});

test('optional Python replay fails closed on malformed and incomplete event streams', {
  skip: python.error?.code === 'ENOENT' ? 'python3 is absent; optional replay helper unavailable' : false,
}, () => {
  // Import only the parser: offline verification never invokes Pi or a paid model.
  const probe = spawnSync('python3', ['-B', '-c', `
import importlib.util, json, pathlib, sys, tempfile
spec = importlib.util.spec_from_file_location('replay', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
reply = {'type': 'message_end', 'message': {'role': 'assistant', 'stopReason': 'stop', 'content': [{'type': 'text', 'text': 'Earlier success'}]}}
complete = json.dumps(reply) + '\\n' + json.dumps({'type': 'agent_end'}) + '\\n'
with tempfile.TemporaryDirectory(prefix='pr58-parser-') as directory:
    path = pathlib.Path(directory) / 'events.jsonl'
    path.write_text(complete)
    assert len(module.parse_events(path)) == 2
    bad = [
        ('malformed-tail', complete + '{"type":"message_end",broken\\n', 'line 3'),
        ('malformed-middle', json.dumps(reply) + '\\nBROKEN\\n' + json.dumps({'type':'agent_end'}) + '\\n', 'line 2'),
        ('incomplete', json.dumps(reply) + '\\n', 'incomplete'),
    ]
    for name, content, diagnostic in bad:
        path.write_text(content)
        try:
            module.parse_events(path)
        except ValueError as error:
            assert str(path) in str(error), str(error)
            assert diagnostic in str(error), str(error)
        else:
            raise AssertionError(name + ': corrupt stream was silently accepted')
        assert path.read_text() == content, 'failure must preserve raw bytes'
print('valid stream accepted; malformed tail/middle and incomplete stream rejected')
`, helper], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stdout + probe.stderr);
  assert.match(probe.stdout, /malformed tail\/middle and incomplete stream rejected/);
});
