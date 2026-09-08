from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address


class _NoopLimiter:
    enabled = False

    def limit(self, *_args, **_kwargs):
        def decorator(func):
            return func

        return decorator


if os.getenv("VERCEL") or os.getenv("VERCEL_URL"):
    limiter = _NoopLimiter()  # type: ignore[assignment]
else:
    limiter = Limiter(key_func=get_remote_address, application_limits=["240/minute"])
