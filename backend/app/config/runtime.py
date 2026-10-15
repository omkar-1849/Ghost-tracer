"""Lazy, fail-closed process configuration. Never include secrets in diagnostics."""
import ipaddress
import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy.engine import make_url

logger = logging.getLogger(__name__)


def _load_dotenv_if_present():
    """Load key-value pairs from a local .env file using standard library if present.
    Uses setdefault so existing process environment variables always take precedence.
    """
    search_paths = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[3] / ".env",
    ]
    seen = set()
    for env_path in search_paths:
        try:
            resolved = env_path.resolve()
            if resolved in seen or not resolved.is_file():
                continue
            seen.add(resolved)
            with open(resolved, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("export "):
                        line = line[7:].strip()
                    if "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip()
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        val = val[1:-1]
                    os.environ.setdefault(key, val)
        except Exception:
            pass


@dataclass(frozen=True)
class RuntimeConfig:
    database_url: str = field(repr=False)
    jwt_secret: str = field(repr=False)
    environment: str
    cors_origins: tuple[str, ...]
    ai_analyst_enabled: bool = False
    ai_analyst_url: str = "http://127.0.0.1:8000/v1/analyze"
    ai_analyst_timeout: int = 5
    ai_analyst_min_risk_score: int = 0
    ai_queue_max_pending: int = 5000
    ai_job_max_attempts: int = 3
    ai_job_backoff_seconds: str = "30,120,600"
    ai_job_lease_seconds: int = 40
    ai_worker_concurrency: int = 1
    ai_worker_embedded: bool = True
    ai_breaker_failures: int = 5
    ai_breaker_cooldown_seconds: int = 60
    registration_mode: str = "open"
    allow_sqlite_in_production: bool = False
    trusted_proxy_cidrs: tuple[str, ...] = ()


@lru_cache(maxsize=1)
def get_runtime_config() -> RuntimeConfig:
    _load_dotenv_if_present()
    environment = os.environ.get("ENVIRONMENT", "production").strip().lower()
    if environment not in {"production", "development", "test"}:
        raise ValueError("ENVIRONMENT must be production, development, or test.")
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret.strip()) < 32 or secret == "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET":
        raise ValueError("JWT_SECRET must be a non-placeholder secret of at least 32 characters.")
    if environment == "production":
        # Reject degenerate secret (e.g. repeated character)
        if len(set(secret.strip())) <= 1:
            raise ValueError("JWT_SECRET must not be a degenerate single-character repeated secret.")

    database_url = os.environ.get("DATABASE_URL", "").strip()
    try:
        parsed_db = make_url(database_url)
        if not parsed_db.drivername or not parsed_db.database:
            raise ValueError
    except Exception:
        raise ValueError("DATABASE_URL must be a valid database connection URL.") from None

    if parsed_db.get_backend_name() == "sqlite" and parsed_db.database != ":memory:" and not os.path.isabs(parsed_db.database):
        backend_dir = Path(__file__).resolve().parents[2]
        rel_db = Path(parsed_db.database)
        if (backend_dir / rel_db).is_file():
            database_url = f"sqlite:///{(backend_dir / rel_db).resolve().as_posix()}"
            parsed_db = make_url(database_url)
        elif rel_db.is_file():
            database_url = f"sqlite:///{rel_db.resolve().as_posix()}"
            parsed_db = make_url(database_url)

    allow_sqlite_in_production = os.environ.get("ALLOW_SQLITE_IN_PRODUCTION", "false").strip().lower() == "true"
    dialect = parsed_db.get_backend_name()
    if environment == "production":
        if dialect == "sqlite":
            if not allow_sqlite_in_production:
                raise ValueError("SQLite is not permitted in production without ALLOW_SQLITE_IN_PRODUCTION=true.")
            logger.warning("Running SQLite in production with explicit opt-in.")
        elif dialect != "mysql":
            raise ValueError(f"Database dialect '{dialect}' is not supported in production (expected mysql).")

    raw_origins = os.environ.get("CORS_ORIGINS")
    if raw_origins is None and environment == "development":
        origins = ("http://localhost:5173", "http://localhost:5174",
                   "http://127.0.0.1:5173", "http://127.0.0.1:5174")
    else:
        origins = tuple(dict.fromkeys(x.strip() for x in (raw_origins or "").split(",") if x.strip()))
    for origin in origins:
        try:
            url = urlsplit(origin)
            valid = (url.scheme in {"http", "https"} and url.hostname and not url.username
                     and not url.password and not url.query and not url.fragment
                     and not url.path and url.port != 0)
            if environment == "production" and url.scheme != "https":
                valid = False
            if not valid:
                raise ValueError
        except ValueError:
            raise ValueError("CORS_ORIGINS must contain explicit HTTP(S) origins (HTTPS in production).") from None

    # Registration Mode (closed in production by default)
    default_reg = "closed" if environment == "production" else "open"
    registration_mode = os.environ.get("REGISTRATION_MODE", default_reg).strip().lower()
    if registration_mode not in {"open", "closed"}:
        raise ValueError("REGISTRATION_MODE must be 'open' or 'closed'.")
    if environment == "production" and registration_mode == "open":
        logger.warning("Registration mode is OPEN in production.")

    # Trusted Proxy CIDRs
    raw_proxies = os.environ.get("TRUSTED_PROXY_CIDRS", "").strip()
    trusted_proxies = []
    if raw_proxies:
        for cidr_str in raw_proxies.split(","):
            cidr_str = cidr_str.strip()
            if not cidr_str:
                continue
            try:
                net = ipaddress.ip_network(cidr_str, strict=False)
                if str(net) in ("0.0.0.0/0", "::/0"):
                    raise ValueError("Wildcard proxy CIDR is not permitted.")
                trusted_proxies.append(str(net))
            except ValueError as exc:
                raise ValueError(f"Invalid TRUSTED_PROXY_CIDRS entry '{cidr_str}': {exc}") from None
    trusted_proxy_cidrs = tuple(trusted_proxies)

    ai_analyst_enabled = os.environ.get("AI_ANALYST_ENABLED", "false").strip().lower() == "true"
    ai_analyst_url = os.environ.get("AI_ANALYST_URL", "http://127.0.0.1:8000/v1/analyze").strip()
    try:
        ai_analyst_timeout = int(os.environ.get("AI_ANALYST_TIMEOUT", "5").strip())
        if ai_analyst_timeout <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_ANALYST_TIMEOUT must be a positive integer.")

    try:
        ai_analyst_min_risk_score = int(os.environ.get("AI_ANALYST_MIN_RISK_SCORE", "0").strip())
        if ai_analyst_min_risk_score < 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_ANALYST_MIN_RISK_SCORE must be a non-negative integer.")

    try:
        ai_queue_max_pending = int(os.environ.get("AI_QUEUE_MAX_PENDING", "5000").strip())
        if ai_queue_max_pending <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_QUEUE_MAX_PENDING must be a positive integer.")

    try:
        ai_job_max_attempts = int(os.environ.get("AI_JOB_MAX_ATTEMPTS", "3").strip())
        if ai_job_max_attempts <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_JOB_MAX_ATTEMPTS must be a positive integer.")

    ai_job_backoff_seconds = os.environ.get("AI_JOB_BACKOFF_SECONDS", "30,120,600").strip()

    try:
        ai_job_lease_seconds = int(os.environ.get("AI_JOB_LEASE_SECONDS", str(2 * ai_analyst_timeout + 30)).strip())
        if ai_job_lease_seconds <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_JOB_LEASE_SECONDS must be a positive integer.")

    try:
        ai_worker_concurrency = int(os.environ.get("AI_WORKER_CONCURRENCY", "1").strip())
        if ai_worker_concurrency <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI_WORKER_CONCURRENCY must be a positive integer.")

    ai_worker_embedded = os.environ.get("AI_WORKER_EMBEDDED", "true").strip().lower() == "true"

    try:
        ai_breaker_failures = int(os.environ.get("AI_BREAKER_FAILURES", "5").strip())
        ai_breaker_cooldown_seconds = int(os.environ.get("AI_BREAKER_COOLDOWN_SECONDS", "60").strip())
        if ai_breaker_failures <= 0 or ai_breaker_cooldown_seconds <= 0:
            raise ValueError
    except ValueError:
        raise ValueError("AI breaker settings must be positive integers.")

    if ai_analyst_enabled and ai_analyst_url.startswith("http://") and not (
        "localhost" in ai_analyst_url or "127.0.0.1" in ai_analyst_url
    ):
        logger.warning("AI_ANALYST_URL is using non-loopback plaintext HTTP.")

    return RuntimeConfig(
        database_url=database_url,
        jwt_secret=secret,
        environment=environment,
        cors_origins=origins,
        ai_analyst_enabled=ai_analyst_enabled,
        ai_analyst_url=ai_analyst_url,
        ai_analyst_timeout=ai_analyst_timeout,
        ai_analyst_min_risk_score=ai_analyst_min_risk_score,
        ai_queue_max_pending=ai_queue_max_pending,
        ai_job_max_attempts=ai_job_max_attempts,
        ai_job_backoff_seconds=ai_job_backoff_seconds,
        ai_job_lease_seconds=ai_job_lease_seconds,
        ai_worker_concurrency=ai_worker_concurrency,
        ai_worker_embedded=ai_worker_embedded,
        ai_breaker_failures=ai_breaker_failures,
        ai_breaker_cooldown_seconds=ai_breaker_cooldown_seconds,
        registration_mode=registration_mode,
        allow_sqlite_in_production=allow_sqlite_in_production,
        trusted_proxy_cidrs=trusted_proxy_cidrs,
    )
