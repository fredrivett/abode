#!/bin/bash

# Start Supabase local development environment
#
# WORKAROUND: Restart auth container after startup to load custom email templates.
# This is needed due to a race condition where the auth service starts before
# the template-serving component is ready in Supabase local development.
#
# Related issues:
# - https://github.com/orgs/supabase/discussions/20753
# - https://github.com/orgs/supabase/discussions/17601
#
# TODO: Remove the auth container restart once Supabase fixes the race condition

echo "Starting Supabase..."
supabase start

if [ $? -eq 0 ]; then
  echo "Waiting for services to initialize..."
  sleep 2

  echo "Restarting auth container to load email templates..."
  docker restart supabase_auth_abode

  if [ $? -eq 0 ]; then
    echo "✓ Supabase started successfully with custom email templates loaded"
  else
    echo "⚠ Warning: Failed to restart auth container. Email templates may not load correctly."
  fi
else
  echo "✗ Failed to start Supabase"
  exit 1
fi
