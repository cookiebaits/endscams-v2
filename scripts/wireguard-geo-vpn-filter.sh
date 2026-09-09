#!/usr/bin/env bash
# ==============================================================================
# WireGuard GeoIP (US & CA) & VPN / Proxy Anti-Spoofing Filter
# ==============================================================================
# Description:
#   Protects a WireGuard VPN server by enforcing strict incoming connection rules:
#   1. ONLY traffic originating from the USA (US) and Canada (CA) is allowed.
#   2. ALL traffic originating from known VPNs (NordVPN, ExpressVPN, Surfshark,
#      ProtonVPN, Cyberghost, Mullvad, PureVPN, etc.), Proxies, or Datacenters
#      is strictly BLOCKED, preventing foreign attackers from disguising traffic
#      via US/CA VPN servers or stacking WireGuard over commercial VPNs.
#
# Requirements:
#   - bash, curl or wget, iptables & ipset (or nftables)
#   - Root or sudo privileges to execute firewall modifications
#
# Usage:
#   sudo ./wireguard-geo-vpn-filter.sh [apply|update|flush|status]
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration Defaults (Can be overridden by /etc/wireguard-filter/wireguard-filter.env)
# ------------------------------------------------------------------------------
CONFIG_FILE="${CONFIG_FILE:-/etc/wireguard-filter/wireguard-filter.env}"
if [[ -f "${CONFIG_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${CONFIG_FILE}"
elif [[ -f "./wireguard-filter.env" ]]; then
  # shellcheck source=/dev/null
  source "./wireguard-filter.env"
fi

WG_PORT="${WG_PORT:-51820}"
WG_PROTO="${WG_PROTO:-udp}"
ALLOWED_COUNTRIES="${ALLOWED_COUNTRIES:-us ca}"
CUSTOM_ALLOW_IPS="${CUSTOM_ALLOW_IPS:-}"
CUSTOM_BLOCK_IPS="${CUSTOM_BLOCK_IPS:-}"

CACHE_DIR="${CACHE_DIR:-/var/cache/wireguard-filter}"
IPSET_GEO="wg_geo_allowed"
IPSET_VPN="wg_vpn_blocked"
IPSET_CUSTOM_ALLOW="wg_custom_allow"
IPSET_CUSTOM_BLOCK="wg_custom_block"

# Blocklists for VPNs, Proxies, and Datacenters
VPN_BLOCKLIST_URLS=(
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/nordvpn.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/expressvpn.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/surfshark.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/cyberghost.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/mullvad.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/protonvpn.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/purevpn.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/datacenter.ipset"
  "https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/ip2location_proxy.ipset"
  "https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt"
)

log() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
}

err() {
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] ERROR: $*" >&2
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (or with sudo)."
    exit 1
  fi
}

check_dependencies() {
  local missing=()
  for cmd in iptables ipset curl; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    err "Missing required commands: ${missing[*]}."
    err "Please install them (e.g., sudo apt-get update && sudo apt-get install -y iptables ipset curl)."
    exit 1
  fi
}

init_dirs() {
  mkdir -p "${CACHE_DIR}"
}

fetch_url() {
  local url="$1"
  local dest="$2"
  if curl -sSL --connect-timeout 10 --retry 2 "$url" -o "$dest.tmp"; then
    mv "$dest.tmp" "$dest"
    return 0
  else
    err "Failed to download $url"
    rm -f "$dest.tmp"
    return 1
  fi
}

# ------------------------------------------------------------------------------
# Download GeoIP & VPN Lists
# ------------------------------------------------------------------------------
download_geo_lists() {
  log "Downloading GeoIP lists for allowed countries: ${ALLOWED_COUNTRIES}..."
  local combined_geo="${CACHE_DIR}/allowed_geo.txt"
  : > "${combined_geo}.tmp"

  for country in ${ALLOWED_COUNTRIES}; do
    local c_lower
    c_lower=$(echo "$country" | tr '[:upper:]' '[:lower:]')
    local url="https://www.ipdeny.com/ipblocks/data/countries/${c_lower}.zone"
    local dest="${CACHE_DIR}/geo_${c_lower}.zone"
    log "  Fetching ${url}..."
    if fetch_url "$url" "$dest"; then
      grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$' "$dest" >> "${combined_geo}.tmp" || true
    elif [[ -f "$dest" ]]; then
      log "  Using cached GeoIP file for ${country}."
      grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$' "$dest" >> "${combined_geo}.tmp" || true
    else
      err "No GeoIP data available for ${country}."
    fi
  done

  mv "${combined_geo}.tmp" "${combined_geo}"
  local count
  count=$(wc -l < "${combined_geo}" || echo 0)
  log "GeoIP CIDRs loaded: ${count}"
}

download_vpn_lists() {
  log "Downloading VPN / Proxy / Datacenter blocklists..."
  local combined_vpn="${CACHE_DIR}/blocked_vpn.txt"
  : > "${combined_vpn}.tmp"

  local idx=0
  for url in "${VPN_BLOCKLIST_URLS[@]}"; do
    idx=$((idx + 1))
    local dest="${CACHE_DIR}/vpn_list_${idx}.txt"
    log "  Fetching ${url}..."
    if fetch_url "$url" "$dest"; then
      grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?' "$dest" >> "${combined_vpn}.tmp" || true
    elif [[ -f "$dest" ]]; then
      log "  Using cached VPN list ${idx}."
      grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?' "$dest" >> "${combined_vpn}.tmp" || true
    fi
  done

  # Filter out header lines, invalid lines, loopback/private ranges
  grep -vE '^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.)' "${combined_vpn}.tmp" | sort -u > "${combined_vpn}" || true
  rm -f "${combined_vpn}.tmp"
  local count
  count=$(wc -l < "${combined_vpn}" || echo 0)
  log "VPN/Proxy/Datacenter IPs/CIDRs loaded: ${count}"
}

# ------------------------------------------------------------------------------
# Create & Populate ipsets
# ------------------------------------------------------------------------------
apply_ipsets() {
  log "Applying ipset configurations..."

  # Create temporary ipsets for atomic swapping
  local geo_tmp="${IPSET_GEO}_tmp"
  local vpn_tmp="${IPSET_VPN}_tmp"

  ipset create "${geo_tmp}" hash:net hashsize 16384 maxelem 262144 -exist
  ipset flush "${geo_tmp}"

  ipset create "${vpn_tmp}" hash:net hashsize 65536 maxelem 524288 -exist
  ipset flush "${vpn_tmp}"

  # Populate GeoIP allowed set
  if [[ -f "${CACHE_DIR}/allowed_geo.txt" ]]; then
    while read -r cidr; do
      [[ -n "$cidr" ]] && ipset add "${geo_tmp}" "$cidr" -exist 2>/dev/null || true
    done < "${CACHE_DIR}/allowed_geo.txt"
  fi

  # Populate VPN blocked set
  if [[ -f "${CACHE_DIR}/blocked_vpn.txt" ]]; then
    while read -r cidr; do
      [[ -n "$cidr" ]] && ipset add "${vpn_tmp}" "$cidr" -exist 2>/dev/null || true
    done < "${CACHE_DIR}/blocked_vpn.txt"
  fi

  # Ensure main ipsets exist
  ipset create "${IPSET_GEO}" hash:net hashsize 16384 maxelem 262144 -exist
  ipset create "${IPSET_VPN}" hash:net hashsize 65536 maxelem 524288 -exist

  # Swap temp ipsets to main
  ipset swap "${geo_tmp}" "${IPSET_GEO}"
  ipset swap "${vpn_tmp}" "${IPSET_VPN}"

  # Destroy temp ipsets
  ipset destroy "${geo_tmp}" 2>/dev/null || true
  ipset destroy "${vpn_tmp}" 2>/dev/null || true

  # Handle custom allow / custom block sets
  ipset create "${IPSET_CUSTOM_ALLOW}" hash:net -exist
  ipset flush "${IPSET_CUSTOM_ALLOW}"
  if [[ -n "${CUSTOM_ALLOW_IPS}" ]]; then
    for ip in ${CUSTOM_ALLOW_IPS}; do
      ipset add "${IPSET_CUSTOM_ALLOW}" "$ip" -exist 2>/dev/null || true
    done
  fi

  ipset create "${IPSET_CUSTOM_BLOCK}" hash:net -exist
  ipset flush "${IPSET_CUSTOM_BLOCK}"
  if [[ -n "${CUSTOM_BLOCK_IPS}" ]]; then
    for ip in ${CUSTOM_BLOCK_IPS}; do
      ipset add "${IPSET_CUSTOM_BLOCK}" "$ip" -exist 2>/dev/null || true
    done
  fi

  log "ipsets successfully configured and populated."
}

# ------------------------------------------------------------------------------
# IPTables Rules Setup
# ------------------------------------------------------------------------------
apply_iptables_rules() {
  log "Configuring iptables firewall rules for WireGuard (Port: ${WG_PORT}/${WG_PROTO})..."

  local chain="WG_GEO_VPN_FILTER"

  # Create chain if it doesn't exist
  if ! iptables -n -L "${chain}" &>/dev/null; then
    iptables -N "${chain}"
  fi

  # Flush chain to avoid duplicates
  iptables -F "${chain}"

  # Rule Logic:
  # 1. Custom Allow -> ACCEPT
  iptables -A "${chain}" -m set --match-set "${IPSET_CUSTOM_ALLOW}" src -j ACCEPT

  # 2. Custom Block -> DROP
  iptables -A "${chain}" -m set --match-set "${IPSET_CUSTOM_BLOCK}" src -j LOG --log-prefix "WG-CUSTOM-BLOCK: " --log-level 4 2>/dev/null || true
  iptables -A "${chain}" -m set --match-set "${IPSET_CUSTOM_BLOCK}" src -j DROP

  # 3. Known VPN/Proxy/Datacenter IP -> DROP (Even if IP claims to be US/CA)
  iptables -A "${chain}" -m set --match-set "${IPSET_VPN}" src -j LOG --log-prefix "WG-VPN-BLOCK: " --log-level 4 2>/dev/null || true
  iptables -A "${chain}" -m set --match-set "${IPSET_VPN}" src -j DROP

  # 4. GeoIP Match (US or CA) -> ACCEPT
  iptables -A "${chain}" -m set --match-set "${IPSET_GEO}" src -j ACCEPT

  # 5. Fallback for non-matching country traffic -> DROP
  iptables -A "${chain}" -j LOG --log-prefix "WG-FOREIGN-BLOCK: " --log-level 4 2>/dev/null || true
  iptables -A "${chain}" -j DROP

  # Ensure INPUT chain jumps to WG_GEO_VPN_FILTER for WireGuard port
  if ! iptables -C INPUT -p "${WG_PROTO}" --dport "${WG_PORT}" -j "${chain}" &>/dev/null; then
    iptables -I INPUT 1 -p "${WG_PROTO}" --dport "${WG_PORT}" -j "${chain}"
  fi

  log "iptables rules active. WireGuard UDP ${WG_PORT} is now protected."
}

# ------------------------------------------------------------------------------
# Flush & Teardown
# ------------------------------------------------------------------------------
flush_all() {
  log "Flushing WireGuard firewall rules..."
  local chain="WG_GEO_VPN_FILTER"

  # Remove jump rule from INPUT
  while iptables -C INPUT -p "${WG_PROTO}" --dport "${WG_PORT}" -j "${chain}" &>/dev/null; do
    iptables -D INPUT -p "${WG_PROTO}" --dport "${WG_PORT}" -j "${chain}"
  done

  # Flush and delete chain
  if iptables -n -L "${chain}" &>/dev/null; then
    iptables -F "${chain}"
    iptables -X "${chain}"
  fi

  # Destroy ipsets
  for set_name in "${IPSET_GEO}" "${IPSET_VPN}" "${IPSET_CUSTOM_ALLOW}" "${IPSET_CUSTOM_BLOCK}"; do
    ipset destroy "${set_name}" 2>/dev/null || true
  done

  log "WireGuard firewall filter removed successfully."
}

# ------------------------------------------------------------------------------
# Status Report
# ------------------------------------------------------------------------------
show_status() {
  echo "=================================================================="
  echo " WireGuard GeoIP & VPN Anti-Spoofing Filter Status"
  echo "=================================================================="
  echo "Target Port: ${WG_PORT}/${WG_PROTO}"
  echo "Allowed Countries: ${ALLOWED_COUNTRIES}"
  echo ""

  if iptables -n -L WG_GEO_VPN_FILTER &>/dev/null; then
    echo "[+] Firewall Chain (WG_GEO_VPN_FILTER): ACTIVE"
    echo "------------------------------------------------------------------"
    iptables -L WG_GEO_VPN_FILTER -v -n --line-numbers
  else
    echo "[-] Firewall Chain (WG_GEO_VPN_FILTER): INACTIVE / NOT FOUND"
  fi

  echo ""
  echo "Ipset Entries Overview:"
  echo "------------------------------------------------------------------"
  for s in "${IPSET_GEO}" "${IPSET_VPN}" "${IPSET_CUSTOM_ALLOW}" "${IPSET_CUSTOM_BLOCK}"; do
    if ipset list "$s" &>/dev/null; then
      local count
      count=$(ipset list "$s" | grep -c '^[0-9]' || echo 0)
      echo "  - Set '$s': ACTIVE (${count} IPs/nets loaded)"
    else
      echo "  - Set '$s': NOT FOUND"
    fi
  done
  echo "=================================================================="
}

# ------------------------------------------------------------------------------
# Main Switch
# ------------------------------------------------------------------------------
main() {
  check_root
  check_dependencies
  init_dirs

  local cmd="${1:-apply}"

  case "$cmd" in
    apply)
      download_geo_lists
      download_vpn_lists
      apply_ipsets
      apply_iptables_rules
      show_status
      ;;
    update)
      log "Updating IP blocklists and refreshing ipsets..."
      download_geo_lists
      download_vpn_lists
      apply_ipsets
      log "Update complete."
      ;;
    flush)
      flush_all
      ;;
    status)
      show_status
      ;;
    *)
      echo "Usage: $0 {apply|update|flush|status}"
      exit 1
      ;;
  esac
}

main "$@"
