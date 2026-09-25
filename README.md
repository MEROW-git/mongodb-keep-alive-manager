# MongoDB Keep Alive Manager

A lightweight, production-ready SaaS web application built with **React + Vite**, **Tailwind CSS**, and **Netlify Serverless Functions** to monitor and keep your **MongoDB Atlas** cluster active 24/7 without idle spin-downs.

---

## ⚡ Highlights & Architecture

- **Frontend**: React 18, Vite, Tailwind CSS (Dark Modern UI `#0B1120`, Glassmorphism, MongoDB Green `#00ED64`).
- **Charts**: Recharts (Ping Latency History, Success vs Failed Distribution, 7-Day Activity).
- **Backend**: Netlify Serverless Functions in `/netlify/functions/` (Zero Express, Zero always-running background processes).
- **Database**: MongoDB Atlas (`system_reset` database, `sysreset` collection preserved).
- **Authentication**: Secure bcrypt password hashing and JWT authentication.
- **Connection Pooling**: Serverless-optimized cached MongoDB connection pool across warm function invocations.
- **Automation**: Dual-mode keep-alive:
  1. **Netlify Scheduled Functions**: Automated cron-based ping (`schedule('*/5 * * * *', handler)`).
  2. **External Cron / Webhook**: Secure endpoint `/.netlify/functions/ping?key=CRON_SECRET` compatible with UptimeRobot, cron-job.org, GitHub Actions, or AWS EventBridge.
  3. **In-Browser Automation**: Automatic ping interval runner while dashboard is open, plus instant manual **Ping Now** action.

---

## 📁 Project Structure

```
small_bot_keepdb_alive/
├── netlify/
│   └── functions/
│       ├── lib/
│       │   ├── auth.js            # JWT verification & CORS helpers
│       │   └── mongodb.js         # Connection pool caching for serverless
│       ├── auth.js                # Login authentication & session verify
│       ├── dashboard.js           # Dashboard statistics & analytics aggregator
│       ├── ping.js                # Core keep-alive ping executor & logger
│       ├── logs.js                # Paginated & filtered activity logs
│       ├── settings.js            # Keep-alive settings & DB metadata
│       └── scheduled-ping.js      # Netlify Scheduled Cron function
├── src/
│   ├── components/
│   │   ├── Navbar.jsx             # Top bar with status & Ping Now button
│   │   ├── Sidebar.jsx            # Navigation & cluster info panel
│   │   ├── StatusCard.jsx         # Metric display cards
│   │   ├── Chart.jsx              # Recharts visualizations
│   │   └── LogTable.jsx           # Paginated log table with filters
│   ├── pages/
│   │   ├── Login.jsx              # Authentication page
│   │   ├── Dashboard.jsx          # Atlas overview & analytics dashboard
│   │   ├── Logs.jsx               # Detailed activity logs
│   │   └── Settings.jsx           # Automation interval & DB configuration
│   ├── services/
│   │   └── api.js                 # API client service
│   ├── App.jsx                    # Root application
│   ├── index.css                  # Tailwind styles & glassmorphism tokens
│   └── main.jsx                   # React entry point
├── scripts/
│   ├── seed.cjs                   # Admin user & database initialization
│   ├── test_db.cjs                # Connection diagnostic script
│   └── test_functions.cjs         # Serverless functions test suite
├── netlify.toml                   # Netlify build & redirect routing
├── tailwind.config.js             # Custom dark palette & tokens
├── vite.config.js                 # Vite config with local serverless dev middleware
├── package.json                   # Dependencies and scripts
└── .env                           # Environment configuration
```

---

## 🛠️ Installation & Setup Guide

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

Your `.env` contains:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.zohxxqm.mongodb.net/?appName=Cluster0
MONGO_DB_NAME=system_reset
WEBADMIN_COLLECTION=sysreset
JWT_SECRET=your_super_secret_jwt_random_key_here
ADMIN_USERNAME=YELLOWMEOW
ADMIN_PASSWORD=Vireak2077
CRON_SECRET=8f4b1d6e90a53c72b84f2910d5e38a4b7c193f2081d4e65a73b98c0f21e54a6b
```

### Step 3: Seed Database & Create Admin User
Run the automated seed script to initialize the `users`, `settings`, and `logs` collections:
```bash
npm run seed
```
This creates:
- Admin user with bcrypt-hashed password (plain text password is never stored).
- Default automation settings (`enabled: true`, `interval: 5` minutes).
- Baseline keep-alive ping log.

### Step 4: Run Locally
Start the Vite development server:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.
The built-in dev middleware automatically handles `/api/*` requests through the Netlify function handlers in `netlify/functions/` with hot reloading!

Login with:
- **Username**: `YELLOWMEOW`
- **Password**: `Vireak2077`

### Step 5: Production Build Test
Verify that the production assets bundle without errors:
```bash
npm run build
```

---

## 🚀 Deploying to Netlify

1. Push this repository to **GitHub / GitLab**.
2. Log in to [Netlify](https://app.netlify.com/) and click **Add new site** > **Import an existing project**.
3. Select your repository.
4. Netlify will automatically detect settings from [`netlify.toml`](file:///e:/bot/small_bot_keepdb_alive/netlify.toml):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
5. Under **Site configuration > Environment variables**, add your environment variables:
   - `MONGO_URI`
   - `MONGO_DB_NAME` (`system_reset`)
   - `WEBADMIN_COLLECTION` (`sysreset`)
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `CRON_SECRET`
6. Click **Deploy Site**.

### Scheduled Keep-Alive on Netlify
The file [`netlify/functions/scheduled-ping.js`](file:///e:/bot/small_bot_keepdb_alive/netlify/functions/scheduled-ping.js) uses Netlify's `@netlify/functions` `schedule('*/5 * * * *', handler)` syntax. Netlify will trigger it every 5 minutes automatically.

### External Cron Webhook (Optional Alternative)
You can also ping your live deployment from any free uptime monitor (e.g., [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org)):
- **Method**: `GET` or `POST`
- **URL**: `https://<your-netlify-site>.netlify.app/.netlify/functions/ping?key=<YOUR_CRON_SECRET>`

---

## 🔒 Security Measures

- **No Secrets in Frontend**: `MONGO_URI` is strictly server-side and never bundled into client JavaScript.
- **Masked Database URIs**: The Settings API masks credentials (`mongodb+srv://user:••••••••@cluster...`).
- **Bcrypt Hashing**: Passwords stored using 10 salt rounds.
- **JWT Protection**: All management endpoints (`/api/dashboard`, `/api/logs`, `/api/settings`) require `Authorization: Bearer <token>`.
- **CORS Restricted**: Controlled headers and preflight handling.
- **Connection Reuse**: MongoDB connections are pooled to prevent socket exhaustion on serverless cold starts.
