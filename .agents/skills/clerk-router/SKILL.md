---
name: clerk-router
description: "Router for Clerk skills. Load when the task involves Clerk auth, user management, organizations, or any clerk-* skill domain. Installs from upstream: npx skills add clerk/skills"
---

# Clerk Skills Router

Clerk skills are available from upstream and NOT vendored locally.

## Install

```bash
npx skills add clerk/skills
```

This installs all 20 Clerk skills: clerk, clerk-android, clerk-astro-patterns, clerk-backend-api, clerk-billing, clerk-chrome-extension-patterns, clerk-cli, clerk-custom-ui, clerk-expo, clerk-nextjs-patterns, clerk-nuxt-patterns, clerk-orgs, clerk-react-patterns, clerk-react-router-patterns, clerk-setup, clerk-swift, clerk-tanstack-patterns, clerk-testing, clerk-vue-patterns, clerk-webhooks.

## Usage

After installation, skills are available in `.agents/skills/clerk-*/` and load automatically when their triggers match.
