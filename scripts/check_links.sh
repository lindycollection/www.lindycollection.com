#!/usr/bin/env bash
set -e

PORT="${PORT:-4000}"
SITE_URL="http://localhost:${PORT}/"
CONTAINER_NAME="jekyll-server-$$"
SERVER_STARTED=false

# Check if a server is already running on the target port
if curl -s -o /dev/null "${SITE_URL}"; then
  echo "Found existing server running at ${SITE_URL}"
else
  echo "Starting Jekyll server via ghrocker on port ${PORT}..."
  ghrocker . --develop --name "${CONTAINER_NAME}" -d --mode non-interactive
  SERVER_STARTED=true

  # Wait for server to become responsive
  echo "Waiting for Jekyll server to become ready..."
  for i in {1..30}; do
    if curl -s -o /dev/null "${SITE_URL}"; then
      echo "Jekyll server is ready at ${SITE_URL}."
      break
    fi
    sleep 1
  done
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
linkchecker "${SITE_URL}" ${CONFIG_ARG} --no-status "$@"
