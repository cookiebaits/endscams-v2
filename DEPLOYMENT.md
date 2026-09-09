# EndScams.org Deployment & Security Guide

This guide explains how to deploy the EndScams.org platform (Cyberscam Watchdog Network) on Dokploy / Ubuntu Server, including Docker services and host-level WireGuard GeoIP + Anti-VPN firewall protection.

---

## Network Ports Overview

| Port | Protocol | Service | Description |
|------|----------|---------|-------------|
| `80` | TCP | Traefik / Nginx | Standard HTTP web entrypoint |
| `443` | TCP | Traefik | Secure HTTPS web entrypoint |
| `8080` | TCP | Nginx (`endscams`) | Direct container port (Cloudflare origin / alternate HTTP) |
| `8000` | TCP | Deno (`tracker-fetcher`) | Backend API & Threat Harvester service |
| `51820` | UDP | WireGuard Server | WireGuard VPN server port (Filtered by US/CA GeoIP & Anti-VPN firewall) |

---

## Docker Deployment Steps

### 1. Prerequisites
- Dokploy installed on Ubuntu Server with Traefik on `dokploy-network`
- Domain DNS pointing to your server IP address via Cloudflare Proxy

### 2. Configure Environment Variables
In Dokploy Environment Settings or `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_FETCHER_URL=https://fetcher.endscams.org

GOOGLE_API_KEY=your-google-key
GOOGLE_CX=your-cx-id
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ALLOWED_ORIGIN=https://endscams.org
ABSTRACT_PHONE_API_KEY=your-key
ABSTRACT_EMAIL_API_KEY=your-key
ABSTRACT_IP_API_KEY=your-key
ABSTRACT_SCRAPE_API_KEY=your-key
```

### 3. Deploy Docker Compose Services
```bash
docker-compose up -d --build
```

---

## WireGuard GeoIP (US & CA) & VPN/Proxy Blocking Setup

To prevent foreign attackers from connecting to your WireGuard VPN or disguising traffic using commercial VPNs (e.g. NordVPN, ExpressVPN), execute the setup steps on your host machine:

### Installation Steps

1. **Install Prerequisites**:
   ```bash
   sudo apt-get update && sudo apt-get install -y iptables ipset curl
   ```

2. **Copy Scripts and Configuration**:
   ```bash
   sudo mkdir -p /etc/wireguard-filter /var/cache/wireguard-filter
   sudo cp scripts/wireguard-geo-vpn-filter.sh /usr/local/bin/
   sudo chmod +x /usr/local/bin/wireguard-geo-vpn-filter.sh
   sudo cp scripts/wireguard-filter.env /etc/wireguard-filter/
   sudo cp scripts/wireguard-geo-vpn-filter.service /etc/systemd/system/
   sudo cp scripts/wireguard-geo-vpn-filter.timer /etc/systemd/system/
   ```

3. **Enable and Start Systemd Service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now wireguard-geo-vpn-filter.service
   sudo systemctl enable --now wireguard-geo-vpn-filter.timer
   ```

4. **Verify Active Firewall Rules**:
   ```bash
   sudo /usr/local/bin/wireguard-geo-vpn-filter.sh status
   ```

### Firewall Logic
1. **Custom Whitelist**: Traffic matching `CUSTOM_ALLOW_IPS` is accepted.
2. **VPN Block Set**: Traffic matching known VPNs (NordVPN, ExpressVPN, Surfshark, Mullvad, ProtonVPN, etc.) or proxy datacenters is explicitly **dropped**, preventing stacked/masked VPN traffic.
3. **GeoIP Whitelist**: Traffic originating from **USA (US)** or **Canada (CA)** IP blocks is accepted.
4. **Foreign Drop**: Any incoming WireGuard connection outside US/CA is automatically dropped.
