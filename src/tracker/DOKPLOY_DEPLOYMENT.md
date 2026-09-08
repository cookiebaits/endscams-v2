# Dokploy & Cloudflare Proxy Deployment Guide

This guide ensures seamless deployment of the **End Scam Threat Harvester** to your Dokploy container behind a Cloudflare proxy.

---

## 1. Dokploy Application Settings

In your Dokploy Dashboard, create a new Application or configure your existing one:

| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Source** | Git / GitHub | Connect your repository |
| **Branch** | `main` | Or your deployed branch |
| **Build Type** | **Dockerfile** | Alternatively, **Nixpacks** is also supported via `nixpacks.toml` |
| **Port** | `3000` | The internal container port (`PORT=3000`) |

---

## 2. Environment Variables in Dokploy

In the **Environment** tab of your Dokploy application, add the following:

```env
NODE_ENV=production
PORT=3000
GEMINI_API_KEY="AQ.Ab8R..."
```

> **Note on GEMINI_API_KEY**:
> - You can paste your Gemini key with or without quotes.
> - Both formats (standard `AIzaSy...` and newer `AQ.Ab8R...` Google AI Studio tokens) are automatically detected and supported.
> - If unconfigured, the harvester uses its intelligent offline heuristics and regular daily seed database.

---

## 3. Persistent Volumes (Data Retention)

To ensure harvested records, custom edits, and manual additions persist across container rebuilds:

In Dokploy **Volumes / Storage**:
- **Host Path**: `./data` (or any persistent folder on your VPS)
- **Container Path**: `/app/data`

---

## 4. Cloudflare Proxy Configuration

When routing through Cloudflare (Orange Cloud Proxy):

1. **SSL/TLS Encryption Mode**:
   - Set to **Full** or **Full (Strict)**.
   - Avoid "Flexible" as it causes 301/308 redirects that can break `POST` requests or cause HTTP 405 Method Not Allowed.

2. **Cloudflare Cache Rules / Page Rules**:
   - Ensure Cloudflare does **NOT** cache `/api/*` endpoints.
   - Go to **Caching** &rarr; **Cache Rules** &rarr; Create rule:
     - Field: `URI Path` starts with `/api/`
     - Action: **Bypass cache**
   *(If Cloudflare attempts to edge-cache `/api/` paths, it will reject POST requests with 405).*

3. **HTTP Methods & Fallbacks**:
   - The application is now built to support both `POST` and `GET` for scan triggers (`/api/scan-now`) and `POST` / `PUT` for CSV restores.
   - The frontend automatically retries with alternative methods and includes local client database persistence if an external proxy blocks a request.

---

## 5. Quick Health Check

The container includes a built-in health check on `/health`:
- URL: `http://127.0.0.1:3000/health`
- Returns: `{ "status": "ok", "recordsCount": 93, "apiKeyConfigured": true, "proxy": { "trustProxy": true } }`
