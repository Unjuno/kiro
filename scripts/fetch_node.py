"""Explicit import-only Node transport; the offline parser has no networking dependency."""
import json
import subprocess
from pathlib import Path

def request(params):
    result = subprocess.run(['node',str(Path(__file__).with_name('fetch_wikisource.mjs')),json.dumps(params)],capture_output=True,text=True,timeout=210)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or 'Node source fetch failed')
    return json.loads(result.stdout)
