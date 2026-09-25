<div align="center">

  <h1>⚡ MongoDB Keep Alive Manager</h1>

  <p><strong>Smart, ultra-lightweight keep-alive automation, Telegram Bot control center & real-time health monitoring dashboard for MongoDB Atlas.</strong></p>

  <p>
    Prevent idle cluster spin-downs, maintain warm serverless connection pools, receive live Telegram keep-alive alerts, and track database latency 24/7 with zero always-running backend overhead.
  </p>

  <p>
    <img src="https://img.shields.io/badge/MongoDB-Atlas%20%26%20Serverless-00ED64?style=for-the-badge&logo=mongodb&logoColor=black" alt="MongoDB Atlas" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/Vite-Bundler-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-Modern_Dark-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Telegram-Bot%20API-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram Bot" />
    <img src="https://img.shields.io/badge/Netlify-Serverless_Functions-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify Serverless" />
    <img src="https://img.shields.io/badge/Auth-bcrypt_%2B_JWT-F59E0B?style=for-the-badge&logo=jsonwebtokens&logoColor=black" alt="Auth" />
  </p>

  <p>
    <a href="#-key-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-telegram-bot-integration">Telegram Bot</a> •
    <a href="#-keep-alive-engine">Keep-Alive Engine</a> •
    <a href="#-deployment-to-netlify">Netlify Deployment</a> •
    <a href="#-security--privacy">Security</a>
  </p>

</div>

---

> **Why this matters:** MongoDB Atlas shared and free tier clusters automatically drop connections or suffer extreme cold starts (1,500ms+) when inactive. **MongoDB Keep Alive Manager** executes scheduled serverless keep-alive pulses, pools connections, streams live notifications to Telegram, and visualizes ping latency in a sleek dark dashboard—keeping your production databases blazing fast without paying for a dedicated virtual server.

---

## 🚀 Key Features

| Capability | Technical Implementation | Benefit |
| :--- | :--- | :--- |
| **Active Keep-Alive Bot** | `db.command({ ping: 1 })` | Keeps MongoDB Atlas cluster warm and prevents idle sleep. |
| **60fps Smooth Countdown** | `requestAnimationFrame` + DOM Ref | Butter-smooth, real-time live progress bar ticking down to the next cycle. |
| **12-Hour AM/PM Clocks** | Locale-aware 12-hour formatting | Intuitive timestamp formatting (`04:42:24 PM`) across all cards, charts, feeds, and logs. |
| **Telegram Bot Control Center** | Telegram Bot API + Long-polling & Webhook | Live chat detection, subscriber approvals, ban control, and broadcast messaging. |
| **User Access Approval Gate** | Role-based Telegram authorization | Restricts bot commands (`/ping`, `/status`) and keeps database credentials private until approved. |
| **Push Notifications** | Automated Telegram broadcast alerts | Delivers real-time keep-alive pulses and latency reports to approved subscribers. |
| **Netlify Scheduled Functions** | `@netlify/functions` CRON Schedule | Runs automatically on schedule (`schedule('*/5 * * * *')`) with zero server maintenance. |
| **Connection Pooling** | Warm client reuse across serverless calls | Eliminates TLS handshake overhead, slashing ping latency from ~800ms to **~40ms**. |
| **External Webhook Trigger** | Secured HTTP GET/POST with token | Trigger pings from UptimeRobot, cron-job.org, or GitHub Actions via `CRON_SECRET`. |
| **Real-time Analytics** | Recharts Area, Donut, and Bar charts | Visualizes latency trends, success ratios, and 7-day activity volume. |
| **Mobile-First Responsive UI** | Adaptive card-based mobile layout | Optimized layout for mobile, tablet, and desktop without horizontal clipping or scrollbar clutter. |
| **Bcrypt & JWT Auth** | Salted password hashing & 7-day tokens | Secure, stateless authentication. Never stores or exposes raw passwords. |
| **Safe Database Isolation** | Preserves existing collections | Target collections (like `sysreset`) remain untouched while telemetry logs separately. |

---

## 🏛️ Architecture Overview

```
                          ┌────────────────────────┐
                          │   React 18 + Vite UI   │
                          │ (Tailwind Glassmorphic)│
                          └───────────┬────────────┘
                                      │  JWT Authenticated / REST
                                      ▼
                        ┌───────────────────────────┐
                        │ Netlify Functions (/api/) │
                        ├─────────────┬─────────────┤
                        │   auth.js   │ dashboard.js│
                        │   ping.js   │   logs.js   │
                        │ settings.js │ telegram.js │
                        └──────┬──────┴──────┬──────┘
                               │             │
                               │             ▼
                               │ ┌───────────────────────────┐
                               │ │     Telegram Bot API      │
                               │ │  (@meow_db_notification)  │
                               │ └───────────────────────────┘
                               ▼
            ┌─────────────────────────────────────┐
            │ Cached MongoDB Serverless Pool (10) │
            └──────────────────┬──────────────────┘
                               │  ping: 1 (TLS)
                               ▼
                 ┌───────────────────────────┐
                 │    MongoDB Atlas Cloud    │
                 │  Cluster0 (system_reset)  │
                 └───────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/MEROW-git/mongodb-keep-alive-manager.git
cd mongodb-keep-alive-manager
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# MongoDB Atlas Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.zohxxqm.mongodb.net/?retryWrites=true&w=majority
MONGO_DB_NAME=system_reset
WEBADMIN_COLLECTION=sysreset

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_here

# Initial Admin Credentials (used by seed script or auto-initialization)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# Secret Token for Cron / External Keep Alive Webhook Triggers
CRON_SECRET=your_custom_cron_secret_trigger_token

# Telegram Bot Token (from @BotFather)
telegram_bot=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
```

### 3. Initialize Admin & Database
Seed your MongoDB database with your admin credentials and baseline ping:
```bash
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.
*(The built-in Vite development proxy seamlessly executes Netlify Functions locally without requiring a separate backend process!)*

---

## 🤖 Telegram Bot Integration

MongoDB Keep Alive Manager features a built-in Telegram Bot controller (`@meow_db_notification_bot`):

### 1. Bot Features
- **Warm Welcome Gate**: When a new user sends `/start`, the bot greets them with a warm welcome without exposing database names or internal IDs until an administrator approves them.
- **Admin Approval Workflow**: In the **Telegram Bot** tab, newly detected users appear under **Detected Telegram Users & Access Approvals**:
  - Click **Allow** to grant access to bot commands and automated keep-alive alerts.
  - Click **Revoke** to withdraw access at any time.
  - Click **Target** to set the user as the recipient for custom broadcast messages.
- **Interactive Inline Buttons**: Authorized users can trigger keep-alive pings and check cluster status directly inside Telegram using touch buttons:
  - 🟢 **Cluster Status** (`/status`)
  - ⚡ **Keep-Alive Pulse** (`/ping`)
  - ⏱️ **Ping Latency** (`/latency`)
- **Real-Time Live Chat Feed**: Streams incoming messages and commands in real time with 3-second auto-refresh. Admins can click **Reply** to quickly message any user.
- **Push Notification Subscriptions**: Automatically dispatches keep-alive pulse confirmations and emergency failure alerts to approved users.
- **User Ban Control**: Blacklist unauthorized or abusive users by User ID or username to permanently block them from interacting with the bot.

### 2. Setting Up Webhook (Optional for Production)
The bot works out of the box using server-side sync. For instant webhook delivery on Netlify:
```http
POST https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-app>.netlify.app/.netlify/functions/telegram?action=webhook
```

---

## ⏱️ Keep-Alive Engine

The application supports **three concurrent methods** to maintain database warmth:

1. **Netlify Scheduled Functions**: Runs every 5 minutes natively via Netlify's background cron worker (`scheduled-ping.js`).
2. **In-Dashboard Autonomous Runner**: When the dashboard tab is open in your browser, it runs a synchronized 60fps countdown ticker that automatically triggers a keep-alive pulse at the end of each interval.
3. **External Webhooks / Uptime Monitors**:
   Hook any free external monitoring service (e.g. [cron-job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com)) to:
   ```http
   GET https://<your-app>.netlify.app/.netlify/functions/ping?key=YOUR_CRON_SECRET
   ```

---

## 🚢 Deployment to Netlify

1. Push your repository to **GitHub**.
2. Connect your repo in the [Netlify Dashboard](https://app.netlify.com/).
3. Netlify automatically detects build configuration from `netlify.toml`:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Functions Directory**: `netlify/functions`
4. Configure your environment variables in **Site Settings > Environment Variables**:
   - `MONGO_URI`
   - `MONGO_DB_NAME` (`system_reset`)
   - `WEBADMIN_COLLECTION` (`sysreset`)
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `CRON_SECRET`
   - `telegram_bot` (Your Telegram Bot Token)
5. Click **Deploy Site**!

---

## 🔒 Security & Privacy

- **Zero Client-Side Secrets**: `MONGO_URI`, `JWT_SECRET`, and `telegram_bot` are strictly server-side and never leaked in client bundles.
- **Masked Connection Strings**: The API masks credentials (`mongodb+srv://user:••••••••@cluster0...`).
- **Salted Bcrypt Hashing**: Passwords stored using salted bcrypt hashes.
- **Authorization Gate**: Unauthorized Telegram users cannot execute database commands or view database names.
- **Connection Isolation**: Queries run exclusively against system logs and ping status, leaving business collections (`sysreset`) untouched.

---

<div align="center">
  <p>Built with ❤️ for high-reliability MongoDB Atlas workloads.</p>
</div>
