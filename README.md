<div align="center">

  <h1>⚡ MongoDB Keep Alive Manager</h1>

  <p><strong>Smart, ultra-lightweight keep-alive automation & real-time health monitoring dashboard for MongoDB Atlas.</strong></p>

  <p>
    Prevent idle cluster spin-downs, maintain warm serverless connection pools, and track database latency 24/7 with zero always-running backend overhead.
  </p>

  <p>
    <img src="https://img.shields.io/badge/MongoDB-Atlas%20%26%20Serverless-00ED64?style=for-the-badge&logo=mongodb&logoColor=black" alt="MongoDB Atlas" />
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
    <img src="https://img.shields.io/badge/Vite-Bundler-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-Modern_Dark-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Netlify-Serverless_Functions-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify Serverless" />
    <img src="https://img.shields.io/badge/Auth-bcrypt_%2B_JWT-F59E0B?style=for-the-badge&logo=jsonwebtokens&logoColor=black" alt="Auth" />
  </p>

  <p>
    <a href="#-key-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-keep-alive-automation">Keep-Alive Engine</a> •
    <a href="#-deployment-to-netlify">Netlify Deployment</a> •
    <a href="#-security--privacy">Security</a>
  </p>

</div>

---

> **Why this matters:** MongoDB Atlas shared/free tier clusters automatically drop connections or suffer extreme cold starts (1,500ms+) when inactive. **MongoDB Keep Alive Manager** runs scheduled serverless ping operations, pools connections, and tracks ping latency in a Vercel/Linear-inspired dark dashboard—keeping your production databases warm without paying for a dedicated virtual server.

---

## 🚀 Key Features

| Capability | Technical Implementation | Benefit |
| :--- | :--- | :--- |
| **Active Keep-Alive Bot** | `db.command({ ping: 1 })` | Keeps MongoDB Atlas cluster warm and prevents idle pause. |
| **60fps Smooth Countdown** | `requestAnimationFrame` + DOM Ref | Butter-smooth, real-time live progress bar ticking down to the next cycle. |
| **Netlify Scheduled Functions** | `@netlify/functions` CRON Schedule | Runs automatically on schedule (`schedule('*/5 * * * *')`) with zero server costs. |
| **Connection Pooling** | Warm client reuse across serverless calls | Eliminates handshake overhead, reducing ping latency from ~800ms to **~40ms**. |
| **External Webhook Trigger** | Secured HTTP GET/POST with token | Trigger pings from UptimeRobot, cron-job.org, or GitHub Actions. |
| **Real-time Analytics** | Recharts Area, Donut, and Bar charts | Visualizes latency trends, success ratios, and 7-day activity volume. |
| **Bcrypt & JWT Auth** | Salted password hashing & 7-day tokens | Secure, stateless authentication. Never stores or exposes raw passwords. |
| **Safe Database Isolation** | Preserves existing collections | Target collections (like `sysreset`) remain untouched while telemetry logs separately. |

---

## 🏛️ Architecture Overview

```
                          ┌────────────────────────┐
                          │   React 18 + Vite UI   │
                          │ (Tailwind Glassmorphic)│
                          └───────────┬────────────┘
                                      │  JWT Authenticated
                                      ▼
                        ┌───────────────────────────┐
                        │ Netlify Functions (/api/) │
                        ├─────────────┬─────────────┤
                        │   auth.js   │ dashboard.js│
                        │   ping.js   │   logs.js   │
                        │ settings.js │ scheduled.js│
                        └─────────────┴──────┬──────┘
                                             │
                        ┌────────────────────▼────────────────────┐
                        │ Cached MongoDB Serverless Pool (10 max) │
                        └────────────────────┬────────────────────┘
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

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Ensure your `.env` contains:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.zohxxqm.mongodb.net/?appName=Cluster0
MONGO_DB_NAME=system_reset
WEBADMIN_COLLECTION=sysreset
JWT_SECRET=super_secret_jwt_key_mongodb_keep_alive_2026
ADMIN_USERNAME=YELLOWMEOW
ADMIN_PASSWORD=Vireak2077
CRON_SECRET=8f4b1d6e90a53c72b84f2910d5e38a4b7c193f2081d4e65a73b98c0f21e54a6b
```

### 3. Initialize Admin & Database
Seed your MongoDB database with your admin credentials and initial baseline ping:
```bash
npm run seed
```

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.
*(The built-in Vite dev middleware seamlessly executes the Netlify Functions locally without requiring an Express server!)*

---

## ⏱️ Keep-Alive Engine

The application supports **three concurrent ways** to keep your database warm:

1. **Netlify Scheduled Functions**: Runs every 5 minutes natively via Netlify's background cron worker.
2. **In-Dashboard Autonomous Runner**: When the dashboard tab is open in your browser, it automatically maintains a heartbeat ticker.
3. **External Webhook / Uptime Monitors**:
   You can hook any free external pinger (e.g., [cron-job.org](https://cron-job.org), [UptimeRobot](https://uptimerobot.com)) to:
   ```http
   GET https://<your-app>.netlify.app/.netlify/functions/ping?key=YOUR_CRON_SECRET
   ```

---

## 🚢 Deployment to Netlify

1. Push your repository to **GitHub**.
2. Connect your repo in the [Netlify Dashboard](https://app.netlify.com/).
3. Netlify will automatically detect settings from `netlify.toml`:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
   - **Functions Directory**: `netlify/functions`
4. Set your Environment Variables in **Site Settings > Environment Variables**:
   - `MONGO_URI`
   - `MONGO_DB_NAME` (`system_reset`)
   - `WEBADMIN_COLLECTION` (`sysreset`)
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `CRON_SECRET`
5. Click **Deploy Site**!

---

## 🔒 Security & Privacy

- **Zero Client-Side Secrets**: `MONGO_URI` and `JWT_SECRET` are strictly server-side and never bundled in client code.
- **Masked Connection Strings**: The API masks credentials (`mongodb+srv://user:••••••••@cluster0...`).
- **Bcrypt Hashing**: Passwords stored using salted bcrypt hashes.
- **Connection Isolation**: Queries run exclusively against system logs and ping status, leaving business collections (`sysreset`) untouched.

---

<div align="center">
  <p>Built with ❤️ for high-reliability MongoDB Atlas workloads.</p>
</div>
