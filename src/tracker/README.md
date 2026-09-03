# End Scam Scan (ESScan)

> An automated scam phone number harvester and threat intelligence dashboard.

ESScan is a full-stack tool designed to automatically scrape, extract, and index active scam phone numbers across multiple sources. Built with React, Express, and powered by the Gemini API, it provides a centralized dashboard for security researchers and scambaiters to track active call centers and fraudulent operations.

---

## Features

* **Multi-Source Harvesting**: Automatically crawls and extracts phone numbers from:
  * **BBB Scam Tracker**: Multi-page scraping of recent scam reports (Sweepstakes, Tech Support, etc.).
  * **TechScammersUnited**: Deep forum thread extraction for PayPal, Apple, Geek Squad, McAfee, and PCH scams.
  * **Google Search Grounding**: Leverages AI search grounding to find active numbers reported in the last 30 days.
* **Intelligent Parsing**: Uses the Gemini API (`@google/genai`) to parse unstructured forum posts, scam reports, and search results to accurately extract phone numbers and context snippets.
* **Automated Scheduling**: Runs automatic background harvesting jobs twice daily at **7:00 AM** and **1:00 PM PST**.
* **Data Management**: Features a 31-day data retention policy, automatic deduplication, and country-code identification.
* **Modern Dashboard**: A clean, responsive React + Tailwind CSS dashboard to filter, search, and export harvested numbers.
* **Production Ready**: Built with Express `trust proxy` support, health endpoints (`/health` and `/api/health`), and containerized setup for zero-downtime deployment.

---

## Tech Stack

* **Frontend**: React 19, Tailwind CSS v4, Vite, Lucide Icons
* **Backend**: Node.js, Express
* **AI Engine**: Google Gemini API (`@google/genai`)
* **Deployment**: Docker, Docker Compose, Dokploy, Cloudflare

---

## Getting Started (Local Development)

### Prerequisites
* Node.js (v18 or higher)
* A Google Gemini API Key ([Get one here](https://aistudio.google.com/))

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/cookiebaits/ESScan.git
   cd ESScan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and configure your API key:
   ```bash
   cp .env.example .env
   ```
   Add your Gemini key inside `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3000
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Access the dashboard at `http://localhost:3000`.

---

## Dokploy Deployment over Cloudflare

ESScan is configured out-of-the-box for 1-click deployment on **Dokploy** behind a **Cloudflare** reverse proxy/CDN using the root `Dockerfile`.

### Step 1: Create Application in Dokploy

1. Open your Dokploy instance dashboard.
2. Click **Create Application** and name it `ESScan`.
3. Under **Provider**, select **GitHub** and connect the repository:
   * **Repository URL**: `https://github.com/cookiebaits/ESScan.git`
   * **Branch**: `main` (or default branch)
4. Under **Build Type**, select **Dockerfile** (or **Docker Compose**).
5. Set **Container Port** to `3000`.

### Step 2: Configure Environment Variables in Dokploy

In your Dokploy Application settings under **Environment**:
```env
NODE_ENV=production
PORT=3000
GEMINI_API_KEY=your_actual_gemini_api_key
```

### Step 3: Configure Health Check (Optional)

In Dokploy settings or Traefik configuration:
* **Health Check Path**: `/health` or `/api/health`
* **Port**: `3000`

### Step 4: Configure Cloudflare Proxy & SSL

1. In **Cloudflare DNS**:
   * Add an **A record** pointing your domain (e.g., `esscan.yourdomain.com`) to your Dokploy server IP.
   * Enable the proxy status (Orange Cloud icon: **Proxied**).
2. In **Cloudflare SSL/TLS Settings**:
   * Set encryption mode to **Full** or **Full (strict)**.
3. In **Dokploy Domain Settings**:
   * Add domain `esscan.yourdomain.com`.
   * Enable Let's Encrypt SSL inside Dokploy/Traefik or rely on Cloudflare SSL.

### Step 5: Deploy

Click **Deploy** in Dokploy. Dokploy will execute the multi-stage `Dockerfile`, build the React frontend, bundle the Node server, and launch the container on port `3000`.

---

## Docker & Docker Compose Setup

You can also run ESScan locally or on any VPS using Docker Compose:

```bash
# Build and run container
docker-compose up -d --build
```

Health check verification:
```bash
curl http://localhost:3000/health
```

---

## Disclaimer

This tool is designed for educational purposes, security research, and scambaiting operations. Users are responsible for complying with all applicable local, state, and federal laws when interacting with the extracted phone numbers.

---
*Maintained by [cookiebaits](https://github.com/cookiebaits).*
