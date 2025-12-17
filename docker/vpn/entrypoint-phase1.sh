#!/bin/bash
set -euo pipefail

# Phase 1: Basic Tailscale Setup (No Kill Switch)
# Goal: Get Tailscale working with exit node, verify connectivity

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

# Wait for interface to be created
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
    local max_attempts=60
    local attempt=0
    
    log "Waiting for Tailscale interface to be up..."
    while [ $attempt -lt $max_attempts ]; do
        if ip addr show "$TAILSCALE_INTERFACE" 2>/dev/null | grep -q "inet "; then
            if ip link show "$TAILSCALE_INTERFACE" 2>/dev/null | grep -q "LOWER_UP"; then
                log "Tailscale interface $TAILSCALE_INTERFACE is up with IP"
                return 0
            fi
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    error_exit "Tailscale interface $TAILSCALE_INTERFACE did not come up after ${max_attempts} seconds"
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

# Test exit node connectivity
test_exit_node() {
    if [ -z "$TAILSCALE_EXIT_NODE" ]; then
        log "No exit node configured, skipping exit node test"
        return 0
    fi
    
    log "Testing connectivity to exit node $TAILSCALE_EXIT_NODE..."
    if tailscale ping -c 1 "$TAILSCALE_EXIT_NODE" >/dev/null 2>&1; then
        log "✓ Exit node $TAILSCALE_EXIT_NODE is reachable"
        return 0
    else
        log "✗ Exit node $TAILSCALE_EXIT_NODE is NOT reachable"
        return 1
    fi
}

# Test external connectivity through exit node
test_external_connectivity() {
    log "Testing external connectivity through exit node..."
    local external_ip
    external_ip=$(curl -s --max-time 10 https://api.ipify.org 2>/dev/null || echo "")
    
    if [ -n "$external_ip" ]; then
        log "✓ External IP: $external_ip (should be exit node's public IP)"
        return 0
    else
        log "✗ Cannot reach external IP service"
        return 1
    fi
}

# Show routing information
show_routing_info() {
    log "=== Routing Information ==="
    log "Default route:"
    ip route show default | head -1 || log "  (no default route)"
    log ""
    log "All routes:"
    ip route show | head -10
    log ""
    log "Interface $TAILSCALE_INTERFACE:"
    ip addr show "$TAILSCALE_INTERFACE" | grep -E "(inet |state)" || log "  (interface not found)"
    log "==========================="
}

# Main startup sequence
main() {
    log "=== Phase 1: Basic Tailscale Setup (No Kill Switch) ==="
    
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
    sleep 3
    
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
    
    # Wait a bit for Tailscale to establish connections
    log "Waiting for Tailscale to establish connections..."
    sleep 5
    
    # Show current state
    log "=== Tailscale Status ==="
    tailscale status || log "  (tailscale status failed)"
    log ""
    
    # Show routing information
    show_routing_info
    
    # Test connectivity
    log ""
    log "=== Connectivity Tests ==="
    test_control_plane || log "WARNING: Control plane test failed"
    test_exit_node || log "WARNING: Exit node test failed"
    test_external_connectivity || log "WARNING: External connectivity test failed"
    
    log ""
    log "=== Phase 1 Complete ==="
    log "Tailscale is running. No kill switch is active."
    log "Verify all tests pass before proceeding to Phase 2."
    log ""
    log "To check status manually:"
    log "  docker compose exec vpn tailscale status"
    log "  docker compose exec vpn curl -I https://controlplane.tailscale.com"
    log "  docker compose exec vpn curl -s https://api.ipify.org"
    log ""
    
    # Keep container running
    log "Keeping container running. Press Ctrl+C to stop."
    wait $TAILSCALED_PID
}

# Run main function
main

