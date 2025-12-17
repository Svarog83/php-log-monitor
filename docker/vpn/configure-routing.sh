#!/bin/bash
set -euo pipefail

EXIT_NODE_IP="${1:-}"
TAILSCALE_INTERFACE="${2:-tailscale0}"

if [ -z "$EXIT_NODE_IP" ]; then
    echo "Usage: $0 <exit_node_ip> [interface]" >&2
    exit 1
fi

# Tailscale with --exit-node should automatically configure routing
# We just need to verify that the default route points to the Tailscale interface
# Wait a moment for Tailscale to configure routing
sleep 3

# Check if default route exists and points to Tailscale interface
MAX_ATTEMPTS=10
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    DEFAULT_ROUTE=$(ip route show default 2>/dev/null | head -n1)
    
    if [ -n "$DEFAULT_ROUTE" ] && echo "$DEFAULT_ROUTE" | grep -q "dev $TAILSCALE_INTERFACE"; then
        echo "Default route verified: $DEFAULT_ROUTE"
        echo "All traffic will be routed through $TAILSCALE_INTERFACE to exit node $EXIT_NODE_IP"
        exit 0
    fi
    
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

# If Tailscale didn't configure routing automatically, try to configure it manually
echo "Tailscale did not configure routing automatically, attempting manual configuration..."

# Get the gateway IP for the Tailscale interface
# For point-to-point interfaces, use the interface IP itself
GATEWAY_IP=$(ip addr show "$TAILSCALE_INTERFACE" | grep "inet " | awk '{print $2}' | cut -d'/' -f1 | head -n1)

if [ -z "$GATEWAY_IP" ]; then
    echo "ERROR: Could not determine IP for interface $TAILSCALE_INTERFACE" >&2
    exit 1
fi

# Delete existing default route if it doesn't point to our interface
CURRENT_DEFAULT=$(ip route show default 2>/dev/null | head -n1)
if [ -n "$CURRENT_DEFAULT" ] && ! echo "$CURRENT_DEFAULT" | grep -q "dev $TAILSCALE_INTERFACE"; then
    echo "Removing existing default route: $CURRENT_DEFAULT"
    ip route del default 2>/dev/null || true
fi

# Add default route through Tailscale interface (point-to-point, no gateway needed)
if ! ip route show default 2>/dev/null | grep -q "dev $TAILSCALE_INTERFACE"; then
    echo "Adding default route through $TAILSCALE_INTERFACE"
    ip route add default dev "$TAILSCALE_INTERFACE" || {
        echo "ERROR: Failed to add default route" >&2
        exit 1
    }
fi

# Verify the route was added correctly
VERIFIED_ROUTE=$(ip route show default 2>/dev/null | grep "dev $TAILSCALE_INTERFACE" | head -n1)
if [ -z "$VERIFIED_ROUTE" ]; then
    echo "ERROR: Failed to verify default route configuration" >&2
    exit 1
fi

echo "Default route configured: $VERIFIED_ROUTE"
echo "All traffic will be routed through $TAILSCALE_INTERFACE to exit node $EXIT_NODE_IP"

exit 0

