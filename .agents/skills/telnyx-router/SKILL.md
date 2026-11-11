---
name: telnyx-router
description: "Router for Telnyx skills. Load when the task involves Telnyx voice, SMS, fax, IoT, WebRTC, or any telnyx-* skill domain. Installs from upstream: npx skills add team-telnyx/ai"
---

# Telnyx Skills Router

Telnyx skills are available from upstream and NOT vendored locally.

## Install

```bash
npx skills add team-telnyx/ai
```

This installs all 49 Telnyx skills covering voice, SMS, fax, IoT, WebRTC, numbers, porting, and more.

## Usage

After installation, skills are available in `.agents/skills/telnyx-*/` and load automatically when their triggers match.
