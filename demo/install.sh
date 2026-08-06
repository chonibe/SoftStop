#!/usr/bin/env bash
# SoftStop installer — macOS / Linux (Windows: WSL or Git Bash)
# Usage: curl -fsSL https://softstop.vercel.app/install.sh | bash
set -euo pipefail

BOLD='\033[1m'
AMBER='\033[38;2;232;163;23m'
MUTED='\033[38;2;139;139;150m'
OK='\033[38;2;63;185;80m'
ERR='\033[38;2;248;81;73m'
NC='\033[0m'

SOFTSTOP_BASE="${SOFTSTOP_BASE:-https://softstop.vercel.app}"
SOFTSTOP_TGZ="${SOFTSTOP_TGZ:-${SOFTSTOP_BASE}/softstop.tgz}"
SOFTSTOP_SPEC="${SOFTSTOP_SPEC:-${SOFTSTOP_TGZ}}"
NODE_MIN_MAJOR=18

info() { printf '%b\n' "${MUTED}$*${NC}"; }
ok() { printf '%b\n' "${OK}$*${NC}"; }
warn() { printf '%b\n' "${AMBER}$*${NC}"; }
fail() { printf '%b\n' "${ERR}$*${NC}" >&2; exit 1; }

header() {
  printf '\n'
  printf '%b\n' "${BOLD}${AMBER}SoftStop${NC} — the permit before pressure"
  printf '\n'
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js ${NODE_MIN_MAJOR}+ is required. Install from https://nodejs.org then re-run."
  fi
  local major
  major="$(node_major)"
  if [[ "$major" -lt "$NODE_MIN_MAJOR" ]]; then
    fail "Node.js ${NODE_MIN_MAJOR}+ required (found v$(node -v 2>/dev/null || echo '?'))."
  fi
  need_cmd npm
  ok "Node $(node -v) · npm $(npm -v)"
}

detect_os() {
  local uname_s
  uname_s="$(uname -s 2>/dev/null || echo unknown)"
  case "$uname_s" in
    Darwin*) echo "macOS" ;;
    Linux*) echo "Linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "Windows" ;;
    *) echo "$uname_s" ;;
  esac
}

install_into_project() {
  local dir="$1"
  info "Installing softstop into ${dir}"
  (
    cd "$dir"
    npm install --no-fund --no-audit "$SOFTSTOP_SPEC"
  )
  ok "Installed softstop in ${dir}"
}

print_next_steps() {
  local where="$1"
  cat <<EOF

${BOLD}Next steps${NC}

  1. Import the client (in ${where}):

     ${AMBER}import { SoftStop } from 'softstop'${NC}
     ${AMBER}const ss = new SoftStop({ url: process.env.SOFTSTOP_API_URL || 'http://localhost:3000' })${NC}

  2. Gate escalations:

     ${AMBER}const d = await ss.check({ userId, actionType: 'urgency' })${NC}
     ${AMBER}if (!d.allowed) {${NC}
     ${AMBER}  await ss.record({ decisionId: d.decisionId, userId, actionType: 'urgency', outcome: 'blocked', blockReason: d.reason })${NC}
     ${AMBER}  return${NC}
     ${AMBER}}${NC}

  3. Verify wiring (orphanRate should stay low):

     ${AMBER}await ss.verify()${NC}
     ${AMBER}await ss.health()${NC}

  Self-host API: clone SoftStop and run ${AMBER}pnpm dev${NC} → http://localhost:3000
  Hosted demo API: ${AMBER}${SOFTSTOP_BASE}${NC} (use /api paths)

  Or skip the script next time:
    ${AMBER}npm i ${SOFTSTOP_TGZ}${NC}

EOF
}

main() {
  header

  local os
  os="$(detect_os)"
  info "Detected ${os}"

  if [[ "$os" == "Windows" ]]; then
    warn "Native Windows shells are unsupported. Prefer WSL or Git Bash."
  fi

  ensure_node

  local target
  if [[ -f "./package.json" ]]; then
    target="$(pwd)"
    install_into_project "$target"
  else
    target="$(pwd)/softstop-project"
    if [[ ! -d "$target" ]]; then
      info "No package.json here — creating ${target}"
      mkdir -p "$target"
      printf '%s\n' '{
  "name": "softstop-project",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}' > "$target/package.json"
    else
      info "Reusing existing ${target}"
    fi
    install_into_project "$target"
  fi

  print_next_steps "$target"
  ok "SoftStop is ready. Check before you escalate."
}

main "$@"
