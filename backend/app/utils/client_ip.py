"""Trusted-proxy client IP address resolution.

Safely evaluates X-Forwarded-For only when the immediate network peer is a configured
trusted proxy. Never trusts spoofed client headers from untrusted connections.
"""

import ipaddress
import logging
from fastapi import Request

from app.config.runtime import get_runtime_config

logger = logging.getLogger("sentinel.client_ip")


def get_client_ip(request: Request) -> str:
    """Resolve genuine client IP address using trusted proxy network ranges.
    
    If the immediate socket peer belongs to TRUSTED_PROXY_CIDRS, parses X-Forwarded-For
    from right to left, skipping intermediate trusted proxies, to find the first untrusted IP.
    If no trusted proxies are configured or the peer is not trusted, returns the direct socket peer.
    """
    if not request.client or not request.client.host:
        return "unknown"

    peer_ip = request.client.host
    config = get_runtime_config()
    trusted_cidrs = getattr(config, "trusted_proxy_cidrs", ())
    if not trusted_cidrs:
        return peer_ip

    try:
        peer_addr = ipaddress.ip_address(peer_ip)
    except ValueError:
        return peer_ip

    # Check if immediate network peer is inside any trusted CIDR
    peer_is_trusted = any(peer_addr in net for net in trusted_cidrs)
    if not peer_is_trusted:
        return peer_ip

    # Peer is a trusted proxy: evaluate X-Forwarded-For header
    xff = request.headers.get("x-forwarded-for")
    if not xff:
        return peer_ip

    parts = [p.strip() for p in xff.split(",") if p.strip()]
    # Walk from right to left
    for candidate in reversed(parts):
        try:
            cand_addr = ipaddress.ip_address(candidate)
        except ValueError:
            continue

        is_trusted = any(cand_addr in net for net in trusted_cidrs)
        if not is_trusted:
            return str(cand_addr)

    return peer_ip
