FROM tailscale/tailscale:latest

# Install required packages for networking and health checks
RUN apk add --no-cache \
    iptables \
    iproute2 \
    bash \
    curl \
    iputils \
    netcat-openbsd

# Copy scripts
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY healthcheck.sh /usr/local/bin/healthcheck.sh
COPY configure-routing.sh /usr/local/bin/configure-routing.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/healthcheck.sh \
    && chmod +x /usr/local/bin/configure-routing.sh

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

