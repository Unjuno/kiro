"""Temporary developer preview. Never merge its Vercel configuration to main."""
import base64
import contextlib
import hashlib
import io
import json
import lzma
import os
import traceback
from pathlib import Path
import import_consider as work
from fetch_node import request
work.request = request
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
result['log_tail']=log.getvalue()[-1800:]
manifest=work.DEST/'source-manifest.json'
if manifest.exists():
    m=json.loads(manifest.read_text())
    result['source_pages']=len(m['pages'])
    result['ignored_subpages']=m['ignored_subpages']
    result['parse_errors']=[]
    result['parsed_nodes']=[]
    (out/'debug').mkdir(exist_ok=True)
    for file in sorted((work.DEST/'source').glob('*.json')):
        record=json.loads(file.read_text())
        try:
            n=work.parse_scene(file.stem,record)
            result['parsed_nodes'].append({'id':n['id'],'type':n['type'],'chars':len(n['text']),'targets':[c['next'] for c in n['choices']]})
            (out/'debug'/f'{file.stem}.json').write_text(json.dumps(n,ensure_ascii=False,indent=2))
        except Exception as exc:
            dom=work.DOM(record['html'])
            detail={'id':file.stem,'error':str(exc),'containers':sorted({e.attrs.get('class','') for e in dom.root.walk() if e.tag=='div'}),'paragraphs':[work.clean(e.text()) for e in dom.root.walk() if e.tag=='p'],'html':record['html']}
            result['parse_errors'].append({'id':file.stem,'error':str(exc)})
            (out/'debug'/f'{file.stem}.json').write_text(json.dumps(detail,ensure_ascii=False,indent=2))
report=work.ROOT/'reports/consider-validation.json'
if report.exists(): result['validation']=json.loads(report.read_text())
# Export exact bytes for archival transfer; manifest hashes verify the transfer.
files={str(f.relative_to(work.ROOT)):f.read_text() for f in work.DEST.rglob('*') if f.is_file()}
if report.exists(): files[str(report.relative_to(work.ROOT))]=report.read_text()
payload=json.dumps(files,ensure_ascii=False,separators=(',',':')).encode()
compressed=lzma.compress(payload,preset=9)
(out/'snapshot.json.xz').write_bytes(compressed)
encoded=base64.b64encode(compressed).decode()
chunks=[encoded[i:i+12000] for i in range(0,len(encoded),12000)]
(out/'chunks').mkdir(exist_ok=True)
for i,chunk in enumerate(chunks): (out/'chunks'/f'{i:03}.txt').write_text(chunk)
transfer={'format':'base64-xz-json-path-to-text','chunks':len(chunks),'base64_chars':len(encoded),'compressed_sha256':hashlib.sha256(compressed).hexdigest(),'uncompressed_sha256':hashlib.sha256(payload).hexdigest(),'files':len(files),'chunk_sha256':[hashlib.sha256(s.encode()).hexdigest() for s in chunks]}
(out/'chunks/index.json').write_text(json.dumps(transfer,indent=2))
result['transfer']=transfer
(out/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
(out/'index.html').write_text('<!doctype html><meta charset="utf-8"><h1>KIRO import diagnostic: '+result['status']+'</h1><a href="report.json">Report</a>')
print(json.dumps({k:v for k,v in result.items() if k not in ['parsed_nodes','validation']},ensure_ascii=False,indent=2))
