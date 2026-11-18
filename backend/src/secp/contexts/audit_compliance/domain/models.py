from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import hashlib
import json
from typing import Any, Optional


@dataclass(frozen=True)
class AuditLogEntry:
    """RNF-Auditoria Imutável: trilha transacional de todas as mutações e acessos sensíveis."""

    id: str
    user_id: str
    active_profile: str
    action: str
    entity_type: str
    entity_id: str
    before_state: Optional[dict[str, Any]]
    after_state: Optional[dict[str, Any]]
    ip_address: str
    user_agent: str
    timestamp: datetime
    integrity_hash: str

    @staticmethod
    def compute_entry_hash(
        user_id: str,
        active_profile: str,
        action: str,
        entity_type: str,
        entity_id: str,
        before_state: Optional[dict[str, Any]],
        after_state: Optional[dict[str, Any]],
        timestamp_iso: str,
    ) -> str:
        payload = json.dumps(
            {
                "user_id": user_id,
                "active_profile": active_profile,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "before_state": before_state,
                "after_state": after_state,
                "timestamp": timestamp_iso,
            },
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()
