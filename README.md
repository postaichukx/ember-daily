# Ember

Ember is a personal routine tracker for building a steady rhythm through small, repeatable steps. It combines daily routines, flexible weekly goals, a contribution-style calendar, statistics, synced notes, and an optional Scriptable widget.

The app is built with browser JavaScript, a Cloudflare Worker API, and Cloudflare D1. Its interface is in English and adapts to desktop and mobile screens.

**Hosted demo:** [ember.ember-routines.workers.dev](https://ember.ember-routines.workers.dev/) — this is a separate, owner-controlled deployment. Its database, credentials, and account data are not part of this repository, and access is restricted to its configured owner.

## Features

- **Daily routines:** choose weekdays, organize a routine into steps, and track completion. A routine counts as complete when every step is done. Rest days do not break a streak; missing a scheduled day does.
- **Weekly goals:** set a target of 1–7 completions from Monday through Sunday, on any days. A weekly completion requires every step and can count at most once per day. Weekly goals and streaks are separate from daily routines.
- **Calendar:** review and correct past completions in a year-long activity grid. Future completions are not allowed.
- **Statistics:** view all routines or one routine over 7, 28, or 90 days, or all time. Daily completion and streak statistics are shown separately from weekly-goal statistics.
- **Notes:** create and edit notes, sync them with the account, and archive or restore them.
- **Routine management:** edit, archive, or permanently delete routines. Archiving preserves history; permanent deletion removes that routine's completion history too.
- **Appearance:** choose a dark or light theme. The preference is stored on the current device.
- **Backups:** export routines, notes, and history as JSON. Importing a backup replaces the current account data across devices.
- **Scriptable widget:** show current progress, streaks, and recent activity on an iPhone Home Screen. The widget key is read-only and can be revoked in Ember Settings.
- **Installable web app:** add Ember to an iPhone Home Screen from Safari.

## Requirements

For local development:

- Git
- Node.js 22.13 or newer, with npm
- A modern browser

For your own hosted instance:

- A Cloudflare account with permission to create Workers and D1 databases
- Node.js and npm to install dependencies and run Wrangler
- A new D1 database for your Ember instance
- A Resend account and sending API key
- An email address for the instance owner and an email sender allowed by Resend

An optional custom domain is not required; the Wrangler configuration enables a `workers.dev` address. GitHub Pages alone cannot host Ember because the app requires a server API and a persistent database as well as static files.

## Run locally

Clone the repository and install the locked dependencies:

```sh
git clone https://github.com/postaichukx/ember-daily.git
cd ember-daily
npm ci
npm run dev
```

Open [http://127.0.0.1:8123](http://127.0.0.1:8123). This preview uses a local SQLite database at `.sites-runtime/preview.sqlite` and a development identity. It does not send email or connect to the hosted demo. Its data is separate from any Cloudflare D1 database.

To test the email sign-in flow locally, run `npm start` instead. It uses a local mock mailbox at `.sites-runtime/mailbox.json`; the generated email and one-time code are written there for local testing, and no real email is sent. Both commands build the app before starting the server.

To run the automated tests and build:

```sh
npm test
npm run build
```

`npm test` runs the production build first. Opening `public/index.html` directly or using an IDE's static HTML preview does not start the API server.

## Deploy your own instance to Cloudflare

The steps below create a separate Ember deployment and database in your Cloudflare account. They do not connect to or change the hosted demo.

### 1. Sign in and create a D1 database

```sh
git clone https://github.com/postaichukx/ember-daily.git
cd ember-daily
npm ci
npx wrangler login
npx wrangler d1 create ember-yourname-db
```

Copy the D1 database ID printed by Wrangler. Keep it for the configuration step below.

### 2. Create your private Wrangler configuration

Copy the example file:

```sh
cp wrangler.example.jsonc wrangler.jsonc
```

Edit `wrangler.jsonc` and replace the placeholders:

- `name`: a unique Worker name
- `account_id`: your Cloudflare account ID
- `database_name`: the D1 database name you created
- `database_id`: the ID printed by Wrangler
- `OWNER_EMAIL`: the email address allowed to sign in to this instance
- `EMAIL_FROM`: a sender address permitted by your Resend account

`wrangler.jsonc` is excluded by `.gitignore` because it contains account-specific configuration. Keep it out of public commits.

### 3. Add server-side secrets

Add your Resend sending key and a unique random OTP secret. Wrangler prompts for each value:

```sh
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put OTP_SECRET
```

Generate a strong random value for `OTP_SECRET` (at least 32 characters). Do not put either secret in source code, `wrangler.jsonc`, or GitHub. Ember currently sends sign-in email through the Resend API; another email provider needs a code change.

### 4. Apply the database migrations and deploy

```sh
npx wrangler d1 migrations apply DB --remote
npm run build
npx wrangler deploy
```

The `DB` argument is the D1 binding name in the Wrangler configuration. Wrangler prints the deployed Worker URL. Open it, request a sign-in code for the configured owner email, and confirm that the email arrives before relying on the deployment.

### 5. Connect the Scriptable widget (optional)

1. Install Scriptable on your iPhone.
2. In Ember Settings, download `Ember-Widget.js` and save it in iCloud Drive → Scriptable.
3. Choose **Connect widget** in Ember Settings and create a key.
4. Run `Ember-Widget` in Scriptable and enter the key when prompted.
5. Add a Scriptable widget to the Home Screen and select `Ember-Widget`.

The key can only read the widget summary. Creating a new key replaces the previous one; choose **Revoke widget access** in Ember Settings to disconnect it. iOS decides when widgets actually refresh. A custom-domain deployment is not needed: the downloaded script uses the origin it came from.

## Update your deployment

After pulling a newer version of the source:

```sh
git pull
npm ci
npm test
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Review new migrations before applying them to a database that contains important data. Export an Ember backup and, where appropriate, a D1 backup before a production update. The repository does not include a GitHub Actions workflow; deployment is manual unless you configure your own CI/CD and protect its credentials.

## Data, privacy, and limitations

- Email sign-in is restricted to the single `OWNER_EMAIL` configured for a Worker. This repository is prepared for a personal, owner-managed instance; it is not a ready-to-use multi-user service.
- Each instance uses its own D1 database. Cloning this repository does not import the demo's account data.
- Routine and note changes need a network connection to sync. The service worker may show an offline page, but Ember does not queue offline edits for later synchronization.
- The Scriptable widget is read-only. Its refresh timing is controlled by iOS.
- Keep `.env` files, `.dev.vars`, `wrangler.jsonc`, API keys, database exports, and local SQLite files private. Never commit production credentials or user data.

## Project structure

| Path | Purpose |
| --- | --- |
| `public/` | Web interface, shared data model, styles, PWA assets, and Scriptable script |
| `server/` | Worker API, email authentication, and widget endpoints |
| `cloudflare/` | Cloudflare Worker entry point |
| `db/`, `drizzle/` | D1 schema and SQL migrations |
| `scripts/` | Build, local preview, and local database adapter |
| `tests/` | Model, API, authentication, network, statistics, and widget tests |
| `wrangler.example.jsonc` | Safe starting point for your own Cloudflare configuration |

## License

Ember is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you modify Ember and make that modified version available as a network service, AGPL-3.0 includes obligations to offer the service's users the corresponding source code. See the full license for its terms.
