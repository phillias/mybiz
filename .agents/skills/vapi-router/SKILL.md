---
name: vapi-router
description: "Router for Vapi voice AI skills. Load when the task involves Vapi assistants, calls, phone numbers, squads, tools, or webhook setup. Installs from upstream: npx skills add vapiai/skills"
---

# Vapi Skills Router

Vapi voice AI skills are available from upstream and NOT vendored locally.

## Install

```bash
npx skills add vapiai/skills
```

This installs: vapi-bootstrap-framework, vapi-prompt-builder, create-assistant, create-call, create-phone-number, create-squad, create-tool, setup-api-key, setup-webhook.

## Usage

After installation, skills are available in `.agents/skills/vapi-*/` and load automatically when their triggers match.
