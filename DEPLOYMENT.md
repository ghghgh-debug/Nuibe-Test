# Deploying Nuibe Telegram Mini App

This project runs an Express web server and Telegram bot together.

## Recommended free hosts

1. **Render (recommended)**
    - Option A — Split services (recommended for reliability):
       - Create a **Web Service** for the web app:
          - Build command: `npm install`
          - Start command: `npm run start-server` (runs `server.js`)
          - Set `PORT` and `ADMIN_URL` env vars.
          - Add health check `/health` (public path) for monitoring.
       - Create a **Background Worker** for the Telegram bot:
          - Start command: `npm run start-bot` (runs `bot.js`)
          - Add `TELEGRAM_BOT_TOKEN` and `ADMIN_IDS` env vars.

    - Option B — Single service (simpler, less reliable):
       - Create one Web Service and use `Procfile` with `web: npm run start-all` or `web: npm run start-server` and also run the bot in same process (not recommended for long uptime).

2. **Fly.io**
   - Use `fly launch` and point to `node start-all.js`.
   - Add env vars in Fly dashboard.

3. **Railway**
   - Add a new project from GitHub.
   - Set `npm install` and `npm start`.
   - Add env vars in Railway.

## Required environment variables

- `TELEGRAM_BOT_TOKEN`
- `ADMIN_IDS`
- `ADMIN_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Notes

- If you want the bot and app to stay live, choose a host that supports continuous deployment.
- The Telegram bot is launched from the same process, so `npm start` starts both services.
