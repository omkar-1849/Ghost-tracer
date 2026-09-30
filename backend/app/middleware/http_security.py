import json
import logging

from starlette.responses import JSONResponse

logger = logging.getLogger("sentinel.http")


class SecurityMiddleware:
    def __init__(self, app, max_body_bytes=262144):
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope.get("headers", []))
        try:
            declared_length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"detail": "Invalid content length."}, 400)(scope, receive, send)
        if declared_length < 0 or declared_length > self.max_body_bytes:
            return await JSONResponse({"detail": "Request body too large."}, 413)(scope, receive, send)
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body = message.get("body", b"")
            size += len(body)
            if size > self.max_body_bytes:
                return await JSONResponse({"detail": "Request body too large."}, 413)(scope, receive, send)
            chunks.append(body)
            if not message.get("more_body", False):
                break
        payload = b"".join(chunks)
        sent = False
        started = False

        async def bounded_receive():
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": payload, "more_body": False}
            return await receive()

        async def secure_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                response_headers = list(message.get("headers", []))
                response_headers.extend([
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"cache-control", b"no-store"),
                    (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"),
                ])
                message["headers"] = response_headers
            await send(message)
        try:
            await self.app(scope, bounded_receive, secure_send)
        except Exception as exc:
            logger.error("Request failed (%s)", type(exc).__name__)
            if started:
                raise
            await JSONResponse({"detail": "Request could not be completed."}, 500)(scope, receive, secure_send)
