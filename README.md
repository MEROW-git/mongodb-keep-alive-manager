# ⚡ Multi-Database Keep-Alive Manager & Admin Dashboard

> A high-performance, lightweight, daemonless keep-alive manager and real-time dashboard designed for **MongoDB Atlas**, **PostgreSQL**, and **MySQL**. Prevents free-tier and serverless databases from pausing, sleeping, or spinning down due to inactivity.

---

## 🌟 Highlights

- **Multi-Database Support**: Automated keep-alive pings for **MongoDB Atlas**, **PostgreSQL** (Aiven, Neon, Supabase, Render), and **MySQL** (Aiven, PlanetScale, TiDB, Clever Cloud).
- **Raspberry Pi & Local Wi-Fi Ready**: Host on a Raspberry Pi, mini-PC, or home server and access the dashboard from any phone, laptop, or computer connected to the same Wi-Fi router.
- **24/7 Autonomous Background Pings**: Built-in scheduler automatically executes pings every 5 minutes—no browser tab needed.
- **Telegram Bot Integration**: Remote management via Telegram bot (`/status`, `/ping`, instant touch controls, access approval gate, ban list, and real-time failure alerts).
- **Zero-Leak Security**: Strict server-side credential isolation. Connection strings, passwords, and tokens never leak into client bundles.
- **Flexible Deployment**: Runs anywhere—Raspberry Pi OS, Debian/Ubuntu, Docker, local Node.js, or Netlify Serverless.

---

## 📐 System Architecture

```text
 ┌────────────────────────────────────────────────────────┐
 │   Local Wi-Fi Network / Same Router (Phones, Laptops)  │
 └───────────────────────────┬────────────────────────────┘
                             │  HTTP (Port 5173)
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

This guide is for hosting the bot on a Raspberry Pi connected to your home Wi-Fi router so you can access the dashboard from any device on your local network.

### 1. Prerequisites on Raspberry Pi
Ensure Node.js (v18 or v20+) and Git are installed on your Raspberry Pi:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (via NodeSource if not already installed)
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

# 🔐 Security & Admin Login
JWT_SECRET=your_super_secret_jwt_random_key_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# ⚡ Keep-Alive Webhook Trigger Token
CRON_SECRET=your_custom_cron_secret_trigger_token

# 🤖 Telegram Bot Token (from @BotFather)
telegram_bot=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
```

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
🚀 Multi-DB Keep Alive Manager Server is Running!
============================================================
🌐 Local:        http://localhost:5173
📡 Wi-Fi / LAN:  http://192.168.1.45:5173
⚙️  Databases:    MongoDB Atlas + PostgreSQL + MySQL
============================================================
```
Now, open your phone or PC connected to the same Wi-Fi and browse to:
**`http://192.168.1.45:5173`**

#### Option B: Development Mode
```bash
npm run dev -- --host
```

---

### 7. Run 24/7 on Boot with PM2 (Optional)
To ensure the bot keeps running automatically even if your Raspberry Pi reboots or loses power:

```bash
# Install PM2 process manager
sudo npm install -g pm2

# Start the server with PM2
pm2 start server.cjs --name "keepdb-alive"

# Save PM2 process list
pm2 save

# Generate and configure systemd startup service
pm2 startup
# (Run the sudo command that PM2 prints on screen)
```

Useful PM2 commands:
```bash
pm2 status               # Check status
pm2 logs keepdb-alive    # View live logs and ping times
pm2 restart keepdb-alive # Restart server
pm2 stop keepdb-alive    # Stop server
```

---

## ☁️ Cloud Deployment (Netlify)

You can also deploy to Netlify for 100% free serverless hosting:

1. Push your repository to **GitHub**.
2. Connect your repo in the [Netlify Dashboard](https://app.netlify.com/).
3. Netlify automatically reads configuration from `netlify.toml`:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Functions Directory**: `netlify/functions`
4. Set your environment variables in Netlify: **Site Settings > Environment Variables**:
   - `MONGO_URI`, `MONGO_DB_NAME`, `WEBADMIN_COLLECTION`
   - `postgresql_url`, `postgresql_db` (optional)
   - `mysql_url`, `mysql_db` (optional)
   - `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - `CRON_SECRET`, `telegram_bot`
5. Netlify's scheduled cron runs `scheduled-ping.js` every 5 minutes automatically.

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

---

## 🔐 Security Protections

- **No Client-Side Secrets**: All database URLs and passwords remain strictly on the backend. Vite never bundles `.env` variables without the `VITE_` prefix.
- **Masked Database URIs**: API responses mask credentials (`mongodb+srv://••••••••:••••••••@cluster...`).
- **NoSQL Injection Guard**: Strict type checks prevent query selector injection on authentication endpoints.
- **Protected Cron Webhooks**: External ping triggers require a secret key (`?key=CRON_SECRET`).
- **Sanitized Error Responses**: Internal database errors, connection strings, and stack traces are suppressed in API responses.

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server with hot reload and Netlify function emulator. |
| `npm run build` | Compiles production frontend bundle to `dist/`. |
| `npm start` | Runs standalone lightweight Node.js server with built-in 5-min scheduler. |
| `npm run test:db` | Tests live connections to MongoDB, PostgreSQL, and MySQL. |
| `npm run test:fn` | Tests all 6 backend serverless functions locally. |
| `npm run seed` | Seeds initial admin user credentials into MongoDB. |

---

<div align="center">
  <p>Built for reliable, worry-free database keep-alive management on Raspberry Pi and Cloud.</p>
</div>
