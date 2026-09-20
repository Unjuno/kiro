#!/usr/bin/env python3
"""Exhaustive rendered-HTML test. Usage: python3 scripts/test_http.py [base URL].
Plain GETs and extracted anchors intentionally exercise JavaScript-free play.
"""
import hashlib
import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urljoin, urlparse, parse_qs
from urllib.request import urlopen
from import_consider import DOM, clean
ROOT=Path(__file__).resolve().parents[1]
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3000').rstrip('/')
graph=json.loads((ROOT/'stories/consider-the-consequences/graph.json').read_text())
report=json.loads((ROOT/'reports/consider-validation.json').read_text())
version=report['graph_sha256'][:16]

def get(path):
    with urlopen(urljoin(base,path),timeout=30) as response:
        assert response.status==200
        text=response.read().decode()
    return DOM(text),text

def marked(dom,key):
    return [e for e in dom.root.walk() if key in e.attrs]

def stage(dom):
    return marked(dom,'data-kiro-stage')[0].attrs['data-kiro-stage']

def p(path):
    return parse_qs(urlparse(path).query)

root,_=get('/')
assert stage(root)=='language'
assert not marked(root,'data-kiro-story-choice')
resume='/?'+urlencode({'story':graph['id'],'node':'H-1','v':version})
gate,_=get(resume)
assert stage(gate)=='language' and not marked(gate,'data-kiro-visible-story-text')
lang_link=next(e.attrs['href'] for e in gate.root.walk() if e.tag=='a' and p(e.attrs.get('href','')).get('lang')==['ja'])
assert p(lang_link)['node']==['H-1']
resume_page,_=get(lang_link)
assert stage(resume_page)=='scene'
change=marked(resume_page,'data-kiro-change-language')[0].attrs['href']
change_page,_=get(change)
assert stage(change_page)=='language'
switch=next(e.attrs['href'] for e in change_page.root.walk() if e.tag=='a' and p(e.attrs.get('href','')).get('lang')==['en'])
assert p(switch)['node']==['H-1'] and p(switch)['v']==[version]

catalog,_=get('/?lang=ja')
assert stage(catalog)=='catalog'
start,_=get(marked(catalog,'data-kiro-story-choice')[0].attrs['href'])
assert stage(start)=='story' and marked(start,'data-kiro-spoken-attribution')
queue=[e.attrs['href'] for e in marked(start,'data-kiro-entry')]
visited=set(); traversed=0; endings=[]
while queue:
    link=queue.pop(0); args=p(link); node_id=args['node'][0]
    if node_id in visited: continue
    assert args['lang']==['ja'] and args['v']==[version]
    page,raw=get(link)
    node=graph['nodes'][node_id]
    assert marked(page,'data-kiro-state')[0].attrs['data-kiro-state']==node_id
    body=marked(page,'data-kiro-visible-story-text')
    assert len(body)==1 and clean(body[0].text())==clean(node['text']),node_id
    anchors=marked(page,'data-kiro-choice')
    assert [p(a.attrs['href'])['node'][0] for a in anchors]==[c['next'] for c in node['choices']],node_id
    for other in graph['nodes'].values():
        if other['id']!=node_id:
            # Check full unique foreign scene, not shared prose fragments.
            assert other['text'] not in raw,('future scene leaked',node_id,other['id'])
    assert marked(page,'data-kiro-spoken-attribution')
    assert (stage(page)=='ending')==(node['type']=='ending')
    if node['type']=='ending': endings.append(node_id)
    queue.extend(a.attrs['href'] for a in anchors); traversed+=len(anchors); visited.add(node_id)
    print('HTTP PASS',node_id,flush=True)
assert len(visited)==len(graph['nodes'])
assert len(endings)==43
for path in ['/?lang=en&story='+graph['id']+'&node=not-a-node', '/?lang=en&story=unknown', '/?lang=en&story='+graph['id']+'&v=obsolete', '/stories/consider-the-consequences/graph.json', '/stories/consider-the-consequences/source/Helen.json']:
    try:
        get(path)
        raise AssertionError('Expected 404: '+path)
    except HTTPError as err:
        assert err.code==404,(path,err.code)
result={'status':'PASS','base_url':base,'nodes_rendered':len(visited),'choice_links_checked':traversed,'endings_reached':len(endings),'language_first':True,'resume_preserved':True,'language_change_preserves_progress':True,'source_archive_not_publicly_served':True,'graph_sha256':report['graph_sha256'],'voice_translation_quality':'not evaluated by HTTP tests'}
(ROOT/'reports/http-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
