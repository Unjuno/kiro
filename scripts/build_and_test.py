#!/usr/bin/env python3
"""Offline verification, production build, and exhaustive HTTP traversal. No source fetch."""
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
env={**os.environ,'NEXT_TELEMETRY_DISABLED':'1','PYTHONUTF8':'1'}
def run(args): subprocess.run(args,check=True,env=env)
run([sys.executable,'scripts/import_consider.py','--verify'])
run(['node','--test',*map(str,sorted(Path('tests').glob('*.test.mjs')))])
run(['node','node_modules/next/dist/bin/next','build'])
with open('reports/http-server.log','w',encoding='utf-8') as log:
    server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],stdout=log,stderr=subprocess.STDOUT,env=env)
    try:
        for attempt in range(60):
            if server.poll() is not None: raise RuntimeError('Test server exited; see reports/http-server.log')
            try:
                with urlopen('http://127.0.0.1:3000',timeout=2) as res:
                    if res.status==200: break
            except Exception: pass
            time.sleep(0.5)
        else: raise RuntimeError('Test server did not become ready')
        run([sys.executable,'scripts/test_http.py'])
    finally:
        server.terminate()
        try: server.wait(timeout=10)
        except subprocess.TimeoutExpired: server.kill(); server.wait()
print('OFFLINE GRAPH, UNIT TESTS, PRODUCTION BUILD, AND ALL HTTP PATHS: PASS',flush=True)
