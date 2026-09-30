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
    events = []
    for number, line in enumerate(path.read_text().splitlines(), 1):
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f'{path}: malformed JSON at line {number}; raw stream and workspace retained') from error
        if not isinstance(event, dict) or not isinstance(event.get('type'), str):
            raise ValueError(f'{path}: invalid event at line {number}; raw stream and workspace retained')
        events.append(event)
    if not any(event['type'] == 'agent_end' for event in events):
        raise ValueError(f'{path}: incomplete event stream (no agent_end); raw stream and workspace retained')
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
