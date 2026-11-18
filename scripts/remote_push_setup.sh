#!/bin/bash
set -e
cd /opt/companion
npm install web-push --omit=dev
if ! grep -q '^VAPID_PUBLIC_KEY=' .env 2>/dev/null; then
  printf '\nVAPID_PUBLIC_KEY=%s\nVAPID_PRIVATE_KEY=%s\nVAPID_SUBJECT=mailto:companion@localhost\n' \
    "$VAPID_PUBLIC_KEY" "$VAPID_PRIVATE_KEY" >> .env
  echo vapid=added
else
  echo vapid=exists
fi
npx tsc -p tsconfig.server.json --noEmit
pm2 restart companion
sleep 2
curl -sS http://127.0.0.1:8787/api/health
echo
