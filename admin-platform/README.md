# Verde administration

Frontend: https://frantisekdron.github.io/verde-slany/admin/

Client test workspace: https://frantisekdron.github.io/verde-slany/admin/?demo=1

The React frontend is served by GitHub Pages. A separate Cloudflare Worker
and private D1 database provide sign-in, content, reservations, history and uploads.
The production and demo Workers have separate databases, passwords and signing
keys. Demo accounts expire after seven days. No ChatGPT login is used.

## Development

```sh
npm ci
npm run typecheck
npm run build
npm run api:check
wrangler d1 migrations apply DB --local
npm run api:dev
```

The default Wrangler configuration is local development only. For production,
copy it to the ignored `wrangler.production.json`, set the actual D1 database ID,
restrict `ADMIN_ORIGINS` to `https://frantisekdron.github.io`, and set
`preview_urls: false`. A separate ignored `wrangler.demo.json` also sets
`DEMO_MODE: "true"` and points to a different Worker and database.

`AUTH_PEPPER` and `AUTH_BOOTSTRAP` are Worker secrets. Never add credentials,
database backups, sessions or upload originals to Git. Production bootstrap
accounts must choose a personal password at first sign-in. Sessions live only
in browser memory, expire after twelve hours and time out after an idle hour.
Passwords use scrypt and a server-side pepper; access permissions are enforced
by the API. Draft previews and private files use short-lived signed links tied
to an active session. Uploaded files are stored in bounded D1 chunks.

## Verification

`npm test` runs content and concurrency checks. To include the isolated local
API test, provide local fixtures in `.private/local-accounts.json` and run
`VERDE_TEST_API=http://127.0.0.1:8819 npm test`. That test refuses non-local hosts.
It covers authentication, role restrictions, stale-version conflicts,
reservations, private previews, uploads, byte ranges and session revocation.

Before deploying the frontend, build with the correct production URLs in
`static/config.json`. Deploy Worker changes and D1 migrations separately.
No private configuration is included in the static build.

## Existing publication workflow

This migration preserves the existing workflow: edits and publications update
the working CMS preview. Publishing the separate static public website requires
a separate reviewed release. The public price list and email enquiry flow are
unchanged. Email notifications remain disabled. Do not describe a successful
CMS save as a new GitHub Pages release or an email delivery.

## Migration on 18 November 2026

The original CMS state (version 3), two content revisions, two contact records,
four sales events, one held notification and one uploaded video were preserved.
There were no password accounts or active password sessions in the source CMS.
Published values matching current content defaults were normalized to empty
overrides; all 633 such values matched the 1,131-field source configuration.
The original private admin remains available as a rollback source.
