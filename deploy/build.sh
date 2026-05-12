#!/usr/bin/env bash
# Build & push the all-in-one Dyff image.
#
# Local usage:
#   ./deploy/build.sh              # build + push :<git-sha> and :latest (amd64)
#   PUSH=0 ./deploy/build.sh       # build but do not push (loads into local docker)
#   PLATFORMS=linux/amd64,linux/arm64 ./deploy/build.sh
#   TAG=v0.3.0 ./deploy/build.sh
#
# In CI: the same script works; just `docker login` beforehand.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

IMAGE=${IMAGE:-dyffs/dyff}
TAG=${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo "dev")}
PLATFORMS=${PLATFORMS:-linux/amd64}
PUSH=${PUSH:-1}

# Ensure a buildx builder exists.
if ! docker buildx inspect dyff-builder >/dev/null 2>&1; then
  echo "Creating buildx builder 'dyff-builder'…"
  docker buildx create --name dyff-builder --use >/dev/null
else
  docker buildx use dyff-builder >/dev/null
fi

ARGS=(
  --platform "$PLATFORMS"
  --file deploy/Dockerfile
  --tag "${IMAGE}:${TAG}"
  --tag "${IMAGE}:latest"
)

if [[ "$PUSH" == "1" ]]; then
  ARGS+=(--push)
else
  # buildx --load only supports a single platform.
  if [[ "$PLATFORMS" == *","* ]]; then
    echo "PUSH=0 requires a single platform (got: $PLATFORMS)." >&2
    exit 1
  fi
  ARGS+=(--load)
fi

echo "Building ${IMAGE}:${TAG} for ${PLATFORMS} (push=${PUSH})…"
docker buildx build "${ARGS[@]}" .
echo "Done."
