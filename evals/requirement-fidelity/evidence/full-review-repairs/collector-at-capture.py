#!/usr/bin/env python3
"""Opt-in, paid Pi reproduction of two PR58 workflow probes; not part of npm test.
Usage: python3 <this-file> <repository-root> <NEW-output-directory>
Runs real slash templates with no extension tools: observes the documented inline fallback,
not delegated transport. Temporary working directories are NOT OS sandboxes.
"""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

def parse_events(path):
    # One invocation/run, with any number of assistant/tool turns. This is a
    # lifecycle gate, not validation of provider metadata or tool-result payloads.
    events = []
    ended = settled = started = in_turn = turns_seen = False
    open_message = last_assistant = turn_assistant = None
    pending_tools, seen_tools = {}, set()

    def reject(reason):
        raise ValueError(f'{path}: {reason}; raw stream and workspace retained')

    def same_reply(message):
        return isinstance(message, dict) and last_assistant is not None and all(
            message.get(key) == last_assistant.get(key) for key in ('role', 'stopReason', 'content'))

    for number, line in enumerate(path.read_text().splitlines(), 1):
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f'{path}: malformed JSON at line {number}; raw stream and workspace retained') from error
        if not isinstance(event, dict) or not isinstance(event.get('type'), str):
            raise ValueError(f'{path}: invalid event at line {number}; raw stream and workspace retained')
        kind = event['type']
        if ended:
            # Current full Pi streams append this marker; older/minimal records
            # can end at agent_end. No new activity or duplicate markers qualify.
            if kind != 'agent_settled' or settled:
                reject(f'unexpected {kind} after agent_end at line {number}')
            settled = True
        elif kind == 'agent_settled':
            reject('agent_settled before agent_end')
        elif kind == 'session':
            if events:
                reject('out-of-order or duplicate session header')
        elif kind == 'agent_start':
            if started or any(e['type'] != 'session' for e in events):
                reject('out-of-order or duplicate agent_start')
            started = True
        elif kind == 'turn_start':
            if in_turn or open_message is not None or pending_tools:
                reject('turn_start before preceding activity completed')
            in_turn = turns_seen = True
            turn_assistant = None
        elif kind == 'turn_end':
            if not in_turn or open_message is not None or pending_tools or turn_assistant is None:
                reject('out-of-order turn_end or outstanding activity')
            if 'message' in event and not same_reply(event['message']):
                reject('turn_end disagrees with completed assistant')
            in_turn = False
        elif kind == 'agent_end':
            if in_turn or open_message is not None or pending_tools:
                reject('agent_end with outstanding activity')
            if last_assistant is None or last_assistant.get('stopReason') not in ('stop', 'length', 'error', 'aborted', 'deferred'):
                reject('agent_end without a terminal assistant message')
            if event.get('willRetry'):
                reject('agent_end with retry pending')
            if 'messages' in event:
                messages = event['messages']
                if not isinstance(messages, list) or any(not isinstance(m, dict) for m in messages):
                    reject('invalid agent_end messages')
                assistants = [m for m in messages if m.get('role') == 'assistant']
                if not assistants or not same_reply(assistants[-1]):
                    reject('agent_end disagrees with completed assistant')
            ended = True
        elif kind in ('message_start', 'message_update', 'message_end'):
            if turns_seen and not in_turn:
                reject('message activity outside turn')
            if kind == 'message_update':
                if open_message != 'assistant':
                    reject('message_update without an open assistant message')
            else:
                message = event.get('message')
                if not isinstance(message, dict) or not isinstance(message.get('role'), str):
                    reject(f'invalid {kind} message')
                if kind == 'message_start':
                    if open_message is not None:
                        reject('message_start before preceding message completed')
                    open_message = message['role']
                else:
                    if open_message is not None and open_message != message['role']:
                        reject('message_end role differs from open message')
                    open_message = None
                    if message['role'] == 'assistant':
                        last_assistant = turn_assistant = message
        elif kind in ('tool_execution_start', 'tool_execution_update', 'tool_execution_end'):
            if turns_seen and not in_turn:
                reject('tool activity outside turn')
            call_id, name = event.get('toolCallId'), event.get('toolName')
            if not isinstance(call_id, str) or not call_id or not isinstance(name, str) or not name:
                reject('invalid tool execution identity')
            if kind == 'tool_execution_start':
                if call_id in seen_tools:
                    reject('duplicate tool_execution_start')
                seen_tools.add(call_id)
                pending_tools[call_id] = name
            else:
                if pending_tools.get(call_id) != name:
                    reject(f'unpaired or mismatched {kind}')
                if kind == 'tool_execution_end':
                    del pending_tools[call_id]
        events.append(event)
    if not ended:
        reject('incomplete event stream (no agent_end)')
    return events


def command(args, cwd):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob('*') if p.is_file() and '.git' not in p.relative_to(directory).parts}


def setup(name, fixture):
    saved = out / name
    saved.mkdir()
    ws = pathlib.Path(tempfile.mkdtemp(prefix='pr58-workflow-'))
    shutil.copytree(root / 'evals/requirement-fidelity/fixtures' / fixture, ws, dirs_exist_ok=True)
    shutil.rmtree(ws / '.principal', ignore_errors=True)
    if fixture == 'basic':
        (ws / 'limit.mjs').write_text('export function permit(count) { return Number.isInteger(count) && count >= 0 && count <= 3; }\n')
    command(['git', 'init', '-b', 'main'], ws)
    command(['git', 'config', 'user.name', 'Disposable workflow probe'], ws)
    command(['git', 'config', 'user.email', 'probe@example.invalid'], ws)
    command(['git', 'add', '.'], ws)
    command(['git', 'commit', '-m', 'Fixture baseline'], ws)
    command(['git', 'switch', '-c', 'probe-candidate'], ws)
    if fixture == 'basic':
        shutil.copyfile(root / 'evals/requirement-fidelity/fixtures/basic/limit.mjs', ws / 'limit.mjs')
        command(['git', 'add', 'limit.mjs'], ws)
        command(['git', 'commit', '-m', 'Fixture candidate with LIMIT-1 boundary defect'], ws)
    shutil.copytree(ws, saved / 'initial', ignore=shutil.ignore_patterns('.git'))
    (saved / 'setup.json').write_text(json.dumps({'workspace': str(ws), 'fixture': fixture,
        'base': command(['git', 'rev-parse', 'main'], ws), 'head': command(['git', 'rev-parse', 'HEAD'], ws),
        'initial_status': command(['git', 'status', '--porcelain'], ws), 'initial_hashes': hashes(ws)}, indent=2) + '\n')
    return saved, ws


def turn(saved, ws, number, prompt):
    dest = saved / f'turn-{number}'
    dest.mkdir()
    args = ['pi', '--provider', 'openai-codex', '--model', 'gpt-5.5', '--thinking', 'medium',
            '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-context-files', '--no-approve',
            '--tools', 'read,grep,find,ls,edit,write,bash']
    resources = [root / 'bootstrap/BOOTSTRAP.md']
    for skill in ['plan', 'build', 'debug', 'review', 'investigate', 'git-ops']:
        path = root / skill / 'SKILL.md'
        args += ['--skill', str(path)]
        resources.append(path)
    for template in ['principal-review-branch', 'principal-bugfix']:
        path = root / 'prompts' / f'{template}.md'
        args += ['--prompt-template', str(path)]
        resources.append(path)
    args += ['--append-system-prompt', str(root / 'bootstrap/BOOTSTRAP.md'),
             '--mode', 'json', '--session', str(saved / 'session.jsonl'), prompt]
    before = hashes(ws)
    with (dest / 'events.jsonl').open('w') as stdout, (dest / 'stderr.txt').open('w') as stderr:
        result = subprocess.run(args, cwd=ws, stdout=stdout, stderr=stderr, timeout=900)
    events = parse_events(dest / 'events.jsonl')
    messages = [e['message'] for e in events if e.get('type') == 'message_end' and e.get('message', {}).get('role') == 'assistant']
    errors = [m.get('errorMessage') or m['stopReason'] for m in messages if m.get('stopReason') in ('error', 'aborted')]
    if messages and messages[-1].get('stopReason') != 'stop':
        errors.append('last assistant message did not complete normally')
    final = '\n'.join(c['text'] for c in messages[-1]['content'] if c.get('type') == 'text') if messages else ''
    (dest / 'final.txt').write_text(final + '\n')
    (dest / 'invocation.json').write_text(json.dumps({'command': args, 'exit_code': result.returncode,
        'subject_errors': errors, 'resources': {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in resources},
        'before': before, 'after': hashes(ws), 'status': command(['git', 'status', '--porcelain'], ws),
        'head_after': command(['git', 'rev-parse', 'HEAD'], ws)}, indent=2) + '\n')
    shutil.copytree(ws, dest / 'workspace', ignore=shutil.ignore_patterns('.git'))
    artifacts = []
    for p in (ws / '.principal').rglob('*') if (ws / '.principal').exists() else []:
        if not p.is_file():
            continue
        rel = p.relative_to(ws / '.principal')
        alias = dest / 'saved-artifacts' / ('ignore-rule.txt' if rel == pathlib.Path('.gitignore') else rel)
        alias.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, alias)
        artifacts.append({'original': str(p.relative_to(ws)), 'artifact': str(alias.relative_to(dest)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
    (dest / 'artifacts.json').write_text(json.dumps(artifacts, indent=2) + '\n')
    print(saved.name, number, result.returncode, errors, final, flush=True)
    if result.returncode or errors or not final:
        raise SystemExit('Subject/infrastructure failure; temporary workspace retained')


if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1]).resolve()
    out = pathlib.Path(sys.argv[2]).resolve()
    out.mkdir(parents=True, exist_ok=False)  # Do not overwrite prior observations.
    saved, ws = setup('repeated-branch-review', 'basic')
    for number in (1, 2):
        turn(saved, ws, number, '/principal-review-branch main')
    shutil.rmtree(ws)
    saved, ws = setup('approval-gated-bugfix', 'debug')
    turn(saved, ws, 1, '/principal-bugfix parseCount accepts 3x contrary to SPEC.md; use inline Build only after my approval. No multi-step plan. No commit, push, tag or release. Review SPEC.md as original authority and retain complete reports. Keep this branch.')
    turn(saved, ws, 2, 'Approved: implement the diagnosed PARSE-1 fix with failing boundary tests first, then Review under the workflow already invoked. Keep this branch. No commit, push, tag or release. Preserve original authority, baseline, reports and any unverified gates.')
    shutil.rmtree(ws)
