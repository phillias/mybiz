#!/usr/bin/env python3
"""Extract documents from Research Signal Companion library.db.
Usage: python3 scripts/extract-companion.py
"""

import sqlite3
import json
import os
from pathlib import Path

def extract():
    db_path = os.path.expanduser("~/.local/share/last30days/library.db")
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found", flush=True)
        return None
    
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    
    cursor.execute("""
        SELECT entry_id, source_path, topic, headline, summary,
               published_date, source_format
        FROM library_documents
    """)
    
    docs = cursor.fetchall()
    db.close()
    
    return [{
        "source": "last30days",
        "entry_id": d["entry_id"],
        "path": d["source_path"],
        "topic": d["topic"],
        "headline": d["headline"],
        "summary": d["summary"],
        "published_date": d["published_date"],
        "format": d["source_format"],
    } for d in docs]

def main():
    data = extract()
    if data is None:
        return
    
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
