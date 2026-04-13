"""
Supabase client for URPE IS Portal.
Replaces MongoDB motor client. All database operations go through this module.
"""

import os
import logging
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_supabase: Client = None


def get_supabase() -> Client:
    """Get or create a Supabase client."""
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase = create_client(url, key)
        logger.info(f"Supabase client initialized: {url[:30]}...")
    return _supabase


# === Common query helpers ===

def select(table: str, columns: str = "*", filters: dict = None, single: bool = False, limit: int = None, order: str = None, order_desc: bool = True):
    """
    SELECT helper.

    Usage:
        select("clients", filters={"email": "foo@bar.com"}, single=True)
        select("visa_cases", filters={"client_id": uuid}, order="created_at", limit=10)
    """
    sb = get_supabase()
    q = sb.table(table).select(columns)

    if filters:
        for key, val in filters.items():
            q = q.eq(key, val)

    if order:
        q = q.order(order, desc=order_desc)

    if limit:
        q = q.limit(limit)

    result = q.execute()

    if single:
        return result.data[0] if result.data else None
    return result.data


def insert(table: str, data: dict) -> dict:
    """INSERT helper. Returns the inserted row."""
    sb = get_supabase()
    result = sb.table(table).insert(data).execute()
    return result.data[0] if result.data else {}


def update(table: str, filters: dict, data: dict) -> list:
    """UPDATE helper. Returns updated rows."""
    sb = get_supabase()
    q = sb.table(table).update(data)
    for key, val in filters.items():
        q = q.eq(key, val)
    result = q.execute()
    return result.data


class _DeleteResult(list):
    """List subclass with deleted_count property for MongoDB compatibility."""
    @property
    def deleted_count(self):
        return len(self)


def delete(table: str, filters: dict) -> "_DeleteResult":
    """DELETE helper. Returns deleted rows with .deleted_count property."""
    sb = get_supabase()
    q = sb.table(table).delete()
    for key, val in filters.items():
        q = q.eq(key, val)
    result = q.execute()
    return _DeleteResult(result.data)


def upsert(table: str, data: dict, on_conflict: str = "id") -> dict:
    """UPSERT helper."""
    sb = get_supabase()
    result = sb.table(table).upsert(data, on_conflict=on_conflict).execute()
    return result.data[0] if result.data else {}


def count(table: str, filters: dict = None) -> int:
    """COUNT helper."""
    sb = get_supabase()
    q = sb.table(table).select("id", count="exact")
    if filters:
        for key, val in filters.items():
            q = q.eq(key, val)
    result = q.execute()
    return result.count or 0


def rpc(function_name: str, params: dict = None):
    """Call a Supabase RPC function."""
    sb = get_supabase()
    result = sb.rpc(function_name, params or {}).execute()
    return result.data
