# Deploy mini app on your VPS (Nginx + HTTPS)

This guide serves the built **React/Vite** app as static files on a subdomain (example: **`miniapp.ksisms.com`**) on the same machine as **`tg_bot`**, with the API already exposed at **`https://bot.ksisms.com`** (or another HTTPS origin).

## Prerequisites

- **`tg_bot`** running behind Nginx with **HTTPS** and working **`/api/webapp/...`** routes.
- **DNS** control for your domain.
- **[Bun](https://bun.sh)** installed where you build (your laptop or the VPS). Quick install:

  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

  Then open a new shell or `source ~/.bashrc` so `bun` is on `PATH`.

## Important: `VITE_API_URL` is baked in at build time

Vite reads **`VITE_*`** variables when you run **`bun run build`** and inlines them into the JS bundle. There is no runtime `.env` on the server for the browser.

Set this **before every production build** you deploy:

```bash
export VITE_API_URL="https://bot.ksisms.com/api/webapp"
```

(No trailing slash. Replace the host if your API uses another name.)

---

## Step 1 — DNS

In your DNS panel (e.g. PowerDNS), add:

| Type | Name / host | Value        |
|------|-------------|--------------|
| **A** | `miniapp`   | Your VPS IPv4 |

Wait until `miniapp.yourdomain.com` resolves to the server.

---

## Step 2 — Build the frontend

### Option A — Build on the VPS

```bash
sudo mkdir -p /var/www/mini_app_ui
sudo chown -R "$USER:$USER" /var/www/mini_app_ui
cd /var/www/mini_app_ui

# If you use git:
git clone <your-repo-url> .
# or rsync/scp your project here

bun install
export VITE_API_URL="https://bot.ksisms.com/api/webapp"
bun run build
```

The output folder is **`dist/`**. Nginx will use this as `root`.

**Reproducible installs:** commit **`bun.lock`** to git, then on the server use:

`bun install --frozen-lockfile`

### Option B — Build on your computer, upload only `dist/`

```bash
cd /path/to/mini_app_ui
export VITE_API_URL="https://bot.ksisms.com/api/webapp"
bun install
bun run build

rsync -avz --delete dist/ root@YOUR_VPS_IP:/var/www/mini_app_ui/dist/
```

Adjust paths and user as needed.

---

## Step 3 — Nginx site for the mini app

Create a new site (do **not** reuse the `bot.` vhost; keep API and static UI separate).

```bash
sudo nano /etc/nginx/sites-available/miniapp-ksisms
```

Example (HTTP first — Certbot will add SSL in the next step):

```nginx
server {
    listen 80;
    server_name miniapp.ksisms.com;

    root /var/www/mini_app_ui/dist;
    index index.html;

    # Cache hashed assets; HTML should stay fresh
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/miniapp-ksisms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 4 — HTTPS (Let’s Encrypt)

```bash
sudo certbot --nginx -d miniapp.ksisms.com
```

Follow the prompts. Certbot will add `listen 443 ssl` and redirect HTTP → HTTPS.

Reload if needed:

```bash
sudo systemctl reload nginx
```

---

## Step 5 — Point the Telegram bot at the new URL

On the VPS, edit **`tg_bot`** project **`.env`** (only file the app loads):

```env
MINI_APP_URL=https://miniapp.ksisms.com
```

No trailing slash. Then:

```bash
sudo systemctl restart tg-bot
```

Telegram will use this for the **Menu button / Web App** URL your code sets in `post_init`.

If you also set a Web App URL in **@BotFather**, make it match **`MINI_APP_URL`**.

---

## Step 6 — CORS

`tg_bot` already uses permissive CORS for browser calls. If you ever lock CORS down, allow origin **`https://miniapp.ksisms.com`** for `/api/webapp`.

---

## Updating after code changes

1. Pull or upload new sources.  
2. Rebuild **with the same `VITE_API_URL`** (or new API URL if it changed):

   ```bash
   export VITE_API_URL="https://bot.ksisms.com/api/webapp"
   bun install
   bun run build
   ```

3. If you built locally, sync **`dist/`** again to `/var/www/mini_app_ui/dist/`.  
4. No need to restart **`tg-api`** for static-only UI changes; restart **`tg-bot`** only if you changed **`MINI_APP_URL`**.

---

## Checklist

- [ ] DNS **A** for `miniapp` → VPS  
- [ ] `bun run build` with **`VITE_API_URL=https://bot.ksisms.com/api/webapp`**  
- [ ] Nginx **`root`** points at **`dist/`** and **`try_files`** SPA fallback is set  
- [ ] **Certbot** for **`miniapp.ksisms.com`**  
- [ ] **`MINI_APP_URL=https://miniapp.ksisms.com`** in **`tg_bot` `.env`** + **`sudo systemctl restart tg-bot`**  
- [ ] Open **`https://miniapp.ksisms.com`** in the browser (padlock OK), then test inside Telegram  

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| Blank page / 404 on refresh | `try_files $uri $uri/ /index.html;` in `location /` |
| API errors / wrong host | Rebuild with correct **`VITE_API_URL`**; old bundle still cached — hard refresh or bump deploy |
| “Invalid initialization data” | **`tg_bot`** `webapp.py` initData validation + **`BOT_TOKEN`** on server; see **`tg_bot`** docs |
| Mixed content | Mini app must be **HTTPS** if **`VITE_API_URL`** is **https://** |
