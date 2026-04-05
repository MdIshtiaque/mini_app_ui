# Deploy the mini app on your VPS (step by step)

This guide deploys **mini_app_ui** as static files on **`https://miniapp.YOURDOMAIN.com`** (example uses **`miniapp.ksisms.com`** — replace with your domain everywhere).

**Assumptions**

- **`tg_bot`** is already on the same VPS (or reachable) with **HTTPS**, e.g. **`https://bot.ksisms.com`**, and **`/api/webapp/...`** works.
- You have **sudo** on the VPS and access to **DNS** for your domain.
- The mini app repo is on **GitHub/GitLab** (or you can paste any **git clone** URL).

---

## Step 1 — Log in to the VPS

```bash
ssh root@YOUR_VPS_IP
# or ssh youruser@YOUR_VPS_IP
```

Use the account you normally use to manage **`/var/www`** and **Nginx**.

---

## Step 2 — Install Git and Bun

**Git** (if not already installed):

```bash
sudo apt update
sudo apt install -y git
```

**Bun** (JavaScript runtime + package manager; used instead of npm):

```bash
curl -fsSL https://bun.sh/install | bash
```

Close and reopen the shell, or:

```bash
source ~/.bashrc
```

Confirm:

```bash
bun --version
git --version
```

---

## Step 3 — Create the app directory and clone the repo

Pick an install root (this guide uses **`/var/www/mini_app_ui`**).

```bash
sudo mkdir -p /var/www/mini_app_ui
sudo chown -R "$USER:$USER" /var/www/mini_app_ui
cd /var/www/mini_app_ui
```

**Clone** your repository. Replace **`YOUR_GIT_URL`** with your real remote (HTTPS or SSH):

```bash
git clone YOUR_GIT_URL .
```

Examples:

```bash
git clone https://github.com/YOUR_USER/mini_app_ui.git .
# or
git clone git@github.com:YOUR_USER/mini_app_ui.git .
```

You should see **`package.json`**, **`src/`**, etc. in **`/var/www/mini_app_ui`**.

If the repo is a **monorepo** and the app lives in a subfolder:

```bash
git clone YOUR_GIT_URL repo
cd repo/mini_app_ui   # adjust path
# continue from Step 4 inside this directory
```

---

## Step 4 — Install dependencies with Bun

From the directory that contains **`package.json`**:

```bash
cd /var/www/mini_app_ui
bun install
```

If the repo includes **`bun.lock`**, use a reproducible install:

```bash
bun install --frozen-lockfile
```

---

## Step 5 — Set the API URL and build (production bundle)

The browser needs a **public HTTPS** base for **`/api/webapp`**. That value is **compiled into** the JS at build time (Vite **`VITE_*`** env vars).

**Before** `bun run build`, set **`VITE_API_URL`** (no trailing slash):

```bash
export VITE_API_URL="https://bot.ksisms.com/api/webapp"
```

Change **`bot.ksisms.com`** if your API uses another hostname.

Build:

```bash
bun run build
```

On success you get a **`dist/`** folder (HTML, JS, CSS). Nginx will serve **`dist/`** as the site root.

To make **`export`** persistent for future shells, you can add the line to **`~/.bashrc`** or a small **`deploy.sh`**; you must run **`export`** again (or source it) **every time** you rebuild if you don’t use a script.

---

## Step 6 — Add DNS for the mini app hostname

In your DNS panel (e.g. PowerDNS, Cloudflare, registrar):

| Type | Name / host | Value        |
|------|-------------|--------------|
| **A** | `miniapp`   | Your VPS IPv4 |

That creates **`miniapp.YOURDOMAIN.com`** → your server.

Wait until it resolves:

```bash
dig +short miniapp.ksisms.com A
# should print your VPS IP
```

(Replace **`miniapp.ksisms.com`** with your real FQDN.)

---

## Step 7 — Create an Nginx server block

Use a **separate** vhost from your API (**`bot.`**). The mini app is static files only.

```bash
sudo nano /etc/nginx/sites-available/miniapp-ksisms
```

Paste (adjust **`server_name`** and **`root`** if your paths differ):

```nginx
server {
    listen 80;
    server_name miniapp.ksisms.com;

    root /var/www/mini_app_ui/dist;
    index index.html;

    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Step 8 — Enable the site and reload Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/miniapp-ksisms /etc/nginx/sites-enabled/
sudo nginx -t
```

If the test says **syntax is ok**, reload:

```bash
sudo systemctl reload nginx
```

You should get **HTTP** (not HTTPS yet) on port 80 for **`miniapp.ksisms.com`**.

---

## Step 9 — HTTPS with Let’s Encrypt (Certbot)

```bash
sudo certbot --nginx -d miniapp.ksisms.com
```

Follow the prompts (email, agree to terms). Certbot will add **SSL** and usually **redirect HTTP → HTTPS**.

Reload Nginx if Certbot doesn’t do it:

```bash
sudo systemctl reload nginx
```

Open **`https://miniapp.ksisms.com`** in a browser — you should see the app with a valid padlock.

---

## Step 10 — Point the Telegram bot at the mini app URL

On the VPS, edit **`tg_bot`**’s **`.env`** (only file that project loads):

```bash
nano /var/www/tg_bot/.env
```

Set (no trailing slash):

```env
MINI_APP_URL=https://miniapp.ksisms.com
```

Save, then restart the **bot** process so the menu Web App button updates:

```bash
sudo systemctl restart tg-bot
```

If you set a Web App URL in **@BotFather**, make it the **same** as **`MINI_APP_URL`**.

---

## Step 11 — Smoke test

1. **`https://miniapp.ksisms.com`** loads in a normal browser.
2. Open the bot in **Telegram** → use **Open** / your Web App entry → tabs (**Sell**, **Rates**, **History**) load without **Invalid initialization data** (if they do, fix **`BOT_TOKEN`** / **`webapp.py`** on **`tg_bot`**).
3. **`journalctl -u tg-api -f`** while using the app: you should see **`GET/POST /api/webapp/...`** with **200** (or **403** if the user is not unlocked yet — that’s a different message from HMAC failure).

---

## Step 12 — CORS (usually nothing to do)

**`tg_bot`** is typically configured with open CORS for browser calls. If you later restrict origins, allow **`https://miniapp.ksisms.com`** for **`/api/webapp`**.

---

## Updating the app after code changes

```bash
cd /var/www/mini_app_ui
git pull
export VITE_API_URL="https://bot.ksisms.com/api/webapp"
bun install --frozen-lockfile   # or bun install
bun run build
```

No need to restart **`tg-api`** for static-only changes. Restart **`tg-bot`** only if **`MINI_APP_URL`** changed.

---

## Alternative: build on your laptop, upload only `dist/`

1. On your machine: clone the repo, install Bun, then:

   ```bash
   cd /path/to/mini_app_ui
   export VITE_API_URL="https://bot.ksisms.com/api/webapp"
   bun install
   bun run build
   ```

2. Upload **`dist/`** to the server:

   ```bash
   rsync -avz --delete dist/ root@YOUR_VPS_IP:/var/www/mini_app_ui/dist/
   ```

3. Nginx **root** must stay **`/var/www/mini_app_ui/dist`**. No rebuild on the VPS required unless you change server-side steps.

---

## Checklist (end-to-end)

- [ ] **Step 2** — Git + Bun on the VPS  
- [ ] **Step 3** — **`git clone`** into **`/var/www/mini_app_ui`** (or chosen path)  
- [ ] **Step 4** — **`bun install`**  
- [ ] **Step 5** — **`VITE_API_URL`** set, **`bun run build`**, **`dist/`** exists  
- [ ] **Step 6** — DNS **A** **`miniapp`** → VPS  
- [ ] **Step 7–8** — Nginx site enabled, **`nginx -t`** OK  
- [ ] **Step 9** — Certbot SSL for **`miniapp.…`**  
- [ ] **Step 10** — **`MINI_APP_URL`**, **`systemctl restart tg-bot`**  
- [ ] **Step 11** — Browser + Telegram tests pass  

---

## Troubleshooting

| Symptom | What to check |
|--------|----------------|
| **`git clone`** permission denied (SSH) | Add VPS SSH key to GitHub/GitLab, or use **HTTPS** clone URL. |
| **`bun: command not found`** | Re-run Bun installer and **`source ~/.bashrc`**. |
| Blank page or 404 after refresh | Nginx **`try_files $uri $uri/ /index.html;`** in **`location /`**. |
| API calls wrong host / CORS | Rebuild with correct **`VITE_API_URL`**; hard-refresh the mini app. |
| **Invalid initialization data** | **`tg_bot`** **`BOT_TOKEN`**, **`webapp.py`** initData validation; restart **`tg-api`**. |
| **403** “Complete account verification…” | User must finish bot flow / unlock mini app in DB — not a deploy bug. |
| Mixed content errors | Mini app and **`VITE_API_URL`** must both use **HTTPS**. |
