#!/usr/bin/env bash
# Runs the end-to-end tests against the local Supabase stack. Start it first: npx supabase start
set -euo pipefail

eval "$(npx supabase status -o env | sed 's/^/export /')"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

npx playwright test "$@"
