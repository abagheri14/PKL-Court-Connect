# PKL Court Connect

> A full-stack pickleball social networking and game management platform built with React, TypeScript, Express, and MySQL.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the App](#running-the-app)
- [Building for Production](#building-for-production)
- [Mobile App (Capacitor)](#mobile-app-capacitor)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [API Architecture](#api-architecture)
- [Deployment Guide](#deployment-guide)

---

## Overview

PKL Court Connect is a comprehensive pickleball community platform that connects players, manages games, and builds communities. It features:

- **Player Matching** — Tinder-style swipe system to find compatible players
- **Game Management** — Create, join, and score games with real-time updates
- **Court Finder** — Interactive map with court details, reviews, and bookings
- **Social Feed** — Post updates, highlights, tips with likes/comments
- **Chat** — Real-time messaging with direct and group conversations
- **Tournaments** — Full bracket tournament management
- **Coaching** — Shared coaching session organization
- **Gamification** — XP, levels, achievements, streaks, daily quests
- **Premium** — Stripe-powered subscription with enhanced features
- **i18n** — English and French language support
- **Mobile** — Capacitor-powered Android app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.9, Tailwind CSS 4, Radix UI, Framer Motion |
| **Backend** | Express 4, tRPC 11, Socket.io 4.8, Node.js |
| **Database** | MySQL 8.x, Drizzle ORM 0.44 |
| **Auth** | JWT (jose), bcrypt password hashing |
| **Payments** | Stripe (subscriptions + webhooks) |
| **Maps** | Mapbox GL JS 3.21 |
| **Push** | Web Push (VAPID) + Firebase Cloud Messaging |
| **Email** | Nodemailer (SMTP) |
| **Mobile** | Capacitor 8.3 (Android) |
| **Build** | Vite 7 (client) + esbuild (server) |
| **Package Manager** | pnpm |

---

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** ≥ 20.x — [Download](https://nodejs.org/)
2. **pnpm** ≥ 10.x — Install: `npm install -g pnpm`
3. **MySQL** 8.x — [Download](https://dev.mysql.com/downloads/mysql/)
   - Or use Docker: `docker run -d --name pkl-mysql -e MYSQL_ROOT_PASSWORD=yourpassword -p 3306:3306 mysql:8.4`

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# 3. Create the database
mysql -u root -p -e "CREATE DATABASE pkl_court_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 4. Run database migrations (choose one method):

# Option A: Use the consolidated init.sql (fresh setup)
mysql -u root -p pkl_court_connect < database/init.sql

# Option B: Use Drizzle to push schema (recommended for development)
pnpm db:push

# 5. Start the development server
pnpm dev

# The app will be available at http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string: `mysql://user:pass@host:port/db` |
| `JWT_SECRET` | Random string for signing auth tokens (use `openssl rand -hex 32`) |
| `VITE_APP_ID` | App identifier (e.g., `pkl-court-connect`) |

### Optional (feature-specific)

| Variable | Feature |
|----------|---------|
| `STRIPE_SECRET_KEY` | Premium subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `VITE_FIREBASE_*` | Push notifications via Firebase |
| `VAPID_*` | Web Push notifications |
| `SMTP_*` | Email (password resets, verification) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps integration |
| `BUILT_IN_FORGE_API_*` | AI/LLM features |

See `.env.example` for the complete list with documentation.

---

## Database Setup

### Option A: Consolidated SQL (Fresh Database)

For a brand new setup, use the consolidated migration file:

```bash
# Create the database
mysql -u root -p -e "CREATE DATABASE pkl_court_connect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run the consolidated schema
mysql -u root -p pkl_court_connect < database/init.sql
```

### Option B: Drizzle Push (Development)

Drizzle can push the schema directly from the TypeScript definitions:

```bash
pnpm db:push
```

### Option C: Individual Migrations

The `drizzle/` folder contains all individual migration files in order. Run them sequentially:

```
drizzle/0000_harsh_zarek.sql
drizzle/0001_safe_chameleon.sql
drizzle/0002_coaching_groups_enhancements.sql
drizzle/0003_add_performance_indexes.sql
drizzle/0004_dashing_silver_samurai.sql
drizzle/0004_rename_encrypted_content.sql
drizzle/0005_schema_hardening.sql
drizzle/0006_game_results_and_notif_prefs.sql
drizzle/0007_add_challenges_table.sql
drizzle/0008_add_court_submissions.sql
drizzle/0009_add_coaching_location_fields.sql
drizzle/0009_add_group_games.sql
drizzle/0009_add_score_confirmed.sql
drizzle/0009_add_super_rally.sql
drizzle/0010_add_tournament_invite_notification_type.sql
drizzle/0011_feature_gaps.sql
drizzle/0012_feed_social_tables.sql
```

### Auto-Seeding

The server automatically seeds the following on startup:
- **Achievements** — All achievement definitions
- **Courts** — Sample court data
- **Test Accounts** — Development test users

---

## Running the App

### Development

```bash
pnpm dev
```

This starts the full-stack dev server with:
- Vite HMR for the React frontend
- Express API server with hot-reload (via `tsx watch`)
- Socket.io for real-time features

Access at: **http://localhost:3000**

### Type Checking

```bash
pnpm check
```

### Tests

```bash
pnpm test
```

---

## Building for Production

```bash
# Build both client and server
pnpm build

# Start the production server
pnpm start
```

The build process:
1. `vite build` — Bundles the React client to `dist/public/`
2. `esbuild` — Bundles the server to `dist/index.js`

In production, Express serves the static client files and the API.

### Production Environment

Set these in your production `.env`:

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=mysql://user:pass@your-db-host:3306/pkl_court_connect
JWT_SECRET=your-production-secret
```

---

## Mobile App (Capacitor)

The app includes Capacitor configuration for building a native Android app.

### Setup

```bash
# Add Android platform (first time only)
pnpm cap:add

# Build web assets and sync to native project
pnpm cap:build

# Open in Android Studio
pnpm cap:open

# Run on device/emulator
pnpm cap:run
```

### Mobile Features

- Camera (profile photos)
- Geolocation (court finder)
- Haptic feedback
- Push notifications (FCM)
- Splash screen / status bar theming

### App Configuration

See `capacitor.config.json`:
- App ID: `com.pkl.courtconnect`
- App Name: `PKL Court Connect`
- Theme: Deep purple (`#0A0118`)

---

## Project Structure

```
├── client/                  # React frontend
│   ├── index.html           # Entry HTML
│   ├── public/              # Static assets (icons, manifest, service worker)
│   └── src/
│       ├── App.tsx           # Main app with routing
│       ├── main.tsx          # React entry point
│       ├── index.css         # Global styles (Tailwind)
│       ├── _core/            # Core utilities (tRPC client, etc.)
│       ├── components/       # Reusable UI components (shadcn/ui based)
│       ├── contexts/         # React context providers
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # Utility libraries
│       ├── locales/          # i18n translations (en, fr)
│       └── pages/            # Page components (screens)
│
├── server/                  # Express backend
│   ├── _core/               # Core server modules
│   │   ├── index.ts          # Server entry point
│   │   ├── context.ts        # tRPC context creation
│   │   ├── env.ts            # Environment variable validation
│   │   ├── trpc.ts           # tRPC initialization
│   │   ├── oauth.ts          # OAuth routes
│   │   ├── vite.ts           # Vite dev server integration
│   │   └── ...               # LLM, notification, image, map, voice modules
│   ├── routers.ts            # tRPC router definitions
│   ├── db.ts                 # Database queries and functions
│   ├── storage.ts            # File storage abstraction
│   ├── websocket.ts          # Socket.io event handlers
│   ├── stripeWebhook.ts      # Stripe webhook handler
│   └── fileUpload.ts         # File upload middleware
│
├── shared/                  # Shared between client and server
│   ├── types.ts              # TypeScript type definitions
│   └── const.ts              # Shared constants
│
├── drizzle/                 # Database schema and migrations
│   ├── schema.ts             # Drizzle ORM schema definitions
│   ├── relations.ts          # Table relationship definitions
│   ├── 0000-0012_*.sql       # Individual migration files
│   └── meta/                 # Drizzle migration metadata
│
├── database/                # Consolidated database files
│   └── init.sql              # Complete schema (all migrations merged)
│
├── patches/                 # pnpm dependency patches
│   └── wouter@3.7.1.patch   # Router patch
│
├── uploads/                 # User-uploaded files (runtime)
│
├── .env.example             # Environment variable template
├── capacitor.config.json    # Mobile app config
├── drizzle.config.ts        # Drizzle ORM config
├── package.json             # Dependencies and scripts
├── pnpm-lock.yaml           # pnpm lockfile
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite build config
```

---

## Key Features

### Player Discovery
- Swipe-based matching (Rally = like, Pass = skip, Super Rally = premium)
- Skill level, distance, and preference-based filtering
- Profile completion tracking and verification badges

### Game System
- Create games with customizable format, skill range, and court selection
- Real-time game scoring with team assignments
- Score confirmation and dispute handling
- Post-game feedback and player ratings
- Game history with win/loss tracking

### Court Management
- Interactive Mapbox map with court markers
- Detailed court profiles (surface type, lighting, amenities, cost)
- Court reviews and photo gallery
- Court booking system with time slot management
- Community court submissions with admin review

### Social Features
- Activity feed with posts, likes, and comments
- Real-time chat (direct messages and group conversations)
- Message reactions with emoji support
- Player challenges and rivalry tracking
- Favorite players list
- Referral system with XP rewards

### Groups & Community
- Create and join groups (social, league, tournament, coaching)
- Group chat integration
- Shared coaching sessions with agenda planning

### Gamification
- XP system with level progression
- Achievement badges across categories
- Daily/weekly quests with XP rewards
- Login streaks
- Leaderboards

### Premium Features (Stripe)
- Monthly and annual subscription plans
- Unlimited swipes, Super Rally, profile boosts
- Advanced filtering and analytics
- Stripe webhook for subscription management

### Admin Dashboard
- User management and moderation
- Report handling
- Court submission review
- App settings management
- Analytics and statistics

---

## API Architecture

The API uses **tRPC** for type-safe client-server communication.

### Base URL
- API: `/api/trpc/*`
- Sockets: `ws://localhost:3000/socket.io`
- File uploads: `/api/upload/*`
- Stripe webhook: `/api/stripe/webhook`

### Authentication
- JWT tokens stored in HTTP-only cookies
- Protected routes use `protectedProcedure` middleware
- Rate limiting on sensitive endpoints

### Real-Time Events (Socket.io)
- Game scoring updates
- Chat messages
- Challenge notifications
- Online presence

---

## Deployment Guide

### VPS / Cloud Server

1. **Provision** a server (Ubuntu 22.04+ recommended)
2. **Install** Node.js 20+, pnpm, MySQL 8.x
3. **Clone** the project and install dependencies:
   ```bash
   pnpm install
   ```
4. **Configure** `.env` with production values
5. **Initialize** the database:
   ```bash
   mysql -u root -p pkl_court_connect < database/init.sql
   ```
6. **Build** the application:
   ```bash
   pnpm build
   ```
7. **Start** with a process manager:
   ```bash
   # Using pm2
   npm install -g pm2
   pm2 start dist/index.js --name pkl-court-connect
   pm2 save
   pm2 startup
   ```
8. **Reverse proxy** with Nginx:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
9. **SSL** with Let's Encrypt:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

### Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:20-slim
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

```bash
docker build -t pkl-court-connect .
docker run -d -p 3000:3000 --env-file .env pkl-court-connect
```

### Stripe Webhook Setup

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

### Firebase Push Notifications

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Copy the config values to `VITE_FIREBASE_*` env vars
4. Generate VAPID keys for web push

---

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build client + server for production |
| `pnpm start` | Start production server |
| `pnpm check` | TypeScript type checking |
| `pnpm test` | Run test suite |
| `pnpm db:push` | Push Drizzle schema to database |
| `pnpm format` | Format code with Prettier |
| `pnpm cap:add` | Add Capacitor Android platform |
| `pnpm cap:sync` | Sync web assets to native |
| `pnpm cap:build` | Build + sync for mobile |
| `pnpm cap:open` | Open in Android Studio |
| `pnpm cap:run` | Run on Android device/emulator |

---

## License

MIT
