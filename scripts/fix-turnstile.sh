#!/bin/bash
# Fix Turnstile Secret Key Mismatch
#
# Problem: The TURNSTILE_SECRET_KEY in Cloudflare Pages doesn't match the
# PUBLIC_TURNSTILE_SITE_KEY used in the frontend. They come from different
# Turnstile widgets.
#
# Steps:
# 1. Go to Cloudflare Dashboard → Turnstile
# 2. Find the widget with site key: 0x4AAAAAACaqvcOA4H-DU2p6
# 3. Copy the SECRET KEY from that widget
# 4. Run this script with the secret key as an argument
#
# Usage: ./scripts/fix-turnstile.sh YOUR_SECRET_KEY

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: $0 <turnstile-secret-key>"
    echo ""
    echo "To find your Turnstile secret key:"
    echo "  1. Go to https://dash.cloudflare.com → Turnstile"
    echo "  2. Find the widget with site key: 0x4AAAAAACaqvcOA4H-DU2p6"
    echo "  3. Copy the Secret Key"
    echo "  4. Run: $0 <secret-key>"
    exit 1
fi

SECRET_KEY="$1"
ACCT="1e06c741f48712b9be6634001698888d"

# Get OAuth token from wrangler config
TOKEN_FILE="$HOME/Library/Preferences/.wrangler/config/default.toml"
if [ ! -f "$TOKEN_FILE" ]; then
    echo "Error: Wrangler config not found. Run 'wrangler login' first."
    exit 1
fi

TOKEN=$(grep 'oauth_token' "$TOKEN_FILE" | head -1 | sed 's/^oauth_token = "//;s/"$//')

echo "Updating TURNSTILE_SECRET_KEY in Cloudflare Pages..."

RESPONSE=$(curl -s -X PATCH \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.cloudflare.com/client/v4/accounts/$ACCT/pages/projects/bokushi" \
    -d "{\"deployment_configs\":{\"production\":{\"env_vars\":{\"TURNSTILE_SECRET_KEY\":{\"value\":\"$SECRET_KEY\",\"type\":\"secret_text\"}}}}}")

SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('success', False))")

if [ "$SUCCESS" = "True" ]; then
    echo "Successfully updated TURNSTILE_SECRET_KEY!"
    echo ""
    echo "Now trigger a new deployment to apply the change:"
    echo "  git push  (if there are pending commits)"
    echo "  OR use 'gh workflow run deploy.yml' to trigger manually"
    echo ""
    echo "After deployment, test at: https://niracler.com/friends/"
else
    echo "Failed to update. API response:"
    echo "$RESPONSE" | python3 -m json.tool
fi
