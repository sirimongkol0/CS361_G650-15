#!/usr/bin/env bash
# Install the pinned cfn-guard release into $HOME/.local/bin.
#
# Used by .github/workflows/infra.yml. GitHub's ubuntu-latest runner is x86_64,
# so the default asset is cfn-guard-v3-ubuntu-latest.tar.gz from release 3.1.2
# (the aarch64 Ubuntu asset is used automatically on arm64).
#
# The caller must add the install directory to PATH; the workflow does this
# through $GITHUB_PATH.
#
# Usage:
#   scripts/install_cfn_guard.sh
#   CFN_GUARD_VERSION=3.1.2 CFN_GUARD_INSTALL_DIR=/usr/local/bin scripts/install_cfn_guard.sh
set -euo pipefail

VERSION="${CFN_GUARD_VERSION:-3.1.2}"
INSTALL_DIR="${CFN_GUARD_INSTALL_DIR:-$HOME/.local/bin}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Linux" ]] || die "this installer supports Linux only (found $(uname -s))"

case "$(uname -m)" in
  x86_64 | amd64) ASSET="cfn-guard-v3-ubuntu-latest.tar.gz" ;;
  aarch64 | arm64) ASSET="cfn-guard-v3-aarch64-ubuntu-latest.tar.gz" ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac

URL="https://github.com/aws-cloudformation/cloudformation-guard/releases/download/${VERSION}/${ASSET}"

for tool in curl tar install; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is required"
done

# Verify the pinned asset exists before downloading. Offline machines cannot
# complete this HEAD request, so keep going and let the download fail with a
# clear message instead of failing here.
if curl -fsSLI --connect-timeout 10 --max-time 30 "$URL" >/dev/null 2>&1; then
  log "verified pinned release asset: $URL"
else
  log "WARNING: could not verify $URL (network unavailable?); trying the pinned release anyway"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

log "downloading cfn-guard ${VERSION} (${ASSET})"
curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 --max-time 180 \
  -o "$tmp_dir/$ASSET" "$URL" || die "download failed: $URL"

tar -xzf "$tmp_dir/$ASSET" -C "$tmp_dir"
binary="$(find "$tmp_dir" -type f -name cfn-guard -print -quit)"
[[ -n "$binary" ]] || die "cfn-guard binary not found inside $ASSET"

mkdir -p "$INSTALL_DIR"
install -m 0755 "$binary" "$INSTALL_DIR/cfn-guard"

installed_version="$("$INSTALL_DIR/cfn-guard" --version | awk '{print $NF}')"
[[ "$installed_version" == "$VERSION" ]] || die "installed version $installed_version does not match pinned $VERSION"
log "installed cfn-guard ${installed_version} at $INSTALL_DIR/cfn-guard"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) log "note: add $INSTALL_DIR to PATH to run cfn-guard directly" ;;
esac
