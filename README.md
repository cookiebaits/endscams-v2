# Cyberscam Watchdog Network (EndScams.org)

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](#)
[![SEO Fully Optimized](https://img.shields.io/badge/SEO-Enhanced-blue.svg)](#)

**EndScams.org** is a 501(c)(3) Non-Profit Cyberscam Watchdog Network dedicated to exposing online fraud, tracking active scam phone numbers, protecting victims, and educating the public through interactive cybersecurity workshops and live threat intelligence tools.

---

## 🚀 Key Features

- **Live Threat Tracker (`/tracker`)**: Real-time database lookup for scam phone numbers, active impersonations (Geek Squad, PayPal, Norton, Amazon, PCH, etc.), alt numbers, and threat snippets.
- **Scam Reporting Engine (`/report`)**: Instant report submission with AI OCR screenshot extraction, auto-filling incident details, and live synchronization across Supabase PostgreSQL and BroadcastChannels.
- **Printable Brochure & Newsletter Gateway (`/education`)**:
  - Modal prompt required on first access to "View Printable Brochure".
  - Collects and validates subscriber emails, persisting data securely to Supabase (`newsletter_subscribers`).
  - Caches subscription status locally (`endscams_newsletter_subscribed`) to bypass future prompts.
  - Generates secure, one-time hex-encoded CSV download links (`/api/newsletter/csv/:hexToken`).
  - Sends daily rate-limited signup alerts via Resend API (maximum once per day, only when new signups occur).
- **Advanced Scam Detection Tools (`/home`)**:
  - **Phone Intelligence**: Carrier verification, line type (cellular vs. VoIP/landline), and wholesaler risk scoring.
  - **Email Scanner**: Deliverability checks and disposable/throwaway inbox identification.
  - **IP Intelligence**: Geolocation, ISP verification, and VPN/Tor proxy flags.
  - **Safe Web Scraper**: Isolated proxy rendering and metadata extraction for suspicious phishing URLs.
- **Interactive Security Workshops (`/workshop`)**: Organization booking form for anti-scam awareness training tailored for businesses, senior living communities, schools, and civic groups.
- **Scam Incident Triage (`/triage`)**: Emergency interactive questionnaire helping victims evaluate threats, recognize extortion schemes, and execute immediate defensive maneuvers.
- **Streamer Safety & Anti-Doxxing Guide (`/stream-safety`)**: Specialized security protocols and pre-stream checklists for content creators.
- **Scammer Resource Takedown Checklist (`/shutdown`)**: Post-scam recovery checklist for filing police reports, placing credit freezes, and requesting domain/phone line shutdowns.
- **Full Search Engine Optimization (SEO)**:
  - Dynamic `SEO` component managing dynamic page titles, descriptions, keywords, canonical URLs, OpenGraph, and Twitter Cards across all routes.
  - Schema.org JSON-LD structured data (`NGO`, `WebSite`, `SoftwareApplication`, `FAQPage`, `HowTo`, `EducationalOrganization`).
  - Search crawler discovery artifacts: `robots.txt` and full route `sitemap.xml`.

---

## 🌐 Network Ports & Environment

| Service | Port | Description |
| :--- | :--- | :--- |
| **Vite / Frontend Web App** | `5173` | Local React Development Server |
| **Backend API Server** | `8000` | Express REST API & Threat Fetcher Pipeline |
| **HTTP Web Proxy** | `80` | Production Docker Nginx Reverse Proxy |
| **HTTPS SSL Proxy** | `443` | Production Secure Proxy (Cloudflare / Dokploy) |

---

## 🛠️ Technology Stack

- **Frontend Framework**: React 19, TypeScript, React Router v7
- **Styling & UI Components**: Tailwind CSS v3, Lucide Icons
- **Database & Persistence**: Supabase (PostgreSQL), Client-side LocalStorage Sync, BroadcastChannel API
- **AI & Automation**: Gemini Vision API for OCR Evidence Extraction & Threat Intelligence Harvester
- **Email & Alerts**: Resend API integration with hex token rate-limiting
- **Server Environment**: Node.js, Express, Helmet Security Middleware, Vite

---

## 📦 Deployment Instructions (Dokploy & Docker)

### Option 1: Docker Compose (Recommended for Dokploy)

1. Clone the repository to your server:
   ```bash
   git clone https://github.com/endscams/endscams-v2.git
   cd endscams-v2
   ```

2. Configure environment variables in `.env` or Dokploy dashboard:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   GEMINI_API_KEY=your-gemini-api-key
   RESEND_API_KEY=your-resend-api-key
   ```

3. Launch containers:
   ```bash
   docker-compose up -d --build
   ```

### Option 2: Local Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local Vite development server:
   ```bash
   npm run dev
   ```

3. Compile production build:
   ```bash
   npm run build
   ```

---

## 🔒 Security & Privacy

EndScams.org prioritizes user privacy and system security:
- Secured with Express `helmet` middleware for HTTP security header protection.
- Strict IP geographic restrictions enforcing authorized access regions.
- Hex-encoded CSV links are single-use only and automatically invalidate upon first download.
- Zero raw storage of sensitive personal data; secret keys are dynamically resolved from environment variables or cryptographic vaults rather than hardcoded in source.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
