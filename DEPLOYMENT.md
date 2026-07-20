# EndScams.org Deployment Guide

This guide explains how to deploy the EndScams.org website (Cyberscam Watchdog Network) to Dokploy with Traefik and Cloudflare.

## Prerequisites

- Dokploy installed and configured
- Traefik running on `dokploy-network`
- Domain `endscams.org` configured in Cloudflare
- Cloudflare DNS pointed to your server IP (proxied)

## Project Structure

```
endscams/
├── Dockerfile              # Multi-stage build for production
├── docker-compose.yml      # Dokploy/Traefik configuration
├── nginx.conf              # Nginx server configuration
├── src/                    # React TypeScript source code
├── public/                 # Static assets
└── .env                    # Environment variables (Supabase)
```

## Deployment Steps

### 1. Clone or Upload the Project

Upload your project to your Dokploy server or clone from your repository.

### 2. Environment Variables

The `.env` file contains Supabase configuration:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

These are baked into the build at build-time, so make sure they're correct before deploying.

### 3. Deploy with Dokploy

#### Option A: Using Dokploy UI

1. Log in to your Dokploy dashboard
2. Create a new project
3. Select "Docker Compose" as the deployment type
4. Point to your `docker-compose.yml` file
5. Deploy

#### Option B: Manual Docker Compose

```bash
cd /path/to/endscams
docker-compose up -d --build
```

### 4. Traefik Configuration

The `docker-compose.yml` includes all necessary Traefik labels:

- **Domain routing**: `endscams.org` and `www.endscams.org`
- **HTTPS**: Automatic Let's Encrypt SSL certificates
- **HTTP → HTTPS redirect**: All HTTP traffic redirected to HTTPS
- **Network**: Connected to `dokploy-network`

### 5. Cloudflare Settings

#### DNS Configuration
1. Add an A record pointing to your server IP
2. Enable Cloudflare proxy (orange cloud)

#### SSL/TLS Settings
Set SSL/TLS encryption mode to **Full** (not Full Strict):
- Cloudflare → SSL/TLS → Overview → Full

This allows Cloudflare to connect to your Traefik-issued Let's Encrypt certificate.

#### Recommended Settings
- Enable "Always Use HTTPS"
- Enable "Automatic HTTPS Rewrites"
- Enable "Brotli" compression
- Consider enabling "Rocket Loader" for performance

### 6. Verify Deployment

After deployment:

1. Visit `https://endscams.org`
2. Test dark mode toggle in navigation
3. Navigate through all pages:
   - Home (phone number search + impact statistics)
   - Scam Tracker
   - Top Scams (FTC data)
   - Education
   - Report Scam

## Docker Architecture

### Multi-Stage Build

The Dockerfile uses a two-stage build:

1. **Builder stage**: Installs dependencies and builds the React app
2. **Production stage**: Serves the built files with Nginx

This results in a lightweight production image (~30MB).

### Nginx Configuration

The `nginx.conf` includes:

- SPA routing (all routes serve `index.html`)
- Static asset caching (1 year for images, fonts, etc.)
- Gzip compression for text assets
- Proper MIME types

## Supabase Database

The database schema includes three tables:

### `scam_reports`
User-submitted scam reports with:
- Phone number validation
- 45-day expiration
- Public read access for active reports
- Anonymous insert capability

### `tracker_entries`
External source data with:
- 30-day expiration
- Public read access for active entries
- Admin-managed entries

### `impact_statistics`
Impact tracking metrics:
- Money saved from prevented scams
- Scammer hours wasted
- Confirmed scammer resources shutdown
- Public read access
- Authenticated update access

## Troubleshooting

### Container won't start
```bash
docker logs endscams-web
```

### Traefik not routing
```bash
docker exec traefik cat /etc/traefik/traefik.yml
docker logs traefik
```

### SSL certificate issues
- Verify Cloudflare SSL mode is "Full"
- Check Traefik logs for Let's Encrypt errors
- Ensure ports 80 and 443 are open

### Build fails
```bash
npm run build
```
Check for TypeScript errors locally first.

## Updating the Site

1. Make changes to source code
2. Rebuild and deploy:
   ```bash
   docker-compose up -d --build
   ```

Dokploy will automatically rebuild the image and restart the container.

## Performance

Expected performance:
- **Build time**: ~5-10 minutes
- **Image size**: ~30MB (production)
- **Cold start**: <1 second
- **Page load**: <500ms (with Cloudflare CDN)

## Security

- All sensitive data (Supabase keys) is in environment variables
- Row Level Security (RLS) enabled on all database tables
- HTTPS enforced via Traefik and Cloudflare
- No toll-free numbers accepted in reports
- User emails never displayed publicly

## Maintenance

### Database Cleanup

Expired entries are automatically filtered by RLS policies. To permanently delete expired records:

```sql
DELETE FROM scam_reports WHERE expires_at < now();
DELETE FROM tracker_entries WHERE expires_at < now();
```

### Updating Impact Statistics

To update the impact statistics (requires authenticated access):

```sql
UPDATE impact_statistics
SET
  money_saved = 1500000.00,
  scammer_hours_wasted = 10000.00,
  resources_shutdown = 150,
  last_updated = now()
WHERE id = (SELECT id FROM impact_statistics ORDER BY last_updated DESC LIMIT 1);
```

### Monitoring

Monitor via:
- Dokploy dashboard
- Docker stats: `docker stats endscams-web`
- Nginx access logs: `docker logs endscams-web`

## Support

For issues with:
- **Deployment**: Check Dokploy docs
- **Traefik**: Verify network and labels
- **Cloudflare**: Check SSL mode and DNS settings
- **Database**: Check Supabase dashboard

## License

Proprietary - Cyberscam Watchdog Network

### "Site not found" Netlify Error
If you migrated from Netlify and are seeing a Netlify "Site not found" or "Looks like you followed a broken link or entered a URL that doesn't exist on Netlify" error page when visiting your domain:
- **Root Cause**: Your domain's DNS records (A or CNAME records) are still pointing to Netlify's servers instead of your new Dokploy VPS server IP address.
- **Solution**:
  1. Go to your Cloudflare dashboard (or DNS provider).
  2. Locate the DNS records for your domain (e.g., `endscams.org` and `www.endscams.org`).
  3. Delete the old records pointing to Netlify (often a CNAME or an A record to a Netlify IP).
  4. Create a new A record pointing to your new Dokploy server IP address.
  5. Ensure Cloudflare proxy (orange cloud) is enabled.
