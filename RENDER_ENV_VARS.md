Render deployment - environment variables and recommended settings

-- Overview
This file lists environment variables required for running the Nuibe web app and the Telegram bot on Render.

-- Service split (recommended)
- Web Service (public HTTP app): `server.js` (start command: `npm run start-server`)
- Background Worker (long-running): `bot.js` (start command: `npm run start-bot`)

-- Required env vars (common)
- `PORT` (optional) — default 3000
- `ADMIN_URL` — public URL to the admin page (e.g. https://your-app.onrender.com/admin.html)

-- Telegram bot (worker) vars
- `TELEGRAM_BOT_TOKEN` — required. Keep secret.
- `ADMIN_IDS` — comma-separated Telegram user IDs with admin access

-- Supabase vars (if you use Supabase)
- `SUPABASE_URL` — https://<project>.supabase.co
- `SUPABASE_KEY` — service anon or server key (use anon for client, service role only on trusted backend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key, keep secret (server-only)
- `NEXT_PUBLIC_SUPABASE_URL` — same as `SUPABASE_URL` for client use
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key for client-side (limited privileges)
- `SUPABASE_DB_URL` — optional Postgres connection string for migrations (server-only)

-- Logging and uptime
- `LOG_LEVEL` — optional (e.g. info, debug)
- `FEATURE_FLAG_USE_SUPABASE` — optional boolean to enable Supabase usage

-- Security notes
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or DB passwords to the client.
- Add all secret env vars in Render's Environments configuration, not in the repo.

-- Render-specific recommendations
- Create two services: Web Service and Background Worker.
- Web Service settings: Build `npm install`, Start `npm run start-server`.
- Background Worker: Start `npm run start-bot` (choose the same repo/branch).
- Use the Health check URL `/health` on the web service for uptime monitors.
