#!/usr/bin/env python3
"""Classify extracted sessions by domain and route to partition.
Uses keyword heuristics for zero-cost classification (no LLM needed for v1).
Routes: mybiz (commercial) | mybrain (professional) | private

Usage: python3 scripts/classify-content.py --input extracted.json --output classified.json
"""

import json
import argparse
import re
from pathlib import Path

# Keyword sets for classification
MYBIZ_KEYWORDS = [
    # Harbor product
    "harbor", "seo", "aeo", "llms.txt", "schema", "faqpage", "howto",
    "core 30", "gbp", "google business profile", "content generation",
    "article", "landing page", "niche", "keywords", "serp", "dataforseo",
    "citation", "answer engine", "exa", "perplexity", "chatgpt",
    # Agency / client work
    "prospect", "lead-gen", "client", "pitch", "may plumbing", "alanson",
    "petoskey", "harbor springs", "michigan", "local business",
    "aftercall", "vapi", "telnyx", "voice", "review outreach",
    "convex", "astro", "cloudflare", "stripe", "clerk", "resend",
    "codevex", "phillias", "saas", "pricing", "subscription",
    "backlog", "milestone", "deploy", "ci/cd",
]

MYBRAIN_KEYWORDS = [
    # AI tools / dev workflows
    "python", "duckdb", "postgres", "docker", "selfhost", "homelab",
    "hermes", "opencode", "composio", "mcp", "gateway", "systemd",
    "debug", "oauth", "token", "api key", "config",
    # Professional / personal brand
    "mybrain", "lifeos", "trading", "investment", "tutorial",
    "obsidian", "note-taking", "knowledge graph",
    # Security / infra
    "firewall", "crowdsec", "waf", "ssh", "tunnel", "vpn",
    "backup", "rclone", "gcp", "oracle",
]

PRIVATE_KEYWORDS = [
    "family", "health", "blood pressure", "medication",
    "finance", "bank", "loan", "credit", "payment", "autopay",
    "personal", "private", "diary", "journal",
]

# Strong signals that override keyword counting
STRONG_MYBIZ = [
    "may plumbing", "aftercall", "harbor voice", "prospect radar",
    "core 30", "codevex.app", "harborseo",
]
STRONG_MYBRAIN = [
    "mybrain", "lifeos", "duckdb", "homelab", "selfhost",
]
STRONG_PRIVATE = [
    "blood pressure", "family", "personal finance",
]

def classify(text):
    """Classify text into mybiz, mybrain, or private."""
    if not text:
        return {"domain": "unknown", "confidence": 0, "scores": {}}
    
    text_lower = text.lower()
    
    # Check strong signals first
    for kw in STRONG_MYBIZ:
        if kw in text_lower:
            return {"domain": "mybiz", "confidence": 0.9, "match": kw}
    for kw in STRONG_MYBRAIN:
        if kw in text_lower:
            return {"domain": "mybrain", "confidence": 0.9, "match": kw}
    for kw in STRONG_PRIVATE:
        if kw in text_lower:
            return {"domain": "private", "confidence": 0.9, "match": kw}
    
    # Keyword counting
    scores = {"mybiz": 0, "mybrain": 0, "private": 0}
    for kw in MYBIZ_KEYWORDS:
        if kw in text_lower:
            scores["mybiz"] += 1
    for kw in MYBRAIN_KEYWORDS:
        if kw in text_lower:
            scores["mybrain"] += 1
    for kw in PRIVATE_KEYWORDS:
        if kw in text_lower:
            scores["private"] += 1
    
    max_score = max(scores.values())
    if max_score == 0:
        return {"domain": "unknown", "confidence": 0, "scores": scores}
    
    domain = max(scores, key=scores.get)
    confidence = min(max_score / 5, 0.8)  # Cap at 0.8 for heuristic
    
    return {"domain": domain, "confidence": confidence, "scores": scores}

def classify_session(session):
    """Classify a single extracted session."""
    # Build text from available fields
    text_parts = [session.get("title", "")]
    if "messages" in session:
        for m in session["messages"][:10]:
            text_parts.append(m.get("content", ""))
    elif "content" in session:
        text_parts.append(session["content"])
    if session.get("summary"):
        text_parts.append(session["summary"])
    if session.get("headline"):
        text_parts.append(session["headline"])
    
    text = " ".join(text_parts)
    result = classify(text)
    
    return {
        **session,
        "classification": result,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    
    data = json.loads(Path(args.input).read_text())
    
    classified = [classify_session(s) for s in data]
    
    # Summary
    domains = {}
    for s in classified:
        d = s["classification"]["domain"]
        domains[d] = domains.get(d, 0) + 1
    
    print(f"\nClassification Summary:", flush=True)
    for d, c in sorted(domains.items(), key=lambda x: -x[1]):
        print(f"  {d}: {c}")
    
    if args.output:
        Path(args.output).write_text(json.dumps(classified, indent=2))
        print(f"\nClassified {len(classified)} sessions to {args.output}")
    else:
        print(json.dumps(classified, indent=2))

if __name__ == "__main__":
    main()
