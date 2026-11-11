---
name: posthog-router
description: "Router for PostHog analytics. Load when the task involves PostHog feature flags, experiments, analytics, session replay, insights, dashboards, or error tracking. Replaces MCP-served PostHog skills with posthog-axi CLI."
---

# PostHog Skills Router

PostHog capabilities are now served via `posthog-axi` CLI instead of MCP or vendored skills.

## Setup

```bash
# Install CLI
npm i -g @masculinecache/posthog-axi @posthog/cli

# Set credentials
export POSTHOG_CLI_API_KEY="phx_..."
export POSTHOG_CLI_PROJECT_ID="12345"
```

## Key commands

```bash
posthog-axi flags list          # List feature flags
posthog-axi flags get <key>     # Get flag details
posthog-axi flags toggle <key> on|off  # Toggle flag
posthog-axi insights            # List insights/dashboards
posthog-axi tools               # List all API tools
posthog-axi search "pattern"    # Search tools
posthog-axi info <tool>         # Tool schema
posthog-axi call <tool> '<json>' # Execute API call
```

## Previous 86 MCP-served skills

The following capability areas are now covered by the CLI:
- Feature flags: ab-testing, feature-usage-feed, finding-deleted-feature-flags, instrument-feature-flags, managing-experiment-lifecycle
- Experiments: creating-experiments, diagnosing-experiment-results, configuring-experiment-rollout, configuring-experiment-analytics
- Analytics: analytics, exploring-apm-traces, exploring-live-traffic, querying-posthog-data
- Session replay: finding-replay-for-issue, diagnosing-missing-recordings, exploring-replay-vision, replay
- Error tracking: triaging-error-issues, investigating-error-issue, diagnosing-stacktrace-symbolication, instrument-error-tracking
- Insights: finding-experiments, signals, suggesting-data-imports
- LLM observability: exploring-llm-traces, exploring-llm-costs, exploring-llm-evaluations, exploring-llm-clusters
