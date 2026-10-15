"""Command line interface for Sentinel Collector Daemon."""

import argparse
import json
import logging
import os
import signal
import sys
from typing import Optional

from sentinel_collector import __version__
from sentinel_collector.daemon import SentinelCollectorDaemon
from sentinel_collector.parser import parse_nginx_log_line


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def cmd_enroll(args):
    """Enroll a new collector instance using an enrollment token."""
    setup_logging(args.verbose)
    server = args.server or os.environ.get("SENTINEL_SERVER_URL", "http://localhost:8000")
    token = args.token or os.environ.get("SENTINEL_ENROLLMENT_TOKEN")
    cred_file = args.credential_file or os.environ.get("SENTINEL_CREDENTIAL_PATH", "sentinel_collector.key")

    if not token:
        print("Error: Enrollment token required (--token or SENTINEL_ENROLLMENT_TOKEN)", file=sys.stderr)
        sys.exit(1)

    daemon = SentinelCollectorDaemon(
        server_url=server,
        log_path="dummy.log",
        credential_path=cred_file,
        enrollment_token=token,
        hostname=args.hostname,
    )
    daemon.ensure_authenticated()
    print(f"Successfully enrolled collector. Key saved to {cred_file}")


def cmd_run(args):
    """Run collector daemon in foreground."""
    setup_logging(args.verbose)
    server = args.server or os.environ.get("SENTINEL_SERVER_URL", "http://localhost:8000")
    token = args.token or os.environ.get("SENTINEL_ENROLLMENT_TOKEN")
    cred_file = args.credential_file or os.environ.get("SENTINEL_CREDENTIAL_PATH", "sentinel_collector.key")
    raw_log_path = args.log_path or os.environ.get("SENTINEL_LOG_PATH", "/var/log/nginx/access.log")
    log_paths = []
    if isinstance(raw_log_path, list):
        for item in raw_log_path:
            for part in str(item).split(","):
                part = part.strip()
                if part:
                    log_paths.append(part)
    elif isinstance(raw_log_path, str):
        for part in raw_log_path.split(","):
            part = part.strip()
            if part:
                log_paths.append(part)
    if not log_paths:
        log_paths = ["/var/log/nginx/access.log"]

    checkpoint = args.checkpoint_file or os.environ.get("SENTINEL_CHECKPOINT_PATH")

    daemon = SentinelCollectorDaemon(
        server_url=server,
        log_path=log_paths,
        credential_path=cred_file,
        checkpoint_path=checkpoint,
        enrollment_token=token,
        batch_size=args.batch_size,
        flush_interval_seconds=args.flush_interval,
        heartbeat_interval_seconds=args.heartbeat_interval,
        hostname=args.hostname,
    )

    # Setup signal handlers
    def handle_sig(sig, frame):
        logging.info("Received shutdown signal, terminating gracefully...")
        daemon.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    daemon.start()


def cmd_test_parse(args):
    """Test log line parsing against sample line or file."""
    if args.line:
        parsed = parse_nginx_log_line(args.line)
        print(json.dumps(parsed, indent=2))
    elif args.file:
        count = 0
        limit = args.limit or 10
        with open(args.file, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                parsed = parse_nginx_log_line(line)
                if parsed:
                    print(json.dumps(parsed))
                    count += 1
                    if count >= limit:
                        break
        print(f"\nSuccessfully parsed {count} lines.")
    else:
        print("Please provide --line or --file to test parse.", file=sys.stderr)
        sys.exit(1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sentinel-collector",
        description="Sentinel Log Collector Daemon for Nginx",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose debug logging")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Enroll command
    p_enroll = subparsers.add_parser("enroll", help="Enroll with Sentinel server and store API key")
    p_enroll.add_argument("--server", help="Sentinel server URL (e.g. https://api.sentinel.example.com)")
    p_enroll.add_argument("--token", help="One-time or multi-use enrollment token")
    p_enroll.add_argument("--credential-file", default="sentinel_collector.key", help="Path to save API key (default: sentinel_collector.key)")
    p_enroll.add_argument("--hostname", help="Override host name reported to server")
    p_enroll.set_defaults(func=cmd_enroll)

    # Run command
    p_run = subparsers.add_parser("run", help="Run the collector daemon (auto-enrolls if token provided)")
    p_run.add_argument("--server", help="Sentinel server URL")
    p_run.add_argument("--token", help="Enrollment token (used only if not yet enrolled)")
    p_run.add_argument("--log-path", action="append", required=True, help="Path to log file to tail (can specify multiple times or comma-separated)")
    p_run.add_argument("--credential-file", default="sentinel_collector.key", help="Path to stored API key file")
    p_run.add_argument("--checkpoint-file", help="Path to tailer checkpoint file")
    p_run.add_argument("--batch-size", type=int, default=100, help="Max items per batch (default: 100, max: 100)")
    p_run.add_argument("--flush-interval", type=float, default=1.0, help="Max batch flush wait time in seconds (default: 1.0)")
    p_run.add_argument("--heartbeat-interval", type=float, default=30.0, help="Heartbeat interval in seconds (default: 30.0)")
    p_run.add_argument("--hostname", help="Override hostname")
    p_run.add_argument("-v", "--verbose", action="store_true", help="Enable verbose debug logging")
    p_run.set_defaults(func=cmd_run)

    # Test-parse command
    p_parse = subparsers.add_parser("test-parse", help="Test Nginx log parser against a line or file")
    p_parse.add_argument("--line", help="Single log line to parse")
    p_parse.add_argument("--file", help="Log file path to test parse")
    p_parse.add_argument("--limit", type=int, default=5, help="Number of lines to parse from file")
    p_parse.set_defaults(func=cmd_test_parse)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
