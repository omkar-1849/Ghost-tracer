"""Sentinel Collector Daemon.

High-performance, lightweight log collector that tails web server and application logs,
batches and compresses telemetry events, and delivers them to Sentinel API.
"""

from sentinel_collector.parser import parse_log_line, parse_nginx_log_line

__version__ = "1.0.0"
__all__ = ["parse_log_line", "parse_nginx_log_line", "__version__"]
