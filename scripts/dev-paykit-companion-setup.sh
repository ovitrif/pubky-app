#!/usr/bin/env bash
# Official paykit-companion-auth against a running Paykit Server /setup flow.
# This is a watch-only BIP84 tpub helper. It is not Bitkit and does not move Bitcoin.
set -euo pipefail
umask 077

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat >&2 <<'USAGE'
Usage:
  PAYKIT_SETUP_URL=http://127.0.0.1:3104/setup \
  PAYKIT_RETURN_TO=http://localhost:3000 \
  PAYKIT_COMPANION_AUTH=/path/to/paykit-companion-auth \
  CREATOR_SECRET_B64_FILE=/path/to/32-byte-base64url-secret \
  ACCOUNT_TPUB_FILE=/path/to/bip84-account.tpub \
  scripts/dev-paykit-companion-setup.sh

Environment:
  PAYKIT_SETUP_URL           Paykit GET /setup URL
  PAYKIT_RETURN_TO           Exact allowed origin, e.g. http://localhost:3000
  PAYKIT_SETUP_STATE         Opaque state (default: random)
  PAYKIT_COMPANION_AUTH      Official paykit-companion-auth binary
  CREATOR_SECRET_B64_FILE    32-byte Pubky seed as unpadded base64url (0600)
  ACCOUNT_TPUB_FILE          Canonical BIP84 account tpub (0600)
  PAYKIT_ACCOUNT_INDEX       Hardened account index (default: 0)
  PAYKIT_COMPLETE_TIMEOUT    curl max-time for POST /complete (default: 90)

The script HTML-unescapes the hosted auth URL and keeps Paykit's advertised relay.
Do not rewrite the relay to localhost: Pubky 0.8 testnet still polls the public inbox.
Do not print, commit, or pass pubkyauth URLs on argv.
USAGE
  exit 2
fi

require_file() {
  local path="$1"
  [[ -f "$path" ]] || {
    echo "missing file: $path" >&2
    exit 2
  }
}

require_command() {
  command -v "$1" >/dev/null || {
    echo "missing command: $1" >&2
    exit 127
  }
}

require_command curl
require_command python3
require_command jq

PAYKIT_SETUP_URL="${PAYKIT_SETUP_URL:?set PAYKIT_SETUP_URL}"
PAYKIT_RETURN_TO="${PAYKIT_RETURN_TO:?set PAYKIT_RETURN_TO}"
PAYKIT_COMPANION_AUTH="${PAYKIT_COMPANION_AUTH:?set PAYKIT_COMPANION_AUTH}"
CREATOR_SECRET_B64_FILE="${CREATOR_SECRET_B64_FILE:?set CREATOR_SECRET_B64_FILE}"
ACCOUNT_TPUB_FILE="${ACCOUNT_TPUB_FILE:?set ACCOUNT_TPUB_FILE}"
PAYKIT_SETUP_STATE="${PAYKIT_SETUP_STATE:-$(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')}"
PAYKIT_ACCOUNT_INDEX="${PAYKIT_ACCOUNT_INDEX:-0}"
PAYKIT_COMPLETE_TIMEOUT="${PAYKIT_COMPLETE_TIMEOUT:-90}"

require_file "$PAYKIT_COMPANION_AUTH"
require_file "$CREATOR_SECRET_B64_FILE"
require_file "$ACCOUNT_TPUB_FILE"
[[ -x "$PAYKIT_COMPANION_AUTH" ]] || {
  echo "PAYKIT_COMPANION_AUTH is not executable" >&2
  exit 2
}

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

python3 - "$PAYKIT_SETUP_URL" "$PAYKIT_RETURN_TO" "$PAYKIT_SETUP_STATE" "$WORKDIR" <<'PY'
import html, json, re, sys, urllib.parse, urllib.request
setup_url, return_to, state, workdir = sys.argv[1:5]
query = urllib.parse.urlencode({"return_to": return_to, "state": state})
url = f"{setup_url}?{query}" if "?" not in setup_url else f"{setup_url}&{query}"
with urllib.request.urlopen(url, timeout=15) as response:
    html_doc = response.read().decode("utf-8")
    status = response.status
if status != 200:
    raise SystemExit(f"GET /setup HTTP {status}")
flow = re.search(r'const flowId="([^"]+)"', html_doc)
auth_m = re.search(r"<code>(pubkyauth://[^<]+)</code>", html_doc)
if not flow or not auth_m:
    raise SystemExit("setup HTML missing flow id or auth URL")
auth = html.unescape(auth_m.group(1))
parsed = urllib.parse.urlparse(auth)
qs = urllib.parse.parse_qs(parsed.query)
relay = urllib.parse.urlparse((qs.get("relay") or [""])[0])
open(f"{workdir}/auth.url", "w").write(auth)
open(f"{workdir}/meta.json", "w").write(
    json.dumps(
        {
            "flow_id": flow.group(1),
            "auth_url_len": len(auth),
            "relay_host": relay.netloc,
            "has_claim": "x-bitkit-claim" in qs,
        }
    )
)
print(json.dumps({"setup_http": 200, "relay_host": relay.netloc, "has_claim": "x-bitkit-claim" in qs}))
PY

python3 - "$WORKDIR" "$CREATOR_SECRET_B64_FILE" "$ACCOUNT_TPUB_FILE" "$PAYKIT_ACCOUNT_INDEX" <<'PY'
import json, sys
from pathlib import Path
workdir, secret_path, tpub_path, account_index = sys.argv[1:5]
payload = {
    "version": 1,
    "auth_url": Path(f"{workdir}/auth.url").read_text().strip(),
    "creator_secret": Path(secret_path).read_text().strip(),
    "account_xpub": Path(tpub_path).read_text().strip(),
    "account_index": int(account_index),
}
if not payload["creator_secret"] or not payload["account_xpub"].startswith("tpub"):
    raise SystemExit("creator secret or tpub is empty/invalid")
Path(f"{workdir}/companion.input.json").write_text(json.dumps(payload))
print("companion_input_ready")
PY

set +e
"$PAYKIT_COMPANION_AUTH" <"$WORKDIR/companion.input.json" >"$WORKDIR/companion.stdout" 2>"$WORKDIR/companion.stderr"
companion_rc=$?
set -e
if [[ "$companion_rc" -ne 0 ]]; then
  echo "companion_auth_failed rc=$companion_rc" >&2
  echo "stderr=$(tr -d '\n' <"$WORKDIR/companion.stderr")" >&2
  exit "$companion_rc"
fi
echo "companion_auth=$(tr -d '\n' <"$WORKDIR/companion.stdout")"

FLOW_ID="$(jq -r .flow_id "$WORKDIR/meta.json")"
SETUP_ORIGIN="$(python3 - "$PAYKIT_SETUP_URL" <<'PY'
from urllib.parse import urlparse
import sys
parsed = urlparse(sys.argv[1])
print(f"{parsed.scheme}://{parsed.netloc}")
PY
)"
code="$(curl -sS --max-time "$PAYKIT_COMPLETE_TIMEOUT" -o "$WORKDIR/complete.json" -w '%{http_code}' \
  -X POST "${SETUP_ORIGIN}/setup/${FLOW_ID}/complete")"
echo "complete_http=$code"
if [[ -s "$WORKDIR/complete.json" ]]; then
  jq 'with_entries(select(.key|test("(?i)secret|xpub|auth|token|credential")|not))' "$WORKDIR/complete.json"
fi
[[ "$code" == 200 ]]
