"""Destination policy for manual authorized checks.

HTTP sockets use a validated numeric address, preserving Host and TLS SNI.
External programs can resolve or discover other destinations: this validation is
NOT an egress sandbox. Such tools require independent network isolation.
"""
from dataclasses import dataclass
import http.client
import ipaddress
import os
import re
import socket
import ssl
import time
from urllib.parse import urlsplit, urlunsplit


class DestinationError(ValueError):
    """Safe-to-display policy or transport failure (never includes a target)."""


@dataclass(frozen=True)
class Destination:
    url: str
    scheme: str
    hostname: str
    port: int
    addresses: tuple[str, ...]
    target: str
    host_header: str


def _public(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return (ip.is_global and not ip.is_multicast and not ip.is_unspecified
            and not ip.is_reserved and not ip.is_loopback and not ip.is_link_local
            and not getattr(ip, 'ipv4_mapped', None)
            and not (isinstance(ip, ipaddress.IPv6Address) and
                     (ip.sixtofour is not None or ip.teredo is not None
                      or ip in ipaddress.ip_network('64:ff9b::/96')
                      or ip in ipaddress.ip_network('64:ff9b:1::/48'))))


def validate_destination(url: str) -> Destination:
    if (not isinstance(url, str) or not url or len(url) > 2048
            or re.search(r'[\x00-\x20\x7f\\]', url)):
        raise DestinationError('Invalid destination URL.')
    try:
        parts = urlsplit(url)
        if parts.scheme not in ('http', 'https') or not parts.netloc or parts.fragment:
            raise ValueError()
        if parts.username is not None or parts.password is not None or '%' in parts.netloc:
            raise ValueError()
        hostname = parts.hostname
        if not hostname or hostname.endswith('.'):
            raise ValueError()
        hostname = hostname.encode('idna').decode('ascii').lower()
        port = parts.port or (443 if parts.scheme == 'https' else 80)
        allowed = {int(p.strip()) for p in os.getenv('SENTINEL_ALLOWED_DESTINATION_PORTS', '80,443').split(',')}
        if not allowed or any(p < 1 or p > 65535 for p in allowed) or port not in allowed:
            raise ValueError()
        try:
            literal = ipaddress.ip_address(hostname)
        except ValueError:
            literal = None
        if literal is None:
            if ('.' not in hostname or hostname.endswith(('.localhost', '.local', '.internal', '.test', '.invalid'))
                    or len(hostname) > 253 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label)
                                               for label in hostname.split('.'))):
                raise ValueError()
            answers = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
            addresses = tuple(dict.fromkeys(row[4][0] for row in answers))
        else:
            addresses = (str(literal),)
        if not addresses or any(not _public(address) for address in addresses):
            raise ValueError()
        host = f'[{hostname}]' if ':' in hostname else hostname
        if port != (443 if parts.scheme == 'https' else 80):
            host += f':{port}'
        path = parts.path or '/'
        # Request targets must be ASCII; clients must percent-encode non-ASCII paths.
        target = path + (('?' + parts.query) if parts.query else '')
        target.encode('ascii')
        normalized = urlunsplit((parts.scheme, host, path, parts.query, ''))
        return Destination(normalized, parts.scheme, hostname, port, addresses, target, host)
    except (ValueError, UnicodeError, OSError, OverflowError):
        raise DestinationError('Destination is not permitted or DNS resolution failed.') from None


def connect_pinned(destination: Destination, timeout: float = 10):
    """One connection, no fallback or DNS retry; caller owns the returned socket."""
    address = destination.addresses[0]
    family = socket.AF_INET6 if ':' in address else socket.AF_INET
    sock = socket.socket(family, socket.SOCK_STREAM)
    try:
        sock.settimeout(timeout)
        sock.connect((address, destination.port))
        return sock
    except BaseException:
        sock.close()
        raise


@dataclass(frozen=True)
class FetchResponse:
    status_code: int
    content: bytes
    headers: dict[str, str]
    url: str
    destination: Destination

    @property
    def text(self):
        return self.content.decode('utf-8', errors='replace')


class _PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, destination, timeout):
        super().__init__(destination.hostname, destination.port, timeout=timeout)
        self.destination = destination

    def connect(self):
        self.sock = connect_pinned(self.destination, self.timeout)
        if self.destination.scheme == 'https':
            try:
                self.sock = ssl.create_default_context().wrap_socket(
                    self.sock, server_hostname=self.destination.hostname)
            except BaseException:
                self.sock.close()
                raise


def safe_fetch(url: str, *, timeout: float = 10, max_bytes: int = 65536) -> FetchResponse:
    """Bounded GET only, no proxies/cookies/auth, no redirects or insecure retry."""
    destination = validate_destination(url)
    timeout = min(max(float(timeout), 0.1), 15)
    max_bytes = min(max(int(max_bytes), 1), 1048576)
    deadline = time.monotonic() + timeout
    connection = _PinnedHTTP(destination, timeout)
    try:
        connection.request('GET', destination.target, headers={
            'Host': destination.host_header, 'Accept-Encoding': 'identity',
            'Connection': 'close', 'User-Agent': 'Sentinel-Ownership-Verification/1'})
        response = connection.getresponse()
        if 300 <= response.status < 400:
            raise DestinationError('Destination redirects are not permitted.')
        length = response.getheader('Content-Length')
        if length is not None and (not length.isdecimal() or int(length) > max_bytes):
            raise DestinationError('Response exceeds the size limit.')
        if response.getheader('Content-Encoding', 'identity').lower() != 'identity':
            raise DestinationError('Encoded responses are not permitted.')
        content = bytearray()
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DestinationError('Destination request timed out.')
            if connection.sock:
                connection.sock.settimeout(remaining)
            chunk = response.read1(min(8192, max_bytes + 1 - len(content)))
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > max_bytes:
                raise DestinationError('Response exceeds the size limit.')
        return FetchResponse(response.status, bytes(content), dict(response.getheaders()), destination.url, destination)
    except DestinationError:
        raise
    except (OSError, ValueError, http.client.HTTPException):
        raise DestinationError('Destination request failed securely.') from None
    finally:
        connection.close()
