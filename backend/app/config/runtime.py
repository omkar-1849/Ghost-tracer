"""Lazy, fail-closed process configuration. Never include secrets in diagnostics."""
import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from sqlalchemy.engine import make_url


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


@lru_cache(maxsize=1)
def get_runtime_config() -> RuntimeConfig:
    _load_dotenv_if_present()
    environment = os.environ.get("ENVIRONMENT", "production").strip().lower()
    if environment not in {"production", "development", "test"}:
        raise ValueError("ENVIRONMENT must be production, development, or test.")
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret.strip()) < 32 or secret == "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET":
        raise ValueError("JWT_SECRET must be a non-placeholder secret of at least 32 characters.")
    database_url = os.environ.get("DATABASE_URL", "").strip()
    try:
        parsed_db = make_url(database_url)
        if not parsed_db.drivername or not parsed_db.database:
            raise ValueError
    except Exception:
        raise ValueError("DATABASE_URL must be a valid database connection URL.") from None
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
    return RuntimeConfig(database_url, secret, environment, origins)
