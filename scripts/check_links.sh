#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

BUILD_SITE=false
EXTRA_ARGS=()
for arg in "$@"; do
  case "$arg" in
    -b|--build)
      BUILD_SITE=true
      ;;
    -e|--external|--check-extern)
      EXTRA_ARGS+=("--check-extern")
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [-b|--build] [-e|--external] [linkchecker_args...]"
      echo ""
      echo "Options:"
      echo "  -b, --build                     Build the site before checking links"
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
  # Ensure site is built before serving with --serve-only
  if [ "$BUILD_SITE" = true ] || [ ! -d "_site" ] || [ -z "$(ls -A _site 2>/dev/null)" ]; then
    echo "Building site with ghrocker..."
    ghrocker . --build-only --mode non-interactive
  fi

  echo "Starting Jekyll server via ghrocker on port ${PORT}..."
  ghrocker . --serve-only --name "${CONTAINER_NAME}" -d --mode non-interactive
  SERVER_STARTED=true

  # Wait for server to become responsive
  echo "Waiting for Jekyll server to become ready..."
  SERVER_READY=false
  for i in {1..120}; do
    if curl -s -f -o /dev/null "${SITE_URL}"; then
      echo "Jekyll server is ready at ${SITE_URL} (took ${i}s)."
      SERVER_READY=true
      break
    fi
    if (( i % 10 == 0 )); then
      echo "Still waiting for Jekyll server (${i}s elapsed)..."
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
