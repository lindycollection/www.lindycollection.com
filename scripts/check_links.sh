#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

EXTRA_ARGS=()
for arg in "$@"; do
  case "$arg" in
    -e|--external|--check-extern)
      EXTRA_ARGS+=("--check-extern")
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [-e|--external] [linkchecker_args...]"
      echo ""
      echo "Options:"
      echo "  -e, --external, --check-extern  Check external links in addition to internal links"
      echo "  -h, --help                      Show this help message"
      exit 0
      ;;
    *)
      EXTRA_ARGS+=("$arg")
      ;;
  esac
done

if ! command -v ghrocker &>/dev/null; then
  echo "Error: 'ghrocker' not found in PATH." >&2
  echo "Please activate your virtual environment (e.g., 'source lcvenv/bin/activate') or install dependencies with:" >&2
  echo "  pip install -r requirements-dev.txt" >&2
  exit 1
fi

PORT="${PORT:-4000}"
SITE_URL="http://localhost:${PORT}/"
CONTAINER_NAME="jekyll-server-$$"
SERVER_STARTED=false

# Check if a server is already running on the target port
if curl -s -f -o /dev/null "${SITE_URL}"; then
  echo "Found existing server running at ${SITE_URL}"
else
  echo "Starting Jekyll server via ghrocker on port ${PORT}..."
  ghrocker . --develop --name "${CONTAINER_NAME}" -d --mode non-interactive
  SERVER_STARTED=true

  # Wait for server to become responsive (Jekyll generation takes ~60-70s)
  echo "Waiting for Jekyll server to finish generating and become ready..."
  SERVER_READY=false
  for i in {1..120}; do
    if curl -s -f -o /dev/null "${SITE_URL}"; then
      echo "Jekyll server is ready at ${SITE_URL} (took ${i}s)."
      SERVER_READY=true
      break
    fi
    if (( i % 10 == 0 )); then
      echo "Still waiting for Jekyll build/serve (${i}s elapsed)..."
    fi
    sleep 1
  done

  if [ "$SERVER_READY" != true ]; then
    echo "Error: Jekyll server failed to become ready at ${SITE_URL} within 120 seconds."
    exit 1
  fi
fi

cleanup() {
  if [ "$SERVER_STARTED" = true ]; then
    echo "Stopping Docker container ${CONTAINER_NAME}..."
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Point to .linkcheckerrc if present
CONFIG_ARG=""
if [ -f ".linkcheckerrc" ]; then
  CONFIG_ARG="--config=.linkcheckerrc"
elif [ -f "$(dirname "$0")/../.linkcheckerrc" ]; then
  CONFIG_ARG="--config=$(dirname "$0")/../.linkcheckerrc"
fi

echo "Running LinkChecker against ${SITE_URL}..."
linkchecker "${SITE_URL}" ${CONFIG_ARG} --no-status "${EXTRA_ARGS[@]}"
