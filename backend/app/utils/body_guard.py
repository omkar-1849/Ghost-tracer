import json
import zlib
from fastapi import HTTPException, Request

from app.config.telemetry import (
    TELEMETRY_BATCH_MAX_BODY_BYTES,
    TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES,
)


async def parse_telemetry_body(request: Request) -> dict:
    """Read, guard against bombs, decompress if gzip, and parse JSON body.

    Raises:
        HTTPException(400): Unsupported encoding, corrupt gzip, or invalid JSON.
        HTTPException(413): Payload exceeds body or decompressed size limit.
        HTTPException(422): Body is not a JSON object.
    """
    encoding_header = request.headers.get("Content-Encoding", "").strip().lower()
    if encoding_header and encoding_header not in {"gzip", "identity"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported Content-Encoding: {encoding_header}. Supported: gzip, identity",
        )

    content_length = request.headers.get("Content-Length")
    if content_length:
        try:
            if int(content_length) > TELEMETRY_BATCH_MAX_BODY_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Request body exceeds maximum size of {TELEMETRY_BATCH_MAX_BODY_BYTES} bytes",
                )
        except ValueError:
            pass

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > TELEMETRY_BATCH_MAX_BODY_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Request body exceeds maximum size of {TELEMETRY_BATCH_MAX_BODY_BYTES} bytes",
            )

    if encoding_header == "gzip":
        try:
            decompressor = zlib.decompressobj(wbits=zlib.MAX_WBITS | 16)
            decompressed = bytearray()
            chunk_size = 64 * 1024
            for i in range(0, len(body), chunk_size):
                raw_chunk = body[i : i + chunk_size]
                out_chunk = decompressor.decompress(raw_chunk)
                decompressed.extend(out_chunk)
                if len(decompressed) > TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Decompressed payload exceeds maximum size of {TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES} bytes",
                    )
            decompressed.extend(decompressor.flush())
            if len(decompressed) > TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Decompressed payload exceeds maximum size of {TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES} bytes",
                )
            raw_bytes = bytes(decompressed)
        except zlib.error as exc:
            raise HTTPException(status_code=400, detail="Corrupt or invalid gzip payload") from exc
    else:
        if len(body) > TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Payload exceeds maximum size of {TELEMETRY_BATCH_MAX_DECOMPRESSED_BYTES} bytes",
            )
        raw_bytes = bytes(body)

    try:
        data = json.loads(raw_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object")

    return data
