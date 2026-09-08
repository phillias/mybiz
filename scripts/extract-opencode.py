#!/usr/bin/env python3
"""Extract sessions from OpenCode opencode.db.
Usage: python3 scripts/extract-opencode.py --limit 50
"""

import sqlite3
import json
import argparse
import os
from pathlib import Path

def extract(limit=50):
    db_path = os.path.expanduser("~/.local/share/opencode/opencode.db")
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found", flush=True)
        return None
    
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    
    # Get recent sessions
    cursor.execute("""
        SELECT s.id, s.title, s.time_created, s.time_updated,
               p.name as project_name,
               COUNT(DISTINCT m.id) as msg_count
        FROM session s
        LEFT JOIN message m ON m.session_id = s.id
        LEFT JOIN project p ON p.id = s.project_id
        GROUP BY s.id
        ORDER BY s.time_updated DESC
        LIMIT ?
    """, (limit,))
    
    sessions = cursor.fetchall()
    extracted = []
    
    for session in sessions:
        # Get text parts (actual content)
        cursor.execute("""
            SELECT json_extract(data, '$.type') as part_type,
                   json_extract(data, '$.text') as text
            FROM part
            WHERE session_id = ? AND json_extract(data, '$.type') = 'text'
            ORDER BY time_created ASC
        """, (session["id"],))
        
        parts = cursor.fetchall()
        content = "\n\n".join(
            (p["text"] or "")[:2000] for p in parts if p["text"]
        )[:10000]
        
        extracted.append({
            "source": "opencode",
            "session_id": session["id"],
            "title": session["title"],
            "project": session["project_name"],
            "created_at": session["time_created"],
            "updated_at": session["time_updated"],
            "message_count": session["msg_count"],
            "content": content,
        })
    
    db.close()
    return extracted

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    
    data = extract(args.limit)
    
    if data is None:
        return
    
    if args.output:
        Path(args.output).write_text(json.dumps(data, indent=2))
        print(f"Extracted {len(data)} sessions to {args.output}")
    else:
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
