# ALWEN DISPATCHER PRO

Enterprise logistics payment request and approval system built on Vercel + Google Sheets.

---

## Stack

- **Frontend** — Vanilla HTML/CSS/JS (Tailwind CDN), served as static files from `/public`
- **Backend** — Vercel Serverless Functions (`/api/*.js`)
- **Database** — Google Sheets (via Google Sheets API v4)

---

## Project Structure

```
├── api/
│   ├── _lib/               # Shared modules (no HTTP handlers here)
│   │   ├── audit.js        # writeAuditLog helper
│   │   ├── constants.js    # SPREADSHEET_ID, column arrays, KEY_MAP
│   │   ├── cors.js         # CORS header helper
│   │   ├── hash.js         # SHA-256 password hashing
│   │   └── sheets.js       # Google Sheets client factory
│   ├── approve.js          # GET/POST/PUT — request submission & approval
│   ├── audit.js            # GET/POST — audit trail
│   ├── check-job-id.js     # GET — duplicate Job ID check
│   ├── cleanup.js          # POST — remove duplicate rows from sheets
│   ├── login.js            # POST — user authentication
│   ├── setup.js            # POST — first-time Google Sheets setup
│   ├── submit.js           # deprecated (returns 410)
│   └── users.js            # GET/POST/PUT — user management
├── public/
│   ├── agx-logo.png
│   ├── index.html          # Main app (requires login)
│   └── login.html          # Login page
├── server.js               # Local dev server (in-memory, mirrors Vercel API)
├── vercel.json             # Vercel deployment config
└── package.json
```

---

## Local Development

```bash
npm install
npm run dev
# → http://localhost:3000
```

Local mode uses **in-memory data only** — nothing is written to Google Sheets.

Default accounts (local only):
| Username | Password | Role  |
|----------|----------|-------|
| ADMIN1   | admin123 | admin |
| ADMIN2   | admin123 | admin |
| USER1–8  | user123  | user  |

---

## Deployment (Vercel)

### 1. Prerequisites
- A [Vercel](https://vercel.com) account linked to this repo
- A Google Cloud service account with **Google Sheets API** enabled
- The target Google Spreadsheet ID (already set in `api/_lib/constants.js`)

### 2. Set Environment Variables in Vercel

Go to **Project → Settings → Environment Variables** and add:

| Variable             | Value                                      |
|----------------------|--------------------------------------------|
| `GOOGLE_CREDENTIALS` | Full JSON content of your service account key |
| `SETUP_SECRET`       | Your chosen setup passphrase (optional, defaults to `DISPATCH_PRO_SETUP_2026`) |

> **Important:** Paste the entire service account JSON as a single line for `GOOGLE_CREDENTIALS`.

### 3. Deploy

```bash
# Via Vercel CLI
npx vercel --prod

# Or push to the main branch — Vercel auto-deploys on push
git push origin main
```

### 4. First-Time Setup

After deployment, initialize the Google Sheets structure by calling the setup endpoint once:

```bash
curl -X POST https://your-app.vercel.app/api/setup \
  -H "Content-Type: application/json" \
  -d '{"secret":"DISPATCH_PRO_SETUP_2026"}'
```

This creates the `USERS`, `PENDING`, `DATABASE`, and `AUDIT_LOG` sheets with default accounts.

> **Change default passwords immediately after first login.**

---

## Google Sheets Structure

| Sheet       | Purpose                          |
|-------------|----------------------------------|
| `USERS`     | Auth credentials and roles       |
| `PENDING`   | Submitted requests awaiting review |
| `DATABASE`  | Approved requests (permanent record) |
| `AUDIT_LOG` | All actions with timestamp, user, details |

---

## API Reference

| Method | Endpoint            | Description                        | Auth |
|--------|---------------------|------------------------------------|------|
| POST   | `/api/login`        | Authenticate user                  | —    |
| GET    | `/api/approve`      | List all pending requests          | —    |
| POST   | `/api/approve`      | Submit a new request               | —    |
| PUT    | `/api/approve`      | Approve or reject a request        | —    |
| GET    | `/api/users`        | List all users                     | —    |
| POST   | `/api/users`        | Create a new user                  | —    |
| PUT    | `/api/users`        | Update user (role/status/password) | —    |
| GET    | `/api/audit`        | Retrieve audit log                 | —    |
| GET    | `/api/check-job-id` | Get all existing Job IDs           | —    |
| POST   | `/api/cleanup`      | Remove duplicate rows from sheets  | —    |
| POST   | `/api/setup`        | First-time sheet initialization    | —    |

> Authentication is session-based via `localStorage`. All API endpoints are accessible only after login enforced client-side.

---

## Security Notes

- Passwords are hashed with SHA-256 before storage — consider migrating to bcrypt for stronger security
- `GOOGLE_CREDENTIALS` must never be committed to the repository — it is listed in `.gitignore`
- The `SETUP_SECRET` should be changed from the default before production use
- All API routes include `no-store` cache headers to prevent sensitive data caching
