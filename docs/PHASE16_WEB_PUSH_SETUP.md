# Phase 16 — Activate News Radar Web Push

**Status:** Web Push endpoints deploy safely even when VAPID is unconfigured. Until configured, GET /api/push/config returns \`{"enabled":false,"publicKey":null}\` and the notification settings screen explains the setup requirement. Cloudflare Pages does not hold private keys.

## 1. Generate a unique VAPID key pair

On your own machine (do not create this key in a chat and do not commit it):

\`\`\`cmd
cd /d D:\SideProject\news-radar
git checkout main
git pull origin main
cd apps\api
node scripts\generate-vapid.mjs
\`\`\`

This prints \`VAPID_PUBLIC_KEY\` and \`VAPID_PRIVATE_KEY\`. Keep the **private key secret**. Do not reuse demo values, and do not send the keys to anyone.

## 2. Set two Cloudflare Worker secrets

On the machine already logged in to Cloudflare Wrangler:

\`\`\`cmd
cd /d D:\SideProject\news-radar\apps\api
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
\`\`\`

Paste the appropriate value in each prompt. Use the same pair, and never rotate them casually: existing browser subscriptions must re-register after rotation. The optional \`VAPID_SUBJECT\` is an HTTPS URL; default is the News Radar Pages origin.

**Do not put VAPID_PRIVATE_KEY in any NEXT_PUBLIC_* environment variable, website source, or the Git repository.** Worker configuration uses secrets stored in Cloudflare; GitHub CD deploys preserve them.

## 3. Verify

- Check the merged Worker deploy run in GitHub Actions and that D1 migration 0007 is applied.
- Open \`https://new-radar-api.lengochao123-27102004.workers.dev/api/push/config\`. The response should contain \`enabled:true\` and the public key only.
- Open \`https://news-radar-9px.pages.dev/notifications/\` in an HTTPS browser and click "Bật nhận thông báo." Browser permission must be granted by a direct user action.
- On iPhone, add the PWA to Home Screen before using Web Push. Browser support varies.
- Wait for a **new** daily or weekly issue and check the notification click opens the exact issue. Existing issues are not proactively resent indefinitely.
- After opting out, the browser unsubscribes and the matching D1 subscription is removed.

## Sending rules

One daily, one weekly, and (only if explicitly enabled) one relevant-topic notification for each eligible fresh issue. Server uses a unique delivery key, an hourly Cron, quiet hours in the browser's selected IANA timezone, and a bounded number of subscriber deliveries per run. Push service status 404/410 removes expired subscriptions. At most two attempts are made on transient failures.

The implementation uses RFC 8291 aes128gcm payload encryption and RFC 8292 VAPID ES256 authentication. It never sends subscriptions to user-defined arbitrary endpoints; only supported browser Push service domains are allowed. The server stores endpoint, browser encryption keys, preferences and delivery history in D1, not user account profiles.

## Known limitations

- Push requires manually provisioning VAPID secrets and browser permission. CI success cannot prove real delivery on every device.
- Limited, bounded deliveries per scheduled run; this is a personal-scale MVP, not a bulk notification platform.
- Different browser installations have different subscriptions and settings. Quiet hours and topic preferences are per installation.
- The service cannot guarantee arrival time; delivery timing is controlled partly by the browser/OS push service.
- The existing Pages site origin is explicitly allowlisted for write APIs. If you add a custom domain later, update CORS allowlist.
