#!/usr/bin/env python3
"""Explicit network acquisition. Offline compilation remains import_consider.py --verify."""
import json
import traceback
import import_consider as work
from fetch_node import request

work.request = request
if __name__ == '__main__':
    try:
        work.self_test()
        work.fetch_sources()
        work.verify_and_compile()
    except Exception as exc:
        work.write(work.ROOT/'reports/import-status.json', {'status':'FAIL','error':str(exc),'traceback':traceback.format_exc()})
        raise
