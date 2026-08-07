#!/usr/bin/env bash
# Docker smoke: build, boot, livez/readyz, check, record, health.
# Re-run from repo root:
#   ./scripts/docker-smoke.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${SOFTSTOP_DOCKER_IMAGE:-softstop:local-smoke}"
NAME="${SOFTSTOP_DOCKER_NAME:-softstop-local-smoke}"
PORT="${SOFTSTOP_DOCKER_PORT:-3000}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building $IMAGE"
docker build -t "$IMAGE" .

cleanup
echo "==> Running $NAME on :$PORT"
docker run -d --name "$NAME" -p "${PORT}:3000" -e GOVERNOR_STORAGE=memory "$IMAGE"

echo "==> Waiting for /livez"
ok=0
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/livez" >/dev/null; then
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" != "1" ]]; then
  docker logs "$NAME" || true
  echo "livez never became ready" >&2
  exit 1
fi

echo "==> /readyz"
curl -sf "http://127.0.0.1:${PORT}/readyz" | head -c 500
echo

echo "==> /v1/health"
curl -sf "http://127.0.0.1:${PORT}/v1/health" | head -c 800
echo

echo "==> /v1/check"
CHECK_JSON=$(curl -sf -X POST "http://127.0.0.1:${PORT}/v1/check" \
  -H 'content-type: application/json' \
  -d '{"userId":"docker_smoke","actionType":"urgency"}')
echo "$CHECK_JSON"
DECISION_ID=$(node -e "const j=JSON.parse(process.argv[1]); if(!j.allowed||!j.decisionId) process.exit(2); console.log(j.decisionId)" "$CHECK_JSON")

echo "==> /v1/record"
curl -sf -X POST "http://127.0.0.1:${PORT}/v1/record" \
  -H 'content-type: application/json' \
  -d "{\"userId\":\"docker_smoke\",\"actionType\":\"urgency\",\"outcome\":\"executed\",\"decisionId\":\"${DECISION_ID}\"}"
echo

echo "==> Docker smoke OK"
