# Tailscale VPN Container with Kill Switch

A Docker Compose setup that provides a secure VPN tunnel using Tailscale with mandatory exit node routing and a fail-closed kill switch. The Transmission BitTorrent client runs in a separate container that shares the VPN service's network namespace, ensuring all traffic is routed through the specified Tailscale exit node.

## Features

- **Mandatory Exit Node Routing**: All traffic is forced through a specific Tailscale exit node
- **Kill Switch**: Automatically blocks all traffic if VPN connection fails
- **Self-Healing**: Automatically recovers from VPN disconnections
- **Shared Network Namespace**: Application service cannot bypass VPN routing
- **Health Monitoring**: Continuous health checks ensure system integrity
- **One-Command Startup**: `docker compose up -d` starts everything

## Architecture

The solution consists of two services:

1. **VPN Service** (`vpn`): Runs Tailscale and enforces routing/kill switch
2. **Transmission Service** (`transmission`): BitTorrent client sharing VPN network

The Transmission service uses `network_mode: "service:vpn"` to share the VPN service's network stack, ensuring no traffic can bypass the VPN.

## Prerequisites

- Docker and Docker Compose v2+
- Tailscale account with admin access
- A Tailscale exit node (IP address in 100.x.x.x range)
- Linux host (required for iptables and network namespace features)

## Setup

### 1. Get Tailscale Auth Key

1. Log in to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/keys)
2. Create a new auth key (pre-authenticated, reusable)
3. Copy the auth key (starts with `tskey-auth-`)

### 2. Identify Exit Node

1. Find the Tailscale IP address of your exit node (e.g., `100.64.0.1`)
2. Ensure the exit node is configured to allow exit node traffic in Tailscale admin console

### 3. Configure Environment

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set:
   - `TAILSCALE_AUTH_KEY`: Your Tailscale auth key
   - `TAILSCALE_EXIT_NODE`: IP address of your exit node (e.g., `100.64.0.1`)
   - `TAILSCALE_HOSTNAME`: Optional hostname for this node

### 4. Start Services

```bash
docker compose up -d
```

This will:
1. Build the VPN service container
2. Start the VPN service and establish Tailscale connection
3. Configure routing and activate kill switch
4. Start Transmission service once VPN is healthy

### 5. Verify Setup

Check VPN service logs:
```bash
docker compose logs vpn
```

Check Transmission service logs:
```bash
docker compose logs transmission
```

Check VPN service health:
```bash
docker compose ps vpn
```

Access Transmission web UI:
- Open `http://localhost:9091` in your browser
- Default credentials: `transmission` / `transmission`

## How It Works

### Startup Sequence

1. **VPN Service starts** → Tailscale daemon initializes
2. **Authentication** → Connects to Tailscale control plane
3. **Interface Creation** → Waits for `tailscale0` interface
4. **Routing Configuration** → Sets default route through Tailscale
5. **Exit Node Verification** → Confirms exit node is reachable
6. **Kill Switch Activation** → Applies iptables rules to block non-VPN traffic
7. **Health Check Passes** → Service marked as healthy
8. **Transmission Starts** → Only after VPN is confirmed healthy

### Kill Switch Mechanism

The kill switch uses iptables rules to:
- Block all outbound traffic by default (`OUTPUT DROP`)
- Allow loopback traffic
- Allow established connections
- **Only allow traffic through `tailscale0` interface**

If the VPN interface goes down or the default route changes, all traffic is blocked immediately.

### Health Monitoring

The VPN service continuously monitors:
- Tailscale interface existence and status
- Default route pointing to Tailscale interface
- Exit node reachability

If any check fails, the kill switch remains active (traffic blocked) while the service attempts recovery.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TAILSCALE_AUTH_KEY` | Pre-authenticated Tailscale key | Yes |
| `TAILSCALE_EXIT_NODE` | Exit node IP address (100.x.x.x) | Yes |
| `TAILSCALE_HOSTNAME` | Hostname for this Tailscale node | No |
| `TAILSCALE_STATE_DIR` | Directory for Tailscale state | No (default: `/var/lib/tailscale`) |

### Volumes

- `./tailscale-state`: Persistent Tailscale authentication and state
- `./transmission-data`: Transmission downloads directory
- `./transmission-config`: Transmission configuration files

### Ports

- `9091`: Transmission web UI (mapped through VPN service)

## Troubleshooting

### VPN Service Won't Start

1. Check logs: `docker compose logs vpn`
2. Verify auth key is valid and not expired
3. Ensure exit node IP is correct and reachable
4. Check that exit node allows exit traffic in Tailscale admin

### Transmission Can't Connect

1. Verify VPN service is healthy: `docker compose ps vpn`
2. Check that Transmission started after VPN: `docker compose logs transmission`
3. Verify kill switch is active: `docker compose exec vpn iptables -L OUTPUT -v`

### Traffic Not Routing Through Exit Node

1. Check Tailscale status: `docker compose exec vpn tailscale status`
2. Verify default route: `docker compose exec vpn ip route show default`
3. Test connectivity: `docker compose exec vpn ping -c 3 8.8.8.8`
4. Check exit node IP in Tailscale status output

### Kill Switch Too Aggressive

The kill switch is designed to be fail-closed. If you need to temporarily disable it for debugging:

```bash
docker compose exec vpn iptables -P OUTPUT ACCEPT
```

**Warning**: This disables the kill switch. Only use for debugging.

## Security Considerations

- VPN service requires `NET_ADMIN` capability for routing/iptables
- Application service has no special capabilities
- Kill switch prevents traffic leaks even if VPN fails
- No host network access
- Persistent state stored in volumes

## Maintenance

### Restart Services

```bash
docker compose restart
```

### Update Containers

```bash
docker compose pull
docker compose up -d
```

### View Logs

```bash
# All services
docker compose logs -f

# VPN service only
docker compose logs -f vpn

# Transmission service only
docker compose logs -f transmission
```

### Stop Services

```bash
docker compose down
```

### Clean Up (removes volumes)

```bash
docker compose down -v
```

**Warning**: This will delete Tailscale state and Transmission data.

## License

MIT

