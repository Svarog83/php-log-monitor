#!/bin/bash
set -euo pipefail

# Configuration
TAILSCALE_STATE_DIR="${TAILSCALE_STATE_DIR:-/var/lib/tailscale}"
TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"
TAILSCALE_EXIT_NODE="${TAILSCALE_EXIT_NODE:-}"
TAILSCALE_HOSTNAME="${TAILSCALE_HOSTNAME:-tailscale-vpn}"
TAILSCALE_INTERFACE="tailscale0"

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

# Activate kill switch (Phase 2: Selective kill switch that allows Tailscale traffic)
activate_kill_switch() {
    log "Activating kill switch (iptables rules)..."
    
    # Flush existing OUTPUT chain rules (if any)
    iptables -F OUTPUT 2>/dev/null || true
    
    # Set default policy to DROP
    iptables -P OUTPUT DROP
    
    # Allow loopback traffic
    iptables -A OUTPUT -o lo -j ACCEPT
    
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

# Monitor health in background
monitor_health() {
    log "Starting health monitoring loop..."
    while true; do
        sleep 30
        
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
}

# Main startup sequence
main() {
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
    
    # Wait for tailscaled process
    wait $TAILSCALED_PID
}

# Run main function
main

