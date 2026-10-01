import datetime,hashlib,importlib.util,json,os,pathlib,shutil,signal,subprocess,sys,traceback
sys.dont_write_bytecode=True
root=pathlib.Path('/home/neman/Code/principal-pi-skills');out=pathlib.Path(__file__).resolve().parent
helper=out/'resources/evals/requirement-fidelity/evidence/pr58-repairs/replay-workflows.py'
s=importlib.util.spec_from_file_location('replay_capture_copy',helper);mod=importlib.util.module_from_spec(s);s.loader.exec_module(mod)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,v):p.write_text(json.dumps(v,indent=2)+'\n')
def cmd(args,cwd):
 r=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
 return {'command':args,'exit_code':r.returncode,'stdout':r.stdout.decode(errors='replace'),'stderr':r.stderr.decode(errors='replace')}
def state(ws):
 return {'stats':{str(p.relative_to(ws)):{'mode':p.stat().st_mode,'size':p.stat().st_size,'mtime_ns':p.stat().st_mtime_ns} for p in ws.rglob('*') if p.is_file()},'hashes':mod.hashes(ws),'git_hashes':{str(p.relative_to(ws)):sha(p) for p in (ws/'.git').rglob('*') if p.is_file()},'head':cmd(['git','rev-parse','HEAD'],ws),'status':cmd(['git','status','--porcelain=v1','--untracked-files=all'],ws),'ignored_status':cmd(['git','status','--porcelain=v1','--ignored','--untracked-files=all'],ws),'index':cmd(['git','ls-files','--stage'],ws),'nonignored_untracked':cmd(['git','ls-files','--others','--exclude-standard'],ws),'all_untracked':cmd(['git','ls-files','--others'],ws),'config':cmd(['git','config','--show-origin','--list'],ws),'identity':cmd(['git','show','-s','--format=fuller','HEAD'],ws),'branch':cmd(['git','symbolic-ref','HEAD'],ws)}
assert mod.command(['git','rev-parse','HEAD'],root)=='78ca09de4c80bf9d592ec811a1d6bebe53bb13f9'
assert set(mod.command(['git','diff','HEAD','--name-only'],root).splitlines()) == {'README.md','agents/principal-build.md','build/SKILL.md','contracts/build.md.tmpl','tests/unit/requirement-fidelity.test.mjs'}
assert sha(root/'build/SKILL.md')=='f84c8387c5f516c999b205c1af18923134c344ee1928312bbd2282776c952dcf'
assert sha(root/'agents/principal-build.md')=='1dd0c812a682b973096759ec707fc7c2329fbed0436631e9e29ac1fa28f31019'
spec=json.loads((root/'build/tests/specification.yaml').read_text())
ids=['F11-build-assigned-skill','F04-build-supplied-amendment-agent','F21-build-after-debug-skill']
env={**os.environ,'PI_CODING_AGENT_DIR':str(out/'private-agent'),'PI_OFFLINE':'1','PI_SKIP_VERSION_CHECK':'1','PI_TELEMETRY':'0','GIT_OPTIONAL_LOCKS':'0'}
save(out/'observer-start.json',{'parent':state(root),'original_PR_base':'0728b2daafa210c6884736ad48845d6549122a54','collector_sha256':sha(pathlib.Path(__file__)),'environment_overrides':{k:env[k] for k in ['PI_CODING_AGENT_DIR','PI_OFFLINE','PI_SKIP_VERSION_CHECK','PI_TELEMETRY','GIT_OPTIONAL_LOCKS']},'private_settings':json.loads((out/'private-agent/settings.json').read_text()),'versions':[cmd(a,root) for a in [['pi','--version'],['node','--version'],['npm','--version'],['git','--version']]],'scope':'Three explicit-body invocations only; no normal loading, delegation or harness regrade; not OS sandboxed'})
for caseid in ids:
 case=next(c for c in spec['scenarios'] if c['id']==caseid);dest=out/caseid;dest.mkdir()
 fixture=(root/'build/tests'/case['env']['workspace'].removeprefix('fixture:')).resolve()
 ws=dest/'live-workspace';shutil.copytree(fixture,ws)
 setup=[]
 for args in [['git','init','-b','observation-fixture'],['git','config','user.name','Disposable full-capture observer'],['git','config','user.email','observer@example.invalid'],['git','add','.'],['git','-c','commit.gpgsign=false','commit','-m','Pristine fixture baseline (observer setup)']]:
  r=cmd(args,ws);setup.append(r);assert r['exit_code']==0,r
 assert mod.hashes(ws)==mod.hashes(fixture)
 before=state(ws);head=before['head']['stdout'].strip();shutil.copytree(ws,dest/'before-workspace')
 contract=root/('agents/principal-build.md' if caseid.endswith('-agent') else 'build/SKILL.md')
 prompt=case['turns'][0];assert len(case['turns'])==1
 (dest/'prompt.txt').write_text(prompt)
 args=['pi','--provider','openai-codex','--model','gpt-5.5','--thinking','medium','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--no-approve','--tools','read,grep,find,ls,edit,write,bash','--append-system-prompt',str(contract),'--mode','json','--session',str(dest/'session.jsonl'),prompt]
 record={'case':case,'fixture':str(fixture),'fixture_hashes':mod.hashes(fixture),'setup':setup,'before':before,'command':args,'cwd':str(ws),'prompt':prompt,'parent_SHA':mod.command(['git','rev-parse','HEAD'],root),'contract':str(contract),'contract_sha256':sha(contract),'helper_sha256':sha(helper),'timeout_seconds':900,'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attempt':1}
 record['environment_overrides']={k:env[k] for k in ['PI_CODING_AGENT_DIR','PI_OFFLINE','PI_SKIP_VERSION_CHECK','PI_TELEMETRY','GIT_OPTIONAL_LOCKS']}
 save(dest/'invocation-start.json',record)
 p=None
 try:
  with (dest/'events.jsonl').open('wb') as stdout,(dest/'stderr.txt').open('wb') as stderr:
   p=subprocess.Popen(args,cwd=ws,env=env,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,start_new_session=True)
   save(dest/'process-start.json',{'pid':p.pid,'pgid':os.getpgid(p.pid),'processes':cmd(['ps','-eo','pid,ppid,pgid,sid,stat,etime,comm'],ws)})
   try:record['exit_code']=p.wait(timeout=900)
   except subprocess.TimeoutExpired:
    record['timeout']=True;save(dest/'process-timeout.json',cmd(['ps','-eo','pid,ppid,pgid,sid,stat,etime,comm'],ws));os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=5)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
    record['exit_code']=p.returncode
 except Exception:record['infrastructure_error']=traceback.format_exc()
 finally:
  save(dest/'process-after.json',{'pid':p.pid if p else None,'returncode':p.poll() if p else None,'processes':cmd(['ps','-eo','pid,ppid,pgid,sid,stat,etime,comm'],ws)})
  record['after']=state(ws);shutil.copytree(ws,dest/'after-workspace')
  diff=subprocess.run(['git','diff','--binary','--full-index',head,'--'],cwd=ws,capture_output=True)
  (dest/'candidate.diff').write_bytes(diff.stdout);(dest/'candidate-diff.stderr').write_bytes(diff.stderr);record['observer_diff_exit']=diff.returncode
  aliases=[]
  for f in (ws/'.principal').rglob('*') if (ws/'.principal').exists() else []:
   if f.is_file():
    alias=dest/'saved-artifacts'/f.relative_to(ws);alias.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,alias)
    aliases.append({'original':str(f.relative_to(ws)),'alias':str(alias.relative_to(dest)),'sha256':sha(f),'ignore_check':cmd(['git','check-ignore','-v','--',str(f.relative_to(ws))],ws)})
  save(dest/'artifacts.json',aliases)
  for rel in record['after']['all_untracked']['stdout'].splitlines():
   f=ws/rel
   if f.is_file() and '.principal' not in f.relative_to(ws).parts:
    target=dest/'untracked-bytes'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
  record['finished']=datetime.datetime.now(datetime.timezone.utc).isoformat();save(dest/'invocation.json',record)
 try:
  events=mod.parse_events(dest/'events.jsonl');record['parser']='accepted unchanged parse_events'
  msgs=[e['message'] for e in events if e.get('type')=='message_end' and e.get('message',{}).get('role')=='assistant']
  record['assistant_models']=sorted({(m.get('provider'),m.get('model'),m.get('providerThinkingLevel')) for m in msgs},key=str)
  record['subject_errors']=[m.get('errorMessage') or m.get('stopReason') for m in msgs if m.get('stopReason') in ['error','aborted']]
  record['last_stop_reason']=msgs[-1].get('stopReason') if msgs else None
  (dest/'final.txt').write_text('\n'.join(c['text'] for c in msgs[-1]['content'] if c.get('type')=='text')+'\n' if msgs else '')
  calls=[{'event_line':i+1,**e} for i,e in enumerate(events) if e.get('type') in ['tool_execution_start','tool_execution_end']]
  save(dest/'tool-events.json',calls)
 except Exception:record['parser_error']=traceback.format_exc()
 save(dest/'invocation.json',record)
 print(caseid,record.get('exit_code'),record.get('parser',record.get('parser_error')),flush=True)
save(out/'observer-after.json',{'parent':state(root),'attempts':3})
# Credentials are transport-only, not evidence: remove the private copy, never touch installed auth.
(out/'private-agent/auth.json').unlink()
