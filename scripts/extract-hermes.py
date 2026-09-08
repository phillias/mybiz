#!/usr/bin/env python3
"""Extract messages from Hermes state.db sessions.
Usage: python3 scripts/extract-hermes.py --profile mybiz --limit 50
"""

import sqlite3
import json
import argparse
import os
from pathlib import Path

def extract(profile="mybiz", limit=50):
    db_path = os.path.expanduser(f"~/.hermes/profiles/{profile}/state.db")
    if not os.path.exists(db_path):
        print(f"Error: {db_path} not found", flush=True)
        return
    
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    cursor = db.cursor()
    
    # Get sessions with message counts
    cursor.execute("""
        SELECT s.id, s.title, s.started_at, s.last_activity_at,
               s.message_count
        FROM sessions s
        ORDER BY s.last_activity_at DESC
        LIMIT ?
    """, (limit,))
    
    sessions = cursor.fetchall()
    extracted = []
    
    for session in sessions:
        cursor.execute("""
            SELECT role, content, timestamp, tool_name
            FROM messages
            WHERE session_id = ?
            ORDER BY timestamp ASC
        """, (session["id"],))
        
        messages = []
        for msg in cursor.fetchall():
            content = msg["content"] or ""
            messages.append({
                "role": msg["role"],
                "content": content[:5000],
                "timestamp": msg["timestamp"],
                "tool_name": msg["tool_name"],
            })
        
        extracted.append({
            "source": "hermes",
            "profile": profile,
            "session_id": session["id"],
            "title": session["title"],
            "created_at": session["started_at"],
            "updated_at": session["last_activity_at"],
            "message_count": len(messages),
            "messages": messages,
        })
    
    db.close()
    return extracted

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", default="mybiz")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    
    data = extract(args.profile, args.limit)
    
    if args.output:
        Path(args.output).write_text(json.dumps(data, indent=2))
        print(f"Extracted {len(data)} sessions to {args.output}")
    else:
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    main()
