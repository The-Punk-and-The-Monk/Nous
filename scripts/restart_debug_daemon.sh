#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${1:-${REPO_ROOT}/debug_local/env.txt}"

if [[ ! -f "${ENV_FILE}" ]]; then
	echo "Missing env file: ${ENV_FILE}" >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

cd "${REPO_ROOT}"

echo "Using debug daemon env: ${ENV_FILE}"
echo "NOUS_HOME=${NOUS_HOME:-"(unset)"}"
echo "OPENAI_BASE_URL=${OPENAI_BASE_URL:-"(unset)"}"
echo "OPENAI_MODEL=${OPENAI_MODEL:-"(unset)"}"

bun bin/nous.ts daemon stop >/dev/null 2>&1 || true
bun bin/nous.ts daemon start
bun bin/nous.ts daemon status
