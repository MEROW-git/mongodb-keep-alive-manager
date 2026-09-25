# ⚡ Multi-Database Keep-Alive Manager & Admin Dashboard

> A high-performance, lightweight, daemonless keep-alive manager and real-time dashboard designed for **MongoDB Atlas**, **PostgreSQL**, and **MySQL**. Prevents free-tier and serverless databases from pausing, sleeping, or spinning down due to inactivity.

---

## 🌟 Highlights

- **Multi-Database Support**: Automated keep-alive pings for **MongoDB Atlas**, **PostgreSQL** (Aiven, Neon, Supabase, Render), and **MySQL** (Aiven, PlanetScale, TiDB, Clever Cloud).
- **Raspberry Pi & Local Wi-Fi Ready**: Host on a Raspberry Pi, mini-PC, or home server and access the dashboard securely from any phone, laptop, or computer on your home router.
- **24/7 Autonomous Background Pings**: Built-in scheduler automatically executes pings every 5 minutes in memory—no browser tab or external runner required.
- **Telegram Bot Remote Management**: Control and monitor your databases via Telegram (`/status`, `/ping`, interactive touch controls, subscriber access approval gate, ban management, and failure alerts).
- **Hardened Zero-Leak Security**: Strict server-side credential isolation, bruteforce login throttling, request body size limits, authenticated Telegram webhooks, and header-based cron authorization.
- **Flexible Deployment**: Runs anywhere—Raspberry Pi OS, Debian/Ubuntu, Docker, local Node.js, or Netlify Serverless.

---

## 📐 System Architecture

```text
 ┌────────────────────────────────────────────────────────┐
 │   Local Wi-Fi Network / Same Router (Phones, Laptops)  │
 └───────────────────────────┬────────────────────────────┘
                             │  HTTPS (Port 5173 or 443)
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │          Raspberry Pi / Home Server (0.0.0.0)          │
 │  ┌──────────────────────────────────────────────────┐  │
 │  │      Vite React SPA Dashboard (Tailwind CSS)     │  │
 │  └────────────────────────┬─────────────────────────┘  │
 │                           │ JWT Authenticated REST     │
 │  ┌────────────────────────▼─────────────────────────┐  │
 │  │        Node.js Backend & Serverless API          │  │
 │  │  auth.js • dashboard.js • ping.js • logs.js      │  │
 │  │  settings.js • telegram.js • scheduled-ping.js   │  │
 │  └────────────────────────┬─────────────────────────┘  │
 │                           │ Connection Pooling (TLS)   │
 └───────────────────────────┼────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   🍃 MongoDB Atlas     🐘 PostgreSQL        🐬 MySQL
 (Atlas M0 Clusters)  (Aiven/Neon/Supabase) (Aiven/PlanetScale)
```

---

## 🍓 Raspberry Pi Deployment Guide

This project can be deployed on a Raspberry Pi (or any Linux/Debian/Ubuntu server) in two distinct modes depending on your requirements.

---

### Deployment Modes Overview

| Feature | Mode 1: LAN-Only Access | Mode 2: Public Domain with Caddy HTTPS |
| :--- | :--- | :--- |
| **URL** | `http://raspberrypi.local:5173` or `http://<LAN_IP>:5173` | `https://keepalive.yourdomain.com` |
| **Network Reach** | Devices on same Wi-Fi router / home network | Any device globally over the Internet |
| **Port Forwarding** | **None** (100% private to your LAN) | Port 80 & 443 forwarded to Pi |
| **TLS / SSL** | Unencrypted HTTP or self-signed `server.crt` | **Automatic HTTPS** (Let's Encrypt / ZeroSSL via Caddy) |
| **Telegram Bot** | **Polling Mode** (No public URL required!) | **Polling OR Webhook Mode** |
| **Reverse Proxy** | None (Node.js binds directly) | Caddy reverse proxy to `127.0.0.1:5173` |

---

### 1. Prerequisites on Raspberry Pi OS
```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (v20 LTS recommended) and Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

---

### 2. Clone and Install Dependencies
```bash
git clone <your-repository-url> /home/pi/small_bot_keepdb_alive
cd /home/pi/small_bot_keepdb_alive

npm install
npm run build
```

---

### 3. Environment Configuration (`.env`)
Copy the sample environment file:
```bash
cp .env.example .env
nano .env
```

Configure your server and database connection strings:
```env
# Web Server Configuration
HOST=0.0.0.0
PORT=5173
PUBLIC_URL=http://raspberrypi.local:5173

# 🍃 MongoDB Atlas (Required)
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=system_reset
WEBADMIN_COLLECTION=sysreset

# 🐘 PostgreSQL (Optional - e.g. Aiven, Supabase, Neon)
postgresql_url=postgresql://avnadmin:<password>@<host>:<port>/defaultdb?sslmode=require
postgresql_db=defaultdb

# 🐬 MySQL (Optional - e.g. Aiven, PlanetScale, TiDB)
mysql_url=mysql://avnadmin:<password>@<host>:<port>/defaultdb
mysql_db=defaultdb

# 🔒 Strict SSL Verification with Root CA
DB_SSL_REJECT_UNAUTHORIZED=true
DB_SSL_CA_PATH=./ca.pem

# 🔐 Security & Admin Login
JWT_SECRET=generate_with_openssl_rand_hex_32_min_16_chars
ADMIN_USERNAME=pi_admin
ADMIN_PASSWORD=strong_password_here_12_chars
CRON_SECRET=custom_random_cron_secret

# 🤖 Telegram Bot (Leave webhook secret blank if using Polling)
telegram_bot=your_telegram_bot_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=optional_only_for_public_webhook_mode
```

---

### 4. Mode 1: LAN-Only Deployment (Home Wi-Fi)

In LAN-Only mode, the dashboard and API are accessible strictly to devices connected to your home Wi-Fi or router.

1. **Start the server**:
   ```bash
   npm start
   ```
   The server automatically detects your IP and displays:
   ```text
   ============================================================
   🚀 Multi-DB Keep Alive Manager Server is Running (HTTP)!
   ============================================================
   🌐 Local:        http://localhost:5173
   📡 Wi-Fi / LAN:  http://192.168.1.45:5173
   🌍 Public URL:   http://raspberrypi.local:5173
   🩺 Health Check: http://localhost:5173/health
   ⚙️  Databases:    MongoDB Atlas + PostgreSQL + MySQL
   ============================================================
   ```

2. **Access the Dashboard**:
   - Via mDNS: `http://raspberrypi.local:5173`
   - Via LAN IP: `http://192.168.1.45:5173` (replace with your Pi's LAN IP from `hostname -I`)

3. **Telegram Bot in LAN Mode**:
   - The server uses **Telegram Polling Mode** by default.
   - Polling makes outbound HTTPS calls to `api.telegram.org` to fetch updates and send notifications.
   - **No router port forwarding or public domain is needed!**

---

### 5. Mode 2: Public Domain with Automatic HTTPS via Caddy

If you want to access your dashboard from outside your home or use Telegram Webhook mode, use **Caddy** as a lightweight reverse proxy. Caddy automatically provisions and renews SSL certificates from Let's Encrypt / ZeroSSL.

1. **Install Caddy on Raspberry Pi**:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```

2. **Configure Caddy** (`Caddyfile.example` is provided in the repository):
   Edit `/etc/caddy/Caddyfile`:
   ```caddy
   keepalive.yourdomain.com {
       encode gzip zstd

       # Reverse proxy to the local Keep-Alive server
       reverse_proxy 127.0.0.1:5173

       # Hardened Security Headers
       header {
           Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
           X-Content-Type-Options "nosniff"
           X-Frame-Options "DENY"
           Referrer-Policy "strict-origin-when-cross-origin"
       }

       log {
           output file /var/log/caddy/keepalive.log {
               roll_size 10mb
               roll_keep 5
           }
       }
   }
   ```

3. **Update `.env` for Public Domain**:
   ```env
   HOST=127.0.0.1
   PORT=5173
   PUBLIC_URL=https://keepalive.yourdomain.com
   ```

4. **Reload Caddy**:
   ```bash
   sudo systemctl reload caddy
   ```

---

### 6. Run 24/7 on Boot: Systemd Service (Recommended)

A template is provided in [`keepalive.service.example`](keepalive.service.example). To configure systemd to start the application automatically on boot and auto-restart on any error:

```bash
# 1. Copy the unit file
sudo cp keepalive.service.example /etc/systemd/system/keepalive.service

# 2. If your Pi username is not "pi", adjust User= and WorkingDirectory=
sudo nano /etc/systemd/system/keepalive.service

# 3. Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable --now keepalive

# 4. Verify service status
sudo systemctl status keepalive
```

Useful Systemd Commands:
```bash
sudo systemctl restart keepalive   # Restart service
sudo systemctl stop keepalive      # Stop service
journalctl -u keepalive -f         # View live keep-alive logs & ping times
```

*(Alternatively, PM2 can still be used: `pm2 start server.cjs --name "keepdb-alive" && pm2 save && pm2 startup`)*

---

### 7. Health Check Endpoint
A lightweight, non-blocking health check endpoint is available at:
```http
GET /health
```
**Sample Response (HTTP 200)**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2026-09-25T18:25:02.992Z"
}
```
This can be queried by local monitoring tools, uptime daemons, or router scripts without exposing sensitive database or authentication information.

---

## 🤖 Telegram Bot Remote Controls

The bot includes full Telegram integration for mobile notifications and controls:

### Commands & Touch Buttons
- **`🍃 Cluster Status`** (`/status`): View real-time database latency and status.
- **`⚡ Instant Ping`** (`/ping`): Force an immediate keep-alive ping cycle across all active databases.
- **`🆔 My ID`** (`/id`): Display your Telegram Chat ID and User ID.

### Admin Approval Workflow
1. When a new person contacts your bot, they are greeted in **Pending Approval** mode.
2. In the **Telegram Bot** tab of your dashboard, their profile appears in the **Detected Users** list.
3. Click **Allow Access** to approve them, or **Revoke Access** to block them.
4. Admins can ban unauthorized or abusive users directly from the dashboard.

### Telegram Architecture: Polling vs. Webhook

| Mode | How it Works | Network Requirement | When to Use |
| :--- | :--- | :--- | :--- |
| **Polling Mode** *(Default)* | The server contacts Telegram's API outbound every 3 seconds to fetch messages. | **No public IP / no domain required.** Works behind any home router or firewall. | **LAN-Only Hosting** (Raspberry Pi at home) |
| **Webhook Mode** | Telegram pushes incoming updates to your public HTTPS URL. | **Requires a public HTTPS domain** (e.g. `https://keepalive.yourdomain.com/api/telegram?action=webhook`) | **Public Domain Hosting** with Caddy or Cloudflare |

> [!CAUTION]
> **CRITICAL: Do NOT enable Polling and Webhook mode simultaneously.**
> Telegram allows only **one** delivery mechanism per bot token. If a webhook is active, Telegram rejects `getUpdates` polling requests with `409 Conflict: can't use getUpdates method while webhook is active`.
> - If you host on a local Raspberry Pi on LAN: **Do NOT set a Telegram webhook**. The built-in polling loop handles all messages without needing a public domain.
> - If you switch to Webhook mode: Ensure you register the webhook with your public HTTPS URL and `secret_token`.

### Setting Up Telegram Webhook (Only for Public HTTPS Hosting)
If hosting behind Caddy or a public domain, register the webhook with your secret token:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://keepalive.yourdomain.com/api/telegram?action=webhook",
    "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET"
  }'
```
To remove a webhook and switch back to Polling mode:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

---

## ⚡ External Keep-Alive Webhook Trigger

To trigger keep-alive cycles from external monitoring services (e.g. UptimeRobot, cron-job.org, or curl):

### Recommended (Secure Header):
```bash
curl -X POST https://<your-host>/api/ping \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```
*(Sending secrets via request headers prevents tokens from being recorded in web server logs, browser history, or proxy referrers).*

---

## 🔐 Security Protections Summary

1. **No Hardcoded JWT Fallback**: Refuses to start or sign tokens if `JWT_SECRET` is missing or shorter than 16 characters.
2. **No Default Admin Credentials**: Auto-seeding requires explicit environment variables and rejects weak/default passwords (`admin123456`).
3. **Authenticated Telegram Webhook**: Incoming webhooks require matching `X-Telegram-Bot-Api-Secret-Token`.
4. **Protected Scheduled Ping**: `/api/scheduled-ping` is blocked from unauthenticated public HTTP access.
5. **Local HTTPS Support**: Native TLS support via `SSL_KEY_PATH` & `SSL_CERT_PATH` for encrypted Wi-Fi traffic.
6. **Configurable DB TLS Validation**: Full support for custom CA certificates (`DB_SSL_CA_PATH`) with strict validation.
7. **DoS Prevention & Rate Limiting**: 100KB request body size limit and 5-attempt brute-force login throttling with 15-minute lockouts.
8. **Malformed URL Crash Guard**: Safe URI normalization with try/catch error handling preventing `URIError` crashes.
9. **Password Redaction in Scripts**: Plaintext passwords are never printed to terminal stdout during seeding or testing.
10. **Header-Based Secret Authorization**: Recommends and prioritizes HTTP request headers over query strings.

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server with hot reload and Netlify function emulator. |
| `npm run build` | Compiles production frontend bundle to `dist/`. |
| `npm start` | Runs standalone lightweight Node.js server with built-in 5-min scheduler. |
| `npm run test:db` | Tests live connections to MongoDB, PostgreSQL, and MySQL. |
| `npm run test:fn` | Tests all 6 backend serverless functions locally. |
| `npm run seed` | Seeds initial admin user credentials into MongoDB (password redacted). |

---

<div align="center">
  <p>Built for secure, reliable, worry-free database keep-alive management on Raspberry Pi and Cloud.</p>
</div>
