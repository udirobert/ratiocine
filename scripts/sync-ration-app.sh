#!/usr/bin/env bash
# Sync the canonical Ration app source (ration-app/) into the local Neutron
# monorepo clone (neutron/apps/ratiocine/) so it can be built and installed.
#
# The neutron/ directory is a local clone of github.com/infu/neutron (gitignored
# here). ration-app/ is the source of truth committed to this repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ration-app"
DEST="$ROOT/neutron/apps/ratiocine"

if [ ! -e "$ROOT/neutron/.git" ]; then
  echo "neutron/ clone missing. Run first:" >&2
  echo "  git clone --depth 1 https://github.com/infu/neutron.git neutron" >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --delete \
  --exclude '.mops' \
  --exclude 'dist' \
  --exclude 'node_modules' \
  --exclude '*.neutron' \
  --exclude '.DS_Store' \
  "$SRC/" "$DEST/"

# Provisioning manifests resolve archive paths from the Neutron clone root,
# not from the app directory. Copy only fail-closed committed templates; the
# operator creates and fills the non-example production files locally.
DEPLOY_TEMPLATES="$SRC/deploy/neutron"
if [ -d "$DEPLOY_TEMPLATES" ]; then
  rsync -a "$DEPLOY_TEMPLATES/" "$ROOT/neutron/"
fi

echo "synced $SRC -> $DEST"
if [ ! -d "$DEST/.mops" ]; then
  echo "installing mops packages (first sync)..."
  (cd "$DEST" && mops install)
fi
echo
echo "Build + install locally:"
echo "  cd neutron && npm --workspace neutron-ratiocine run package"
echo "  npm run provision -- ration-local.ndeploy.json reinstall"
