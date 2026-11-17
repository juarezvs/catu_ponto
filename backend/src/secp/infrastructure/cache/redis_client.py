import json
from typing import Any, Optional
import redis
import redis.asyncio as aioredis
from secp.infrastructure.config.settings import get_secp_settings


_LAST_REDIS_CHECK_TS: float = -1000.0
_LAST_REDIS_STATUS: bool = False


class SecpRedisCacheGateway:
    """
    Gateway de Cache Distribuído e Filas em Redis para o SECP:
    - Armazena permissões RBAC computadas por (user_id, orgao_id) com TTL configurável.
    - Armazena tokens de sessão SSO e invalidação de acesso em tempo real.
    - Armazena cache semântico/normativo do Copiloto SRAG.
    """

    def __init__(self) -> None:
        self._settings = get_secp_settings()
        self._sync_client: Optional[redis.Redis] = None
        self._async_client: Optional[aioredis.Redis] = None

    def get_sync_client(self) -> redis.Redis:
        if self._sync_client is None:
            self._sync_client = redis.Redis.from_url(
                self._settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=0.35,
                socket_timeout=0.35,
            )
        return self._sync_client

    def get_async_client(self) -> aioredis.Redis:
        if self._async_client is None:
            self._async_client = aioredis.from_url(
                self._settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=0.35,
                socket_timeout=0.35,
            )
        return self._async_client

    def is_healthy(self, ttl_seconds: float = 10.0) -> bool:
        import time

        global _LAST_REDIS_CHECK_TS, _LAST_REDIS_STATUS
        now = time.monotonic()
        if now - _LAST_REDIS_CHECK_TS < ttl_seconds:
            return _LAST_REDIS_STATUS
        try:
            _LAST_REDIS_STATUS = bool(self.get_sync_client().ping())
        except Exception:
            _LAST_REDIS_STATUS = False
        _LAST_REDIS_CHECK_TS = now
        return _LAST_REDIS_STATUS

    def get_json(self, key: str) -> Optional[Any]:
        if not self.is_healthy():
            return None
        try:
            raw = self.get_sync_client().get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> bool:
        if not self.is_healthy():
            return False
        try:
            ttl = ttl_seconds or self._settings.REDIS_RBAC_TTL_SECONDS
            payload = json.dumps(value, ensure_ascii=False)
            self.get_sync_client().set(key, payload, ex=ttl)
            return True
        except Exception:
            return False

    def invalidate_prefix(self, prefix: str) -> int:
        try:
            client = self.get_sync_client()
            keys = list(client.scan_iter(f"{prefix}*"))
            if keys:
                return int(client.delete(*keys))
            return 0
        except Exception:
            return 0
