#!/bin/bash
#
# Conductor workspace run command. Starts the app dev server.

set -euo pipefail

cd app && bun run dev
