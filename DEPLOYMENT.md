# Deploying Nuibe Telegram Mini App

This project runs an Express web server and Telegram bot together.

## Recommended free hosts

1. **Render**
   - Create a new Web Service.
   - Set the build command: `npm install`
   - Set the start command: `npm start`
   - Add environment variables from `.env.example`.
   - Render will use `Procfile` to launch `node start-all.js`.

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
