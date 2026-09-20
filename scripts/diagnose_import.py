"""Temporary preview-only import diagnostics. Never merge this deployment config to main."""
import contextlib
import io
import json
import os
import tarfile
import traceback
from pathlib import Path
import import_consider as work

out=work.ROOT/'import-diagnostic'
out.mkdir(exist_ok=True)
log=io.StringIO()
result={'status':'FAIL','commit':os.environ.get('VERCEL_GIT_COMMIT_SHA'),'diagnostic_only':True}
try:
    with contextlib.redirect_stdout(log):
        work.self_test()
        work.fetch_sources()
        work.verify_and_compile()
    result['status']='PASS'
except Exception as exc:
    result['error']=str(exc)
    result['traceback']=traceback.format_exc()
result['log_tail']=log.getvalue()[-6000:]
manifest=work.DEST/'source-manifest.json'
if manifest.exists():
    result['manifest']=json.loads(manifest.read_text())
    result['nodes']=[]
    result['parse_errors']=[]
    for file in sorted((work.DEST/'source').glob('*.json')):
        record=json.loads(file.read_text())
        try:
            n=work.parse_scene(file.stem,record)
            result['nodes'].append({'id':n['id'],'type':n['type'],'chars':len(n['text']),'choices':n['choices']})
        except Exception as exc:
            dom=work.DOM(record['html'])
            result['parse_errors'].append({'id':file.stem,'error':str(exc),'containers':sorted({e.attrs.get('class','') for e in dom.root.walk() if e.tag=='div'}),'html_head':record['html'][:3000]})
report=work.ROOT/'reports/consider-validation.json'
if report.exists(): result['validation']=json.loads(report.read_text())
(out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><h1>KIRO import diagnostics: '+result['status']+'</h1><p>This is a developer diagnostic preview, not the game.</p><a href="report.json">Import report</a>')
with tarfile.open(out/'source-snapshot.tar.gz','w:gz') as tar:
    if work.DEST.exists(): tar.add(work.DEST,arcname='stories/consider-the-consequences')
    if report.exists(): tar.add(report,arcname='reports/consider-validation.json')
print(json.dumps({k:v for k,v in result.items() if k not in ['manifest','nodes','parse_errors']},ensure_ascii=False,indent=2))
