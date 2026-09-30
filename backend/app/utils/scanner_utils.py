"""Bounded process containment for existing manually authorized scanner adapters.

This is not a network or filesystem sandbox. External tools require separately
configured egress isolation; validating a URL does not pin an external tool's DNS.
"""
import os
import re
import signal
import subprocess
import tempfile
import threading
import time
from datetime import datetime
from urllib.parse import urlsplit

MAX_OUTPUT_CHARS = 50_000
MAX_PIPE_BYTES = 50_000
MAX_SUBPROCESS_TIMEOUT = 1800


def ist_now():
    """Compatibility name; all new persisted timestamps are UTC."""
    return datetime.utcnow()


_ANSI_RE = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)')
_CONTROL_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]')
_SECRET_RE = re.compile(r'(?i)((?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key)\s*[=:]\s*)([^\r\n]+)')
_QUERY_RE = re.compile(r'(https?://[^\s?]+)\?[^\s]*', re.I)
_CREDENTIAL_RE = re.compile(r'(https?://)[^/\s@]+@', re.I)
_JWT_RE = re.compile(r'\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b')


def redact_text(text, max_length=2000):
    text = _ANSI_RE.sub('', str(text or ''))
    text = _CONTROL_RE.sub('', text)
    text = _CREDENTIAL_RE.sub(r'\1[REDACTED]@', text)
    text = _QUERY_RE.sub(r'\1?[REDACTED]', text)
    text = _SECRET_RE.sub(r'\1[REDACTED]', text)
    text = _JWT_RE.sub('[REDACTED]', text)
    return text[:max_length]


def clean_output(text, max_length=MAX_OUTPUT_CHARS):
    return redact_text(text, max_length)


def redact_data(value):
    if isinstance(value, dict):
        return {redact_text(k, 256): ('[REDACTED]' if re.search(r'(?i)password|token|secret|cookie|authorization|api.?key', str(k))
                                    else redact_data(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_data(v) for v in value]
    if isinstance(value, str):
        return redact_text(value, MAX_OUTPUT_CHARS)
    return value


def resolve_binary(engine):
    if not re.fullmatch(r'[A-Za-z0-9_]{1,30}', engine or ''):
        return None
    path = os.getenv('SENTINEL_SCANNER_BIN_' + engine.upper(), '').strip()
    if not path or not os.path.isabs(path) or not os.path.isfile(path):
        return None
    if os.name == 'nt' and os.path.splitext(path)[1].lower() in ('.bat', '.cmd'):
        return None  # Windows implicitly invokes a shell for these files.
    return os.path.realpath(path)


def check_binary(engine):
    return resolve_binary(engine) is not None


def _allowed_binary(path):
    if not isinstance(path, str) or not os.path.isabs(path):
        return False
    candidate = os.path.normcase(os.path.realpath(path))
    return any(candidate == os.path.normcase(resolved) for key in os.environ
               if key.startswith('SENTINEL_SCANNER_BIN_')
               for resolved in [resolve_binary(key[len('SENTINEL_SCANNER_BIN_'):])] if resolved)


def _scanner_env(cwd):
    # No inherited PATH, PYTHONPATH, HOME config, proxy, DB/JWT/API secrets.
    env = {'HOME': cwd, 'USERPROFILE': cwd, 'TMP': cwd, 'TEMP': cwd,
           'TMPDIR': cwd, 'LANG': 'C.UTF-8', 'NO_PROXY': '*'}
    if os.name == 'nt':
        for key in ('SystemRoot', 'WINDIR'):
            if os.getenv(key):
                env[key] = os.environ[key]
    return env


def terminate_process_tree(process):
    """Best effort, not a sandbox. Windows detached descendants need a Job Object/container."""
    if process is None:
        return
    try:
        if os.name == 'nt':
            root = os.environ.get('SystemRoot', r'C:\Windows')
            taskkill = os.path.join(root, 'System32', 'taskkill.exe')
            subprocess.run([taskkill, '/F', '/T', '/PID', str(process.pid)],
                           stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=3, shell=False,
                           env={'SystemRoot': root})
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except (OSError, subprocess.SubprocessError):
        pass
    try:
        if process.poll() is None:
            process.kill()
        process.wait(timeout=3)
    except (OSError, subprocess.SubprocessError):
        pass


def run_subprocess(cmd, timeout=300, *, cancelled=None):
    """Stream both byte pipes with a combined bound and terminate on cancel/overflow.

    Only explicitly configured absolute binaries may run. Callers cannot pass
    an environment or working directory. Errors are fixed safe strings; raw
    bounded output is for parsing only and must be redacted before persistence.
    """
    result = {'success': False, 'stdout': '', 'stderr': '', 'returncode': -1,
              'error': 'Process could not be started.', 'stdout_truncated': False,
              'stderr_truncated': False, 'truncated': False, 'cancelled': False}
    if (not isinstance(cmd, (list, tuple)) or not cmd or not _allowed_binary(cmd[0])
            or any(not isinstance(arg, str) or '\x00' in arg for arg in cmd)):
        result['error'] = 'Scanner binary is not explicitly configured.'
        return result
    timeout = min(max(float(timeout), 0.1), MAX_SUBPROCESS_TIMEOUT)
    process = None
    overflow = threading.Event()
    reader_error = threading.Event()
    lock = threading.Lock()
    buffers = [bytearray(), bytearray()]
    total = [0]
    readers = []

    def read_pipe(stream, index):
        try:
            while True:
                chunk = stream.read(8192)
                if not chunk:
                    break
                with lock:
                    room = max(0, MAX_PIPE_BYTES - total[0])
                    buffers[index].extend(chunk[:room])
                    total[0] += min(room, len(chunk))
                    if len(chunk) > room:
                        result['stdout_truncated' if index == 0 else 'stderr_truncated'] = True
                        overflow.set()
        except (OSError, ValueError):
            reader_error.set()
        finally:
            stream.close()

    try:
        with tempfile.TemporaryDirectory(prefix='sentinel-scan-', ignore_cleanup_errors=True) as cwd:
            kwargs = ({'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt'
                      else {'start_new_session': True})
            try:
                if cancelled and cancelled():
                    result.update(cancelled=True, error='Scan was cancelled.')
                    return result
                process = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE, shell=False, close_fds=True,
                                           env=_scanner_env(cwd), cwd=cwd, **kwargs)
                readers = [threading.Thread(target=read_pipe, args=(pipe, i), daemon=True)
                           for i, pipe in enumerate((process.stdout, process.stderr))]
                for thread in readers:
                    thread.start()
                deadline = time.monotonic() + timeout
                while True:
                    if cancelled and cancelled():
                        result.update(cancelled=True, error='Scan was cancelled.')
                        break
                    if overflow.is_set():
                        result.update(truncated=True, error='Scanner output exceeded the capture limit.')
                        break
                    if time.monotonic() >= deadline:
                        result['error'] = 'Scanner exceeded its time limit.'
                        break
                    if process.poll() is not None and not any(t.is_alive() for t in readers):
                        result['returncode'] = process.returncode
                        result['success'] = process.returncode == 0 and not reader_error.is_set()
                        result['error'] = None if result['success'] else 'Scanner exited unsuccessfully or output capture failed.'
                        break
                    time.sleep(0.05)
            finally:
                if process is not None:
                    terminate_process_tree(process)
                for thread in readers:
                    thread.join(timeout=1)
    except (OSError, ValueError, subprocess.SubprocessError):
        result['error'] = 'Process execution failed securely.'
    result['truncated'] = result['truncated'] or overflow.is_set()
    if result['truncated']:
        result.update(success=False, error='Scanner output exceeded the capture limit.')
    with lock:
        result['stdout'], result['stderr'] = (bytes(buf).decode('utf-8', errors='replace') for buf in buffers)
    return result


def extract_hostname(url):
    return urlsplit(url).hostname


def extract_host_port(url):
    parsed = urlsplit(url)
    return parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80)


SEVERITY_WEIGHTS = {'critical': 25, 'high': 15, 'medium': 8, 'low': 3, 'info': 1}


def normalize_severity(severity):
    severity = str(severity or '').strip().lower()
    return severity if severity in SEVERITY_WEIGHTS else ('medium' if severity == 'moderate' else 'info')


def calculate_risk_score(findings):
    return min(100, sum(SEVERITY_WEIGHTS[normalize_severity(f.get('severity'))] for f in findings))
