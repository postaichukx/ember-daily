# Ember

A minimalist routine tracker with daily schedules, flexible weekly goals, synced notes, statistics, and Scriptable widgets. Ember is a responsive web app built with JavaScript, Cloudflare Workers, and D1.

**Demo:** https://ember.ember-routines.workers.dev/ (the hosted demo is a separate, owner-configured deployment; this repository does not include its account data or credentials.)

## Features

- Daily routines with steps, schedules, streaks, and a contribution calendar.
- Flexible weekly goals: complete a routine 1–7 times from Monday to Sunday, on any days.
- Notes synced with the signed-in account, with editing and reversible archiving.
- Routine statistics and a read-only Scriptable widget.
- Email-code sign-in for a single configured owner.
- Export and import of account data.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:8123. This local preview creates an isolated SQLite database in `.sites-runtime/preview.sqlite`, uses a development identity, and does not send email. It is separate from the hosted demo. In WebStorm, run `npm run dev` in the terminal; opening `public/index.html` with the IDE's static preview will not start the API.

To run the test suite and production build:

```sh
npm test
npm run build
```

## Deploy your own instance to Cloudflare

You need a Cloudflare account, Node.js, and a Resend account or another configured email sender supported by the code. Create your own resources; this repository has no access to the demo's database.

1. Install Wrangler and sign in:

   ```sh
   npm install
   npx wrangler login
   ```

2. Create a D1 database and copy the example config:

   ```sh
   npx wrangler d1 create ember-yourname-db
   cp wrangler.example.jsonc wrangler.jsonc
   ```

   Edit `wrangler.jsonc`: set a unique Worker `name`, your Cloudflare `account_id`, the D1 database ID returned by Wrangler, your owner email, and a permitted sender address. This file is ignored by Git because it contains per-account configuration.

3. Apply the schema and add secrets through Wrangler (do not put secret values in Git):

   ```sh
   npx wrangler d1 migrations apply DB --remote
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put OTP_SECRET
   ```

   Set `RESEND_API_KEY` to your mail provider's sending key. Set `OTP_SECRET` to a unique random value of at least 32 characters. Configure `EMAIL_FROM` to a sender allowed by your mail provider.

4. Deploy:

   ```sh
   npx wrangler deploy
   ```

   Wrangler prints your Worker URL. Use the Settings page there to connect its Scriptable widget. The Worker rewrites the downloaded script to use that deployment's own address.

Never publish `.env` files, `.dev.vars`, Cloudflare credentials, real database exports, or your local `wrangler.jsonc`.

## Project structure

- `public/` — browser app, shared data model, styles, and widget script.
- `server/` — Worker routes, email authentication, and widget API.
- `cloudflare/` — Cloudflare-specific Worker wrapper.
- `db/`, `drizzle/` — D1 schema and migrations.
- `scripts/` — build, local preview, and optional remote QA helpers.
- `tests/` — model, API, authentication, and widget tests.

## License

Licensed under the GNU Affero General Public License v3.0. See [LICENSE](LICENSE). If you modify and run this program as a network service, AGPL-3.0 requires offering users interacting with it remotely access to the corresponding source code of that modified version.
