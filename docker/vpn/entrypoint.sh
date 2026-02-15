#!/bin/bash
set -euo pipefail

# Configuration
TAILSCALE_STATE_DIR="${TAILSCALE_STATE_DIR:-/var/lib/tailscale}"
TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
TAILSCALE_EXIT_NODE="${TAILSCALE_EXIT_NODE:-}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-tailscale-vpn}"
TAILSCALE_INTERFACE="tailscale0"

# Graceful shutdown state
SHUTDOWN_REQUESTED=0
TAILSCALED_PID=""
MONITOR_PID=""

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

# Error handling
error_exit() {
    log "ERROR: $*"
    exit 1
}

# Wait for interface to be up
wait_for_interface() {
    local max_attempts=60
    local attempt=0
    
    log "Waiting for Tailscale interface to be created..."
    while [ $attempt -lt $max_attempts ]; do
        if ip link show "$TAILSCALE_INTERFACE" >/dev/null 2>&1; then
            log "Tailscale interface $TAILSCALE_INTERFACE found"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    error_exit "Tailscale interface $TAILSCALE_INTERFACE not found after ${max_attempts} seconds"
}

# Wait for interface to be up and have an IP
wait_for_interface_up() {
    local max_attempts=90
    local attempt=0
    
    log "Waiting for Tailscale interface to be up..."
    while [ $attempt -lt $max_attempts ]; do
        # Check if interface has an IP address (TUN interfaces show UNKNOWN state but work fine)
        if ip addr show "$TAILSCALE_INTERFACE" 2>/dev/null | grep -q "inet "; then
            # Also check that interface is actually up (LOWER_UP flag)
            if ip link show "$TAILSCALE_INTERFACE" 2>/dev/null | grep -q "LOWER_UP"; then
                log "Tailscale interface $TAILSCALE_INTERFACE is up with IP"
                # Give it a moment to fully stabilize
                sleep 2
                return 0
            fi
        fi
        sleep 1
        attempt=$((attempt + 1))
        # Log progress every 10 seconds
        if [ $((attempt % 10)) -eq 0 ]; then
            log "Still waiting... (${attempt}/${max_attempts} seconds)"
        fi
    done
    
    error_exit "Tailscale interface $TAILSCALE_INTERFACE did not come up after ${max_attempts} seconds"
}

# Verify exit node is reachable
verify_exit_node() {
    if [ -z "$TAILSCALE_EXIT_NODE" ]; then
        error_exit "TAILSCALE_EXIT_NODE is not set"
    fi
    
    log "Verifying exit node $TAILSCALE_EXIT_NODE is reachable..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if ping -c 1 -W 2 "$TAILSCALE_EXIT_NODE" >/dev/null 2>&1; then
            log "Exit node $TAILSCALE_EXIT_NODE is reachable"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    error_exit "Exit node $TAILSCALE_EXIT_NODE is not reachable after ${max_attempts} attempts"
}

# Verify default route points to Tailscale interface (optional check)
# Note: Tailscale may use policy routing, so default route check may not always be accurate
verify_default_route() {
    log "Checking routing configuration..."
    local default_route
    default_route=$(ip route show default 2>/dev/null | head -n1 || echo "")
    
    if [ -n "$default_route" ] && echo "$default_route" | grep -q "dev $TAILSCALE_INTERFACE"; then
        log "Default route points to $TAILSCALE_INTERFACE: $default_route"
        return 0
    else
        # This is not necessarily an error - Tailscale uses policy routing
        log "Default route does not point to $TAILSCALE_INTERFACE (this may be normal with policy routing)"
        log "Current default route: ${default_route:-none}"
        log "Tailscale uses policy-based routing, so this check is informational only"
        return 0
    fi
}

# Test control plane connectivity
test_control_plane() {
    log "Testing connectivity to Tailscale control plane..."
    if curl -s -I --max-time 10 https://controlplane.tailscale.com >/dev/null 2>&1; then
        log "✓ Control plane (controlplane.tailscale.com) is reachable"
        return 0
    else
        log "✗ Control plane (controlplane.tailscale.com) is NOT reachable"
        return 1
    fi
}

# Configure Docker network routing exceptions
# Tailscale's exit node routes ALL traffic through tailscale0 including Docker network traffic.
# This breaks container port forwarding because responses go through tailscale0 instead of eth0.
# We need to add policy routing rules to keep Docker network traffic on eth0.
configure_docker_network_routing() {
    log "Configuring Docker network routing exceptions..."
    
    # Detect Docker network interface and subnet
    local docker_interface="eth0"
    local docker_subnet=""
    
    # Get the subnet from eth0 interface (POSIX-compatible, no grep -P)
    docker_subnet=$(ip -4 addr show "$docker_interface" 2>/dev/null | awk '/inet / {print $2}' | head -1)
    if [ -z "$docker_subnet" ]; then
        log "WARNING: Could not detect Docker network subnet, skipping routing exception"
        return 0
    fi
    
    # Convert to network address (e.g., 192.168.97.2/24 -> 192.168.97.0/24)
    local network_cidr
    network_cidr=$(echo "$docker_subnet" | sed 's|\.[0-9]*/|.0/|')
    
    log "Detected Docker network: $network_cidr on $docker_interface"
    
    # Add policy routing rule with priority before Tailscale's table 52 lookup (priority 5270)
    # Priority 5200 ensures Docker network traffic uses the main routing table (eth0)
    if ! ip rule show | grep -q "to $network_cidr lookup main"; then
        ip rule add to "$network_cidr" lookup main priority 5200
        log "Added routing rule: to $network_cidr lookup main (priority 5200)"
    else
        log "Routing rule for $network_cidr already exists"
    fi
    
    # Verify the routing is correct
    local gateway_ip
    gateway_ip=$(ip route show default | awk '/via/ {print $3}' | head -1)
    if [ -n "$gateway_ip" ]; then
        local route_dev
        route_dev=$(ip route get "$gateway_ip" 2>/dev/null | awk '/dev/ {for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -1)
        if [ "$route_dev" = "$docker_interface" ]; then
            log "✓ Docker gateway ($gateway_ip) correctly routes through $docker_interface"
        else
            log "WARNING: Docker gateway routes through $route_dev instead of $docker_interface"
        fi
    fi
}

# Activate kill switch (Phase 2: Selective kill switch that allows Tailscale traffic)
activate_kill_switch() {
    log "Activating kill switch (iptables rules)..."
    
    # First, configure Docker network routing exceptions
    # This must be done BEFORE iptables rules to ensure correct routing
    configure_docker_network_routing
    
    # Flush existing OUTPUT chain rules (if any)
    iptables -F OUTPUT 2>/dev/null || true
    
    # Set default policy to DROP
    iptables -P OUTPUT DROP
    
    # Allow loopback traffic
    iptables -A OUTPUT -o lo -j ACCEPT
    
    # Allow Docker network traffic (for container port forwarding)
    # This must come early to allow SYN-ACK packets back to Docker gateway
    local docker_subnet
    docker_subnet=$(ip -4 addr show eth0 2>/dev/null | awk '/inet / {print $2}' | head -1 | sed 's|\.[0-9]*/|.0/|')
    if [ -n "$docker_subnet" ]; then
        iptables -A OUTPUT -o eth0 -d "$docker_subnet" -j ACCEPT
        log "  - Docker network ($docker_subnet on eth0)"
    fi
    
    # Allow established and related connections (critical for maintaining existing connections)
    iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
    
    # CRITICAL: Allow DNS resolution (needed for control plane and general connectivity)
    # Allow DNS queries through any interface (they'll be routed correctly)
    iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
    iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT
    
    # CRITICAL: Allow Tailscale control plane traffic
    # Resolve controlplane.tailscale.com to get IPs (may change, so we allow the domain via DNS)
    # We'll allow HTTPS to common Tailscale control plane IPs
    # Note: Tailscale uses controlplane.tailscale.com which resolves to multiple IPs
    # Since we can't easily enumerate all IPs, we allow all HTTPS traffic that's established
    # The ESTABLISHED rule above handles this, but we also need to allow NEW connections
    
    # Allow traffic through Tailscale interface (this includes control plane when routed through VPN)
    iptables -A OUTPUT -o "$TAILSCALE_INTERFACE" -j ACCEPT
    
    # IMPORTANT: Tailscale's control plane connections are established BEFORE kill switch
    # The ESTABLISHED,RELATED rule above will keep them alive
    # New control plane connections will go through tailscale0 interface (allowed above)
    # This works because Tailscale routes its own traffic intelligently
    
    log "Kill switch activated: All traffic blocked except:"
    log "  - Loopback (lo)"
    log "  - Established/related connections"
    log "  - DNS (port 53)"
    log "  - Traffic through $TAILSCALE_INTERFACE"
    
    # Show iptables rules for verification
    log "Current OUTPUT chain rules:"
    iptables -L OUTPUT -n -v | head -10 || true
}

# Check if Transmission is still running by checking if port 9091 is listening
# Since Transmission uses network_mode: "service:vpn", it shares this container's network namespace
is_transmission_running() {
    # Try multiple methods to check if port 9091 is listening
    # Method 1: Use ss (socket statistics) - modern and fast
    if command -v ss >/dev/null 2>&1 && ss -ln | grep -q ":9091 "; then
        return 0  # Port is listening, Transmission is running
    fi
    
    # Method 2: Use netstat (fallback)
    if command -v netstat >/dev/null 2>&1 && netstat -ln 2>/dev/null | grep -q ":9091 "; then
        return 0  # Port is listening, Transmission is running
    fi
    
    # Method 3: Try to connect with netcat (most reliable, already installed)
    if nc -z localhost 9091 2>/dev/null; then
        return 0  # Port is listening, Transmission is running
    fi
    
    # Port is not listening, Transmission has shut down
    return 1
}

# Wait for Transmission to shut down gracefully
# Since Transmission uses network_mode: "service:vpn", Docker will stop it first.
# We check if port 9091 is still listening and exit early when Transmission shuts down.
wait_for_transmission_shutdown() {
    local max_wait=${1:-10}  # Maximum wait time (matches Transmission stop_grace_period)
    local check_interval=1   # Check every second
    local elapsed=0
    
    log "Waiting for Transmission to shut down gracefully (max ${max_wait}s)..."
    log "  (Checking if Transmission port 9091 is still listening)"
    
    # Poll port 9091 until it's no longer listening or max wait time is reached
    while [ $elapsed -lt $max_wait ]; do
        if ! is_transmission_running; then
            log "✓ Transmission has shut down (port 9091 no longer listening) after ${elapsed}s"
            return 0
        fi
        
        # Log progress every 5 seconds
        if [ $((elapsed % 5)) -eq 0 ] && [ $elapsed -gt 0 ]; then
            log "  Still waiting... Transmission port 9091 is still listening (${elapsed}/${max_wait}s)"
        fi
        
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
    done
    
    # Final check
    if ! is_transmission_running; then
        log "✓ Transmission has shut down (port 9091 no longer listening) after ${elapsed}s"
        return 0
    else
        log "WARNING: Transmission port 9091 still listening after ${max_wait}s, proceeding anyway"
        return 1
    fi
}

# Graceful shutdown function
graceful_shutdown() {
    if [ $SHUTDOWN_REQUESTED -eq 1 ]; then
        return 0  # Already shutting down
    fi
    
    SHUTDOWN_REQUESTED=1
    log "=== Graceful shutdown initiated ==="
    
    # Step 1: Wait for Transmission to shut down first
    log "Step 1: Waiting for Transmission to shut down gracefully..."
    wait_for_transmission_shutdown 10
    
    # Step 2: Stop health monitoring
    if [ -n "$MONITOR_PID" ] && kill -0 "$MONITOR_PID" 2>/dev/null; then
        log "Step 2: Stopping health monitoring..."
        kill "$MONITOR_PID" 2>/dev/null || true
        wait "$MONITOR_PID" 2>/dev/null || true
    fi
    
    # Step 3: Disconnect from Tailscale network (must be done while daemon is running)
    log "Step 3: Disconnecting from Tailscale network..."
    tailscale down 2>/dev/null || true
    
    # Step 4: Shut down Tailscale daemon gracefully
    if [ -n "$TAILSCALED_PID" ] && kill -0 "$TAILSCALED_PID" 2>/dev/null; then
        log "Step 4: Shutting down Tailscale daemon gracefully..."
        # Send SIGTERM to tailscaled for graceful shutdown
        kill -TERM "$TAILSCALED_PID" 2>/dev/null || true
        
        # Wait up to 10 seconds for tailscaled to shut down
        local wait_count=0
        while [ $wait_count -lt 10 ]; do
            if ! kill -0 "$TAILSCALED_PID" 2>/dev/null; then
                log "✓ Tailscale daemon shut down gracefully"
                break
            fi
            sleep 1
            wait_count=$((wait_count + 1))
        done
        
        # If still running, force kill
        if kill -0 "$TAILSCALED_PID" 2>/dev/null; then
            log "WARNING: Tailscale daemon did not shut down gracefully, forcing termination"
            kill -KILL "$TAILSCALED_PID" 2>/dev/null || true
        fi
    fi
    
    # Step 5: Clean up iptables rules (restore default policy)
    log "Step 5: Cleaning up iptables rules..."
    iptables -P OUTPUT ACCEPT 2>/dev/null || true
    iptables -F OUTPUT 2>/dev/null || true
    
    log "=== Graceful shutdown completed ==="
    exit 0
}

# Signal handler setup
setup_signal_handlers() {
    trap 'log "Received SIGTERM, initiating graceful shutdown..."; graceful_shutdown' SIGTERM
    trap 'log "Received SIGINT, initiating graceful shutdown..."; graceful_shutdown' SIGINT
    log "Signal handlers installed for graceful shutdown"
}

# Monitor health in background
monitor_health() {
    log "Starting health monitoring loop..."
    while [ $SHUTDOWN_REQUESTED -eq 0 ]; do
        sleep 30
        
        # Break if shutdown requested
        if [ $SHUTDOWN_REQUESTED -eq 1 ]; then
            break
        fi
        
        # Check if interface exists and is up
        if ! ip link show "$TAILSCALE_INTERFACE" >/dev/null 2>&1; then
            log "WARNING: Tailscale interface $TAILSCALE_INTERFACE not found"
            continue
        fi
        
        if ! ip link show "$TAILSCALE_INTERFACE" | grep -q "LOWER_UP"; then
            log "WARNING: Tailscale interface $TAILSCALE_INTERFACE is down"
            continue
        fi
        
        # Verify Tailscale is still connected (more reliable than routing table check)
        if ! tailscale status >/dev/null 2>&1; then
            log "WARNING: Tailscale status check failed, re-applying kill switch"
            activate_kill_switch
            continue
        fi
        
        # Verify control plane is still reachable
        if ! curl -s -I --max-time 5 https://controlplane.tailscale.com >/dev/null 2>&1; then
            log "WARNING: Control plane is not reachable, re-applying kill switch"
            activate_kill_switch
            continue
        fi
        
        # Verify exit node is still reachable
        if ! ping -c 1 -W 2 "$TAILSCALE_EXIT_NODE" >/dev/null 2>&1; then
            log "WARNING: Exit node $TAILSCALE_EXIT_NODE is not reachable"
        fi
    done
    log "Health monitoring stopped"
}

# Main startup sequence
main() {
    # Setup signal handlers for graceful shutdown
    setup_signal_handlers
    
    log "Starting Tailscale VPN service with kill switch..."
    
    # Validate required environment variables
    if [ -z "$TAILSCALE_AUTH_KEY" ]; then
        error_exit "TAILSCALE_AUTH_KEY environment variable is required"
    fi
    
    if [ -z "$TAILSCALE_EXIT_NODE" ]; then
        error_exit "TAILSCALE_EXIT_NODE environment variable is required"
    fi
    
    # Start Tailscale daemon in background
    log "Starting Tailscale daemon..."
    tailscaled --state="$TAILSCALE_STATE_DIR/tailscaled.state" &
    TAILSCALED_PID=$!
    
    # Wait a moment for daemon to start
    sleep 2
    
    # Authenticate with Tailscale
    log "Authenticating with Tailscale and configuring exit node $TAILSCALE_EXIT_NODE..."
    tailscale up \
        --authkey="$TAILSCALE_AUTH_KEY" \
        --hostname="$TAILSCALE_HOSTNAME" \
        --exit-node="$TAILSCALE_EXIT_NODE" \
        --accept-routes=false \
        --advertise-exit-node=false \
        --reset || error_exit "Failed to authenticate with Tailscale"
    
    # Wait for interface to be created
    wait_for_interface
    
    # Wait for interface to be up with IP
    wait_for_interface_up
    
    # Wait for Tailscale to establish connections and stabilize
    log "Waiting for Tailscale to establish connections..."
    sleep 10
    
    # Phase 2: Verify Tailscale is fully operational BEFORE activating kill switch
    log "=== Phase 2: Verifying Tailscale is operational ==="
    
    # Test control plane connectivity (critical test)
    if ! test_control_plane; then
        error_exit "Control plane is not reachable. Cannot proceed with kill switch activation."
    fi
    
    # Verify Tailscale status shows connected
    log "Checking Tailscale status..."
    if ! tailscale status >/dev/null 2>&1; then
        error_exit "Tailscale status check failed. Cannot proceed with kill switch activation."
    fi
    log "✓ Tailscale status: OK"
    
    # Test external connectivity through exit node
    log "Testing external connectivity through exit node..."
    local external_ip
    external_ip=$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null || echo "")
    if [ -n "$external_ip" ]; then
        log "✓ External IP: $external_ip (traffic routing through exit node)"
    else
        log "WARNING: Cannot verify external IP, but continuing..."
    fi
    
    # Verify exit node is reachable (optional, may be flaky)
    log "Testing exit node connectivity..."
    if tailscale ping -c 1 "$TAILSCALE_EXIT_NODE" >/dev/null 2>&1; then
        log "✓ Exit node $TAILSCALE_EXIT_NODE is reachable"
    else
        log "WARNING: Exit node ping failed, but continuing (may be normal)"
    fi
    
    log "=== All Phase 2 pre-checks passed ==="
    log "Tailscale is fully operational. Activating kill switch..."
    
    # Activate kill switch AFTER all verifications pass
    activate_kill_switch
    
    # Verify kill switch didn't break connectivity
    log "Verifying connectivity after kill switch activation..."
    sleep 3
    
    if ! test_control_plane; then
        log "ERROR: Control plane became unreachable after kill switch activation!"
        log "Kill switch may be too restrictive. Check iptables rules."
        # Don't exit - let it try to recover
    else
        log "✓ Control plane still reachable after kill switch"
    fi
    
    log "VPN service is ready. Kill switch is active."
    log "Tailscale status:"
    tailscale status || true
    
    # Start health monitoring in background
    monitor_health &
    MONITOR_PID=$!
    
    # Wait for tailscaled process (or until shutdown requested)
    while [ $SHUTDOWN_REQUESTED -eq 0 ]; do
        if ! kill -0 "$TAILSCALED_PID" 2>/dev/null; then
            log "Tailscale daemon exited"
            break
        fi
        sleep 1
    done
    
    # If shutdown was requested, graceful_shutdown was already called
    # Otherwise, tailscaled exited unexpectedly
    if [ $SHUTDOWN_REQUESTED -eq 0 ]; then
        log "Tailscale daemon exited unexpectedly, cleaning up..."
        graceful_shutdown
    fi
}

# Run main function
main

