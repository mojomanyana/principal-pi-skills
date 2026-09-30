import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../../evals/requirement-fidelity/evidence/pr58-repairs/replay-workflows.py', import.meta.url));
const python = spawnSync('python3', ['--version']);

test('PR58 optional Python replay fails closed on malformed and incomplete event streams', {
  skip: python.error?.code === 'ENOENT' ? 'python3 is absent; optional replay helper unavailable' : false,
}, () => {
  // Import only the parser: never invoke Pi or a paid model from npm test.
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
