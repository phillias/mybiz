---
name: convex-router
description: "Router for Convex skills. Load when the task involves Convex backend, real-time data, functions, or any convex-* skill domain. Installs from upstream: npx skills add convex/agent-skills"
---

# Convex Skills Router

Convex skills are available from upstream and NOT vendored locally.

## Install

```bash
npx skills add convex/agent-skills
```

This installs all 36 Convex skills: convex, convex-acquire-domain, convex-add, convex-advisor, convex-agent, convex-auth, convex-authz, convex-backup, convex-billing, convex-check-updates, convex-cost, convex-create-component, convex-crons, convex-deploy-guard, convex-design, convex-docs, convex-domains, convex-env, convex-expert, convex-explain-app, convex-improve-convex-plugin, convex-insights, convex-launch-readiness, convex-migrate, convex-migrate-rehearse, convex-monitor, convex-optimize, convex-quickstart, convex-reviewer, convex-seed, convex-self-heal, convex-sentinel, convex-ship, convex-suggest, convex-test, convex-verify.

## Usage

After installation, skills are available in `.agents/skills/convex-*/` and load automatically when their triggers match.
