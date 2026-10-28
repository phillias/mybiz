#!/usr/bin/env bash
# Weekly AEO citation job — runs aeo-measure.mjs then aeo-trend.mjs.
# Used by the mybiz-aeo-weekly systemd user timer (box convention: mise shims
# on PATH, scripts load .env themselves). Notifies via ntfy only when
# ~/.config/opencode/aeo-weekly.ntfy.env exists (NTFY_URL=... NTFY_TOKEN=...
# lines, user-readable only); without it the job is silent except journald.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

NTFY_ENV="$HOME/.config/opencode/aeo-weekly.ntfy.env"
notify() {
  [ -f "$NTFY_ENV" ] || return 0
  # shellcheck disable=SC1090
  . "$NTFY_ENV"
  [ -n "${NTFY_URL:-}" ] && [ -n "${NTFY_TOKEN:-}" ] || return 0
  curl -sS --max-time 15 \
    -H "Authorization: Bearer $NTFY_TOKEN" \
    -d "mybiz AEO weekly on $(hostname -s): $1" \
    "$NTFY_URL" >/dev/null 2>&1 || echo "ntfy notify failed"
  return 0
}

out="$(mktemp)"
trap 'rm -f "$out"' EXIT

if ! node scripts/aeo-measure.mjs >"$out" 2>&1; then
  tail -3 "$out"
  notify "measure FAILED: $(tail -1 "$out" | cut -c1-200)"
  exit 1
fi
if ! node scripts/aeo-trend.mjs >>"$out" 2>&1; then
  tail -3 "$out"
  notify "trend FAILED: $(tail -1 "$out" | cut -c1-200)"
  exit 1
fi

tail -5 "$out"
notify "OK: $(tail -1 "$out" | cut -c1-200)"
