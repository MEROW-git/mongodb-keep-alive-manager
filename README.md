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

## 🍓 Raspberry Pi / Local Wi-Fi Setup Guide

This guide walks you through hosting the bot on a Raspberry Pi connected to your home Wi-Fi router so you can manage your databases from any device on your local network.

### 1. Prerequisites on Raspberry Pi
Ensure Node.js (v18 or v20+) and Git are installed on your Raspberry Pi:
```bash
# Update package repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20 LTS) & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
```

Verify installation:
```bash
node -v   # Should be v18+ or v20+
npm -v
```

---

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/MEROW-git/mongodb-keep-alive-manager.git
cd mongodb-keep-alive-manager
npm install
```

---

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
nano .env
```

Configure your credentials:
```env
# 🍃 MongoDB Atlas (Required)
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.zohxxqm.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=system_reset
WEBADMIN_COLLECTION=sysreset

# 🐘 PostgreSQL (Optional - leave blank if not used)
postgresql_url=postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require
postgresql_db=defaultdb

# 🐬 MySQL (Optional - leave blank if not used)
mysql_url=mysql://<user>:<password>@<host>:<port>/<database>
mysql_db=mysql

# 🔒 TLS / SSL Certificate Validation
DB_SSL_REJECT_UNAUTHORIZED=true
# Optional custom CA path for databases with private CA certs (e.g. Aiven ca.pem):
# DB_SSL_CA_PATH=./ca.pem

# 🔐 Security & Admin Login (Required: minimum 16 random characters)
JWT_SECRET=generate_with_openssl_rand_hex_32
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_strong_admin_password_min_12_chars

# ⚡ Secret Token for Cron Webhook Triggers (Sent via header: "x-cron-secret")
CRON_SECRET=your_custom_cron_secret_trigger_token

# 🤖 Telegram Bot Token (from @BotFather)
telegram_bot=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ

# 🛡️ Telegram Webhook Secret Token (Sent by Telegram via header "X-Telegram-Bot-Api-Secret-Token")
TELEGRAM_WEBHOOK_SECRET=your_telegram_webhook_secret_token_here
```

> **Security Tip**: Generate a strong JWT secret using OpenSSL:
> ```bash
> openssl rand -hex 32
> ```

---

### 4. Test Database Connections
Verify all configured databases can connect and ping:
```bash
npm run test:db
```
You should see:
```text
🍃 Testing MongoDB Atlas Connection...  -> ✅ connected & pinged!
🐘 Testing PostgreSQL Connection...     -> ✅ connected & pinged!
🐬 Testing MySQL Connection...          -> ✅ connected & pinged!
```

---

### 5. Find Your Raspberry Pi's Local IP Address
Run:
```bash
hostname -I
```
Look for your Wi-Fi IPv4 address (e.g. `192.168.1.45` or `192.168.0.100`).

---

### 6. Run the Application

#### Option A: Production Mode (Recommended for 24/7 Raspberry Pi)
Build the frontend once, then run the ultra-lightweight standalone server (~35MB RAM, low CPU):
```bash
npm run build
npm start
```
The server will output:
```text
============================================================
🚀 Multi-DB Keep Alive Manager Server is Running (HTTP)!
============================================================
🌐 Local:        http://localhost:5173
📡 Wi-Fi / LAN:  http://192.168.1.45:5173
⚙️  Databases:    MongoDB Atlas + PostgreSQL + MySQL
============================================================
```
Now, open your phone or PC connected to the same Wi-Fi and browse to:
**`http://192.168.1.45:5173`**

#### Option B: Encrypted HTTPS on Local Wi-Fi (Recommended for Security)
To protect login passwords and JWT sessions from local network packet sniffing on Wi-Fi, enable HTTPS:

1. Generate a local SSL certificate using `mkcert` or `openssl`:
   ```bash
   openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=raspberrypi.local' \
     -keyout server.key -out server.crt -days 365
   ```
2. Add paths to your `.env`:
   ```env
   SSL_KEY_PATH=./server.key
   SSL_CERT_PATH=./server.crt
   ```
3. Run `npm start`. The server will automatically run with TLS encryption (`https://192.168.1.45:5173`).

Alternatively, use **Caddy** as a reverse proxy for automatic HTTPS with a single command:
```bash
caddy reverse-proxy --from :443 --to :5173
```

---

### 7. Run 24/7 on Boot with PM2
To keep the server and keep-alive pinger running in the background continuously:

```bash
# Install PM2 process manager
sudo npm install -g pm2

# Start the server with PM2
pm2 start server.cjs --name "keepdb-alive"

# Save process list and enable system startup
pm2 save
pm2 startup
# (Run the sudo command that PM2 displays on screen)
```

Useful PM2 commands:
```bash
pm2 status               # Check status
pm2 logs keepdb-alive    # View live logs and ping times
pm2 restart keepdb-alive # Restart server
pm2 stop keepdb-alive    # Stop server
```

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

### Setting Up Telegram Webhook (Authenticated)
When setting your webhook URL with Telegram, always include `secret_token`:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-host>/api/telegram?action=webhook",
    "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET"
  }'
```
Our backend verifies `X-Telegram-Bot-Api-Secret-Token` on every incoming webhook to prevent spoofed messages.

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
