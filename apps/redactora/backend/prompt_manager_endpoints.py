"""
Prompt Manager Utilities — Helper functions for the Admin Prompt Manager.

These functions are imported by server.py and used in the admin endpoint handlers.
The global `db` from server.py is passed as a parameter to avoid circular imports.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Optional

ADMIN_PROMPT_EMAILS = {"dau@urpeailab.com", "admin@urpe.com"}

ADMIN_PROMPT_EMAIL_LIST = sorted(ADMIN_PROMPT_EMAILS)


def is_prompt_admin(email: str) -> bool:
    return email in ADMIN_PROMPT_EMAILS


async def load_module_overrides(module_id: str, db) -> Dict[str, str]:
    """
    Load all active prompt overrides for a module from MongoDB.
    Returns {key: content} dict.
    Used by generation background tasks to get current overrides.
    """
    overrides = {}
    cursor = db.prompt_overrides.find({"module_id": module_id}, {"_id": 0})
    async for doc in cursor:
        overrides[doc["key"]] = doc["content"]
    return overrides


async def get_next_version(module_id: str, key: str, db) -> int:
    """Get the next version number for a prompt key."""
    # CompatCollection.find_one() no acepta sort/projection; usamos find().sort().limit(1).
    _rows = await (
        db.prompt_history
        .find({"module_id": module_id, "key": key})
        .sort("version", -1)
        .limit(1)
        .to_list(1)
    )
    last = _rows[0] if _rows else None
    return (last["version"] + 1) if last else 1


async def save_prompt_override(module_id: str, key: str, content: str, user_email: str, notes: str, db) -> dict:
    """Save a prompt override and create a version history entry."""
    from prompt_registry import get_prompt_default
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get current content for history
    existing = await db.prompt_overrides.find_one(
        {"module_id": module_id, "key": key},
        {"_id": 0}
    )
    
    next_version = await get_next_version(module_id, key, db)
    
    # Archive current value to history
    prev_content = existing["content"] if existing else (get_prompt_default(module_id, key) or "")
    await db.prompt_history.insert_one({
        "module_id": module_id,
        "key": key,
        "version": next_version,
        "content": prev_content,
        "saved_at": now,
        "saved_by": user_email,
        "notes": notes if notes else ("Valor inicial (default)" if not existing else "Versión anterior"),
        "is_default_snapshot": not bool(existing),
    })
    
    # Upsert the override
    await db.prompt_overrides.update_one(
        {"module_id": module_id, "key": key},
        {"$set": {
            "module_id": module_id,
            "key": key,
            "content": content,
            "updated_at": now,
            "updated_by": user_email,
            "notes": notes or "",
        }},
        upsert=True
    )
    
    logging.info(f"✏️ [PromptManager] Override saved: {module_id}/{key} by {user_email} (v{next_version+1})")
    return {"success": True, "version_saved": next_version, "updated_at": now}


async def reset_to_default(module_id: str, key: str, user_email: str, db) -> dict:
    """Delete the override (restores to code default), archiving it in history first."""
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.prompt_overrides.find_one(
        {"module_id": module_id, "key": key},
        {"_id": 0}
    )
    
    if existing:
        next_version = await get_next_version(module_id, key, db)
        await db.prompt_history.insert_one({
            "module_id": module_id,
            "key": key,
            "version": next_version,
            "content": existing["content"],
            "saved_at": now,
            "saved_by": user_email,
            "notes": f"Restablecido al default",
            "is_default_snapshot": False,
        })
        await db.prompt_overrides.delete_one({"module_id": module_id, "key": key})
        logging.info(f"🔄 [PromptManager] Reset to default: {module_id}/{key}")
        return {"success": True, "message": "Restablecido al valor por defecto"}
    
    return {"success": True, "message": "Ya estaba usando el valor por defecto"}


async def restore_version(module_id: str, key: str, version: int, user_email: str, db) -> dict:
    """Restore a prompt to a specific historical version."""
    doc = await db.prompt_history.find_one(
        {"module_id": module_id, "key": key, "version": version},
        {"_id": 0}
    )
    if not doc:
        return {"success": False, "message": f"Versión {version} no encontrada"}
    
    content_to_restore = doc.get("content", "")
    now = datetime.now(timezone.utc).isoformat()
    
    # Archive current before restoring
    existing = await db.prompt_overrides.find_one(
        {"module_id": module_id, "key": key},
        {"_id": 0}
    )
    if existing:
        next_v = await get_next_version(module_id, key, db)
        await db.prompt_history.insert_one({
            "module_id": module_id,
            "key": key,
            "version": next_v,
            "content": existing["content"],
            "saved_at": now,
            "saved_by": user_email,
            "notes": f"Guardado antes de restaurar versión {version}",
            "is_default_snapshot": False,
        })
    
    await db.prompt_overrides.update_one(
        {"module_id": module_id, "key": key},
        {"$set": {
            "module_id": module_id,
            "key": key,
            "content": content_to_restore,
            "updated_at": now,
            "updated_by": user_email,
            "notes": f"Restaurado desde versión {version}",
        }},
        upsert=True
    )
    
    logging.info(f"⏪ [PromptManager] Restored v{version}: {module_id}/{key}")
    return {"success": True, "message": f"Restaurado a versión {version}", "restored_at": now}
