#!/usr/bin/env python3
"""Capture once; subsequently verify the committed snapshot without network access.
Use --refresh only for an intentional new source revision.
"""
import argparse
import json
import traceback
import import_consider as work

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args()
    try:
        work.self_test()
        if args.refresh or not (work.DEST/'source-manifest.json').exists():
            work.fetch_sources()
        work.verify_and_compile()
        report=work.read(work.ROOT/'reports/consider-validation.json')
        work.write(work.ROOT/'reports/import-status.json',{'status':'PASS','source_pages':report['source_pages'],'nodes':report['nodes'],'endings':report['endings'],'graph_sha256':report['graph_sha256']})
    except Exception as exc:
        work.write(work.ROOT/'reports/import-status.json', {'status':'FAIL','error':str(exc),'traceback':traceback.format_exc()})
        raise
