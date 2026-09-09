# EndScams.org (Cyberscam Watchdog Network)

A comprehensive, full-stack cybersecurity web application and threat intelligence watchdog platform dedicated to identifying, reporting, and preventing online scams and phishing threats through community intelligence and automated detection tools.

Officially operated by Cyberscam Watchdog Network (CWN), a 501(1)(c) Non-Profit organization.

---

## Program Overview

EndScams.org provides live scam intelligence, automated carrier/VoIP phone lookup tools, email reputation verification, IP intelligence scanning, website scraping, and an active community scam reporting portal.

In addition to web services, the platform includes a host-level security module for WireGuard VPN servers that enforces strict GeoIP rules (allowing **USA and Canada** traffic only) while actively blocking commercial VPNs (e.g. NordVPN, ExpressVPN), proxies, and datacenter origins to protect against foreign cyberattacks.

---

## Key Features

- **Community Scam Database & Watchdog Index**: Live-refreshed catalog of verified fraudulent phone numbers with 31-day auto-purge retention.
- **Advanced Scam Detection Tools**:
  - **Phone Search**: Real-time carrier identification, VoIP flags, wholesale line warnings, and format verification.
  - **Email Scanner**: Deliverability scoring and disposable inbox detection.
  - **IP Intelligence**: Geolocation and VPN / Proxy detection for IPv4/IPv6 addresses.
  - **Web Scraper**: Secure server-side HTML rendering and text extraction for suspicious domains.
- **Impact Tracking Dashboard**: Automated tracking of dollars protected, scammer decoy hours spent, and confirmed infrastructure shutdowns.
- **WireGuard Anti-Attack Filter**:
  - **GeoIP Restriction**: Only incoming traffic from **USA (US)** and **Canada (CA)** is allowed.
  - **VPN / Proxy / Datacenter Block**: Incoming connections from commercial VPNs (NordVPN, ExpressVPN, Surfshark, Mullvad, ProtonVPN, Cyberghost, etc.) and proxy datacenters are strictly dropped, even if routed through US/CA exit nodes.

---

## Network Ports Utilized

| Port | Protocol | Service / Component | Purpose |
|------|----------|---------------------|---------|
| `80` / `443` | TCP | Traefik / Nginx | Public HTTPS/HTTP traffic for web application |
| `8080` | TCP | Nginx (`endscams-web`) | Container web server direct port (Cloudflare compatible) |
| `8000` | TCP | Deno (`tracker-fetcher`) | Backend threat harvester & tools proxy API |
| `51820` | UDP | WireGuard Server | WireGuard VPN server port (Filtered by GeoIP & anti-VPN script) |

---

## Deployment Architecture

Designed for deployment on **Dokploy** with Traefik proxy or standard **Ubuntu Server**.

### 1. Docker Compose Services
- `endscams`: React + Vite SPA served via Nginx.
- `tracker-fetcher`: Deno API service executing threat harvesting schedules (6 AM & 1 PM PST) and proxying Abstract API security lookups.

### 2. Environment Variables (`.env`)

```env
# Frontend Build Args
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FETCHER_URL=https://fetcher.endscams.org

# Tracker Fetcher Backend Environment
GOOGLE_API_KEY=your-google-api-key
GOOGLE_CX=your-programmable-search-cx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALLOWED_ORIGIN=https://endscams.org
ABSTRACT_PHONE_API_KEY=your-key
ABSTRACT_EMAIL_API_KEY=your-key
ABSTRACT_IP_API_KEY=your-key
ABSTRACT_SCRAPE_API_KEY=your-key
```

### 3. Deploying Web Services via Dokploy
1. Log in to your Dokploy dashboard.
2. Select **Docker Compose** project type.
3. Link `docker-compose.yml` and provide environment variables in the **Environment** tab.
4. Deploy application.

---

## WireGuard GeoIP & Anti-VPN Security Filter Setup

To protect your WireGuard server on Dokploy / Ubuntu host against foreign attacks and VPN-disguised traffic:

### 1. Install Filter Files
```bash
sudo mkdir -p /etc/wireguard-filter /var/cache/wireguard-filter
sudo cp scripts/wireguard-geo-vpn-filter.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/wireguard-geo-vpn-filter.sh
sudo cp scripts/wireguard-filter.env /etc/wireguard-filter/
sudo cp scripts/wireguard-geo-vpn-filter.service /etc/systemd/system/
sudo cp scripts/wireguard-geo-vpn-filter.timer /etc/systemd/system/
```

### 2. Apply Firewall Rules
```bash
# Enable systemd service and daily update timer
sudo systemctl daemon-reload
sudo systemctl enable --now wireguard-geo-vpn-filter.service
sudo systemctl enable --now wireguard-geo-vpn-filter.timer

# Check status
sudo /usr/local/bin/wireguard-geo-vpn-filter.sh status
```

### 3. Filter Execution Logic
1. **Custom Allow Set**: Custom whitelisted IPs bypass all restrictions.
2. **VPN / Datacenter Block Set**: Connections matching NordVPN, ExpressVPN, Surfshark, Datacamp, etc. are immediately dropped (`DROP`).
3. **GeoIP Allowed Set**: Connections matching **US** or **CA** IP ranges are allowed (`ACCEPT`).
4. **Default Catch-all**: Any foreign IP address outside US/CA is dropped (`DROP`).

---

## License & Organization

Cyberscam Watchdog Network (CWN) — 501(1)(c) Non-Profit. All rights reserved.
