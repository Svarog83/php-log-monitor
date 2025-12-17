#!/bin/bash
set -euo pipefail

TAILSCALE_INTERFACE="${TAILSCALE_INTERFACE:-tailscale0}"
TAILSCALE_EXIT_NODE="${TAILSCALE_EXIT_NODE:-}"

# Check if interface exists
if ! ip link show "$TAILSCALE_INTERFACE" >/dev/null 2>&1; then
    echo "Health check failed: Interface $TAILSCALE_INTERFACE does not exist"
    exit 1
fi

# Check if interface is up (TUN interfaces show UNKNOWN state but LOWER_UP indicates it's working)
if ! ip link show "$TAILSCALE_INTERFACE" | grep -q "LOWER_UP"; then
    echo "Health check failed: Interface $TAILSCALE_INTERFACE is not up"
    exit 1
fi

# Check if interface has an IP address
if ! ip addr show "$TAILSCALE_INTERFACE" | grep -q "inet "; then
    echo "Health check failed: Interface $TAILSCALE_INTERFACE has no IP address"
    exit 1
fi

# Check Tailscale status (more reliable than routing table check)
if ! tailscale status >/dev/null 2>&1; then
    echo "Health check failed: Tailscale status check failed"
    exit 1
fi

# Check control plane connectivity (most reliable test)
if ! curl -s -I --max-time 5 https://controlplane.tailscale.com >/dev/null 2>&1; then
    echo "Health check failed: Control plane (controlplane.tailscale.com) is not reachable"
    exit 1
fi

# Optional: Check exit node reachability (may be flaky, so we make it non-fatal)
if [ -n "$TAILSCALE_EXIT_NODE" ]; then
    if ! tailscale ping -c 1 "$TAILSCALE_EXIT_NODE" >/dev/null 2>&1; then
        # This is a warning, not a failure - exit node ping can be flaky
        echo "Health check warning: Exit node $TAILSCALE_EXIT_NODE ping failed (non-fatal)"
    fi
fi

# All critical checks passed
exit 0

