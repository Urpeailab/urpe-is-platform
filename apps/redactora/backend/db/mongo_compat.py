"""
Mongo-compatible facade over the Supabase Python client.

Goal: let existing Mongo-style code (`db.users.find_one(...)`,
`db.users.update_one(filter, {"$set": {...}})`) keep working without
rewriting hundreds of call sites.

The facade is INTENTIONALLY incomplete: it only supports the operators
and operations actually used by `apps/redactora/backend/server.py`
(see MONGO_INVENTORY.md). Anything outside that surface raises
NotImplementedError so we discover gaps early.

Usage (drop-in for `motor.motor_asyncio.AsyncIOMotorClient`):

    from db.mongo_compat import get_mongo_compat_db
    db = get_mongo_compat_db()  # returns CompatDatabase

    user = await db.users.find_one({"email": "x@y.com"})
    await db.users.update_one({"id": uid}, {"$set": {"status": "active"}})
    cur = db.users.find({"role": "admin"})
    async for u in cur: ...

Tables are auto-prefixed with `redactora_` so we share one Supabase project
with the portal app without name collisions.
"""

from __future__ import annotations

import asyncio
import logging
import re
import os
from typing import Any, Dict, List, Optional, Iterable

from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)

TABLE_PREFIX = "redactora_"

# Logical-to-logical aliases (Mongo collection name → canonical name).
# Lets old code keep using `db.niw_in_progress` while the physical table is
# `redactora_business_plans_in_progress`.
COLLECTION_ALIASES: Dict[str, str] = {
    "niw_in_progress": "business_plans_in_progress",
    "niw": "business_plans",
}

# Columns we surface as real columns on each table; everything else goes into `data`.
# Update this when you add new top-level indexed columns to the SQL schema.
SURFACE_COLUMNS: Dict[str, set] = {
    "users": {"id", "email", "full_name", "role", "status", "password",
              "language_preference", "permissions", "created_by",
              "deleted_at", "deleted_by", "created_at", "updated_at"},
    "clients": {"id", "name", "email", "phone", "company", "status",
                "created_by", "created_at", "updated_at"},
    "business_plans": {"id", "user_id", "client_id", "project_title",
                       "applicant_name", "language", "status", "quality_score",
                       "created_at", "updated_at"},
    "business_plans_in_progress": {"id", "user_id", "client_id", "project_title",
                                   "applicant_name", "status",
                                   "generation_progress", "created_at", "updated_at"},
    "books": {"id", "user_id", "client_id", "title", "genre", "language",
              "status", "current_chapter", "progress_percentage",
              "created_at", "updated_at"},
    "books_in_progress": {"id", "user_id", "client_id", "title", "status",
                          "created_at", "updated_at"},
    "patents": {"id", "user_id", "client_id", "title", "language", "status",
                "created_at", "updated_at"},
    "patents_in_progress": {"id", "user_id", "client_id", "title", "status",
                            "created_at", "updated_at"},
    "whitepapers": {"id", "user_id", "client_id", "title", "topic", "language",
                    "status", "current_section", "created_at", "updated_at"},
    "whitepapers_in_progress": {"id", "user_id", "client_id", "title", "status",
                                "created_at", "updated_at"},
    "econometric_studies": {"id", "user_id", "client_id", "language", "status",
                            "created_at", "updated_at"},
    "econometric_studies_in_progress": {"id", "user_id", "client_id", "status",
                                        "created_at", "updated_at"},
    "case_studies": {"id", "user_id", "client_id", "company_name", "industry",
                     "language", "status", "created_at", "updated_at"},
    "policy_papers": {"id", "user_id", "title", "topic", "language", "status",
                      "created_at", "updated_at"},
    "expert_letters": {"id", "user_id", "client_id", "expert_name",
                       "applicant_name", "language", "status",
                       "created_at", "updated_at"},
    "self_petition_letters": {"id", "user_id", "client_id", "applicant_name",
                              "language", "status", "created_at", "updated_at"},
    "self_petition_v2_letters": {"id", "user_id", "client_id", "applicant_name",
                                 "language", "status", "created_at", "updated_at"},
    "self_petition_v2_sessions": {"id", "user_id", "created_at", "updated_at"},
    "intent_letters": {"id", "user_id", "client_id", "language", "status",
                       "created_at", "updated_at"},
    "recommendation_letters": {"id", "user_id", "client_id", "recommender_name",
                               "applicant_name", "language", "status",
                               "created_at", "updated_at"},
    "chat_conversations": {"id", "user_id", "conversation_id",
                           "created_at", "updated_at"},
    "chat_messages": {"id", "conversation_id", "role", "content", "timestamp",
                      "created_at"},
    "document_comments": {"id", "document_id", "user_id", "comment_text",
                          "resolved", "created_at", "updated_at"},
    "document_versions": {"id", "document_id", "document_type", "change_type",
                          "user_id", "timestamp", "previous_content",
                          "new_content", "change_summary", "created_at"},
    "activity_logs": {"id", "user_id", "action", "resource_type",
                      "resource_id", "timestamp", "details"},
    "auto_recovery_log": {"id", "action_type", "timestamp", "status"},
    "trash_cleanup_log": {"id", "action_type", "timestamp", "status"},
    "translations": {"id", "user_id", "client_id", "source_language",
                     "target_language", "status", "created_at", "updated_at"},
    "certified_translations": {"id", "user_id", "client_id", "source_language",
                               "target_language", "status",
                               "created_at", "updated_at"},
    "translator_profiles": {"id", "name", "status", "created_at", "updated_at"},
    "prompt_overrides": {"id", "module_id", "key", "value",
                         "override_version", "created_at", "updated_at"},
    "prompt_history": {"id", "module_id", "key", "value", "version", "created_at"},
    "ai_edit_jobs": {"id", "job_id", "document_id", "status", "progress",
                     "created_at", "updated_at"},
    "book_ai_edit_jobs": {"id", "job_id", "document_id", "status", "progress",
                          "created_at", "updated_at"},
    "extraction_tasks": {"id", "task_type", "status", "created_at", "updated_at"},
    "suggestion_tasks": {"id", "task_type", "status", "created_at", "updated_at"},
    "json_overrides": {"id", "key", "value", "created_at", "updated_at"},
    "json_override_history": {"id", "key", "value", "created_at"},
    "designed_documents": {"id", "document_id", "status",
                           "created_at", "updated_at"},
    "patent_evaluations": {"id", "patent_id", "score", "feedback",
                           "created_at", "updated_at"},
}


def _physical_table(name: str) -> str:
    """Map logical Mongo collection name → physical Supabase table."""
    canonical = COLLECTION_ALIASES.get(name, name)
    return f"{TABLE_PREFIX}{canonical}"


def _json_safe(v: Any) -> Any:
    """Recursively coerce values to JSON-serializable types (datetime → ISO string)."""
    from datetime import datetime, date
    if isinstance(v, datetime) or isinstance(v, date):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _json_safe(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_json_safe(x) for x in v]
    if isinstance(v, tuple):
        return [_json_safe(x) for x in v]
    return v


def _split_surface_data(table: str, doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Move non-surface keys into `data` JSONB so the physical row matches the schema.
    Returns a NEW dict; doesn't mutate input.
    """
    canonical = COLLECTION_ALIASES.get(table, table)
    surface = SURFACE_COLUMNS.get(canonical, {"id"})
    out: Dict[str, Any] = {}
    extra: Dict[str, Any] = {}
    for k, v in doc.items():
        v = _json_safe(v)
        if k in surface:
            out[k] = v
        elif k == "data" and isinstance(v, dict):
            extra.update(v)
        else:
            extra[k] = v
    if extra:
        existing = doc.get("data") if isinstance(doc.get("data"), dict) else {}
        merged = {**_json_safe(existing), **extra}
        out["data"] = merged
    return out


def _flatten_row(table: str, row: Dict[str, Any]) -> Dict[str, Any]:
    """Read path: merge `data` JSONB back to top level (so Mongo-style code sees flat doc)."""
    if not row:
        return row
    out = dict(row)
    data = out.pop("data", None)
    if isinstance(data, dict):
        for k, v in data.items():
            if k not in out:
                out[k] = v
    return out


# ----------------------------------------------------------------------------
# Filter translation: Mongo query dict → list of (column, op, value)
# ----------------------------------------------------------------------------

def _apply_filter(q, filt: Dict[str, Any], table: str):
    """
    Apply a Mongo-style filter dict to a Supabase query builder `q`.

    Supported per-field operators:
        $eq, $ne, $in, $nin, $gt, $gte, $lt, $lte, $exists, $regex (+$options)
    Top-level $or is partially supported (uses .or_ string).
    """
    canonical = COLLECTION_ALIASES.get(table, table)
    surface = SURFACE_COLUMNS.get(canonical, set())
    for key, val in filt.items():
        if key == "$or":
            # PostgREST .or_ wants a string like "col.eq.val,col.eq.val"
            parts = []
            for sub in val:
                for k, v in sub.items():
                    col = k if k in surface else f"data->>{k!r}"
                    parts.append(f"{col}.eq.{v}")
            q = q.or_(",".join(parts))
            continue
        # map to column or JSONB path
        col = key if (key in surface or key == "id") else f"data->>{key}"
        if isinstance(val, dict):
            # Handle $regex (+ optional $options) as a unit so we don't trip on $options alone.
            if "$regex" in val:
                pattern = val["$regex"]
                opts = val.get("$options", "")
                # Mongo regex anchors: strip ^ and $ — PostgREST LIKE/ILIKE uses % wildcards.
                pat = pattern.lstrip("^").rstrip("$")
                like_pattern = f"%{pat}%"
                if "i" in opts:
                    q = q.ilike(col, like_pattern)
                else:
                    q = q.like(col, like_pattern)
                # consume both keys
                remaining = {k: v for k, v in val.items() if k not in ("$regex", "$options")}
            else:
                remaining = val

            for op, opv in remaining.items():
                if op == "$eq":
                    q = q.eq(col, opv)
                elif op == "$ne":
                    q = q.neq(col, opv)
                elif op == "$in":
                    q = q.in_(col, list(opv))
                elif op == "$nin":
                    # PostgREST has no direct nin; fallback to multiple .neq calls
                    for x in opv:
                        if x is None:
                            q = q.not_.is_(col, "null")
                        else:
                            q = q.neq(col, x)
                elif op == "$gt":
                    q = q.gt(col, opv)
                elif op == "$gte":
                    q = q.gte(col, opv)
                elif op == "$lt":
                    q = q.lt(col, opv)
                elif op == "$lte":
                    q = q.lte(col, opv)
                elif op == "$exists":
                    if opv:
                        q = q.not_.is_(col, "null")
                    else:
                        q = q.is_(col, "null")
                else:
                    raise NotImplementedError(f"Mongo operator {op} not implemented")
        else:
            q = q.eq(col, val)
    return q


# ----------------------------------------------------------------------------
# Update translation: Mongo update dict → flat field updates
# ----------------------------------------------------------------------------

def _apply_update(table: str, current: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute the new full row from `current` + Mongo-style update operators.
    Currently supports $set, $unset, $push, $pull, $inc, $addToSet.
    Returns a dict ready to be passed to Supabase .update() (flat with surface
    columns + `data` JSONB).
    """
    if not update:
        return {}
    flat = _flatten_row(table, dict(current)) if current else {}
    for op, payload in update.items():
        if op == "$set":
            flat.update(payload)
        elif op == "$unset":
            for k in payload.keys():
                flat.pop(k, None)
        elif op == "$push":
            for k, v in payload.items():
                arr = flat.get(k) or []
                if not isinstance(arr, list):
                    arr = [arr]
                if isinstance(v, dict) and "$each" in v:
                    arr.extend(v["$each"])
                else:
                    arr.append(v)
                flat[k] = arr
        elif op == "$pull":
            for k, criteria in payload.items():
                arr = flat.get(k) or []
                if not isinstance(arr, list):
                    continue
                if isinstance(criteria, dict):
                    flat[k] = [x for x in arr if not all(x.get(ck) == cv for ck, cv in criteria.items())]
                else:
                    flat[k] = [x for x in arr if x != criteria]
        elif op == "$inc":
            for k, delta in payload.items():
                flat[k] = (flat.get(k) or 0) + delta
        elif op == "$addToSet":
            for k, v in payload.items():
                arr = flat.get(k) or []
                if not isinstance(arr, list):
                    arr = [arr]
                if v not in arr:
                    arr.append(v)
                flat[k] = arr
        else:
            raise NotImplementedError(f"Mongo update operator {op} not implemented")
    return _split_surface_data(table, flat)


# ----------------------------------------------------------------------------
# Result wrappers (mimic pymongo result objects)
# ----------------------------------------------------------------------------

class InsertOneResult:
    def __init__(self, inserted_id: Any):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count: int, modified_count: int):
        self.matched_count = matched_count
        self.modified_count = modified_count


class DeleteResult:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


# ----------------------------------------------------------------------------
# Async cursor (for `async for` semantics)
# ----------------------------------------------------------------------------

class AsyncCursor:
    def __init__(self, rows: List[Dict[str, Any]], table: str):
        self._rows = rows
        self._table = table
        self._idx = 0
        self._sort_field: Optional[str] = None
        self._sort_dir: int = 1
        self._limit_n: Optional[int] = None
        self._skip_n: int = 0

    def sort(self, field: str, direction: int = 1) -> "AsyncCursor":
        self._sort_field = field
        self._sort_dir = direction
        return self

    def limit(self, n: int) -> "AsyncCursor":
        self._limit_n = n
        return self

    def skip(self, n: int) -> "AsyncCursor":
        self._skip_n = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        rows = self._materialized()
        if length is not None:
            return rows[:length]
        return rows

    def _materialized(self) -> List[Dict[str, Any]]:
        rows = self._rows
        if self._sort_field:
            rows = sorted(
                rows,
                key=lambda r: (r.get(self._sort_field) is None, r.get(self._sort_field)),
                reverse=(self._sort_dir == -1),
            )
        if self._skip_n:
            rows = rows[self._skip_n:]
        if self._limit_n is not None:
            rows = rows[: self._limit_n]
        return [_flatten_row(self._table, r) for r in rows]

    def __aiter__(self):
        self._materialized_cache = self._materialized()
        self._idx = 0
        return self

    async def __anext__(self):
        if self._idx >= len(self._materialized_cache):
            raise StopAsyncIteration
        item = self._materialized_cache[self._idx]
        self._idx += 1
        return item


# ----------------------------------------------------------------------------
# CompatCollection — emulates motor.AsyncIOMotorCollection
# ----------------------------------------------------------------------------

class CompatCollection:
    def __init__(self, name: str):
        self.name = name
        self.table = _physical_table(name)
        self._sb = get_supabase()

    # --- read ops ---

    async def find_one(self, filt: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        # `projection` is accepted for Mongo-API compatibility but ignored:
        # Supabase rows already lack Mongo's `_id`, and explicit projections
        # are uncommon enough in this codebase that the extra round-trip cost
        # of fetching all columns is acceptable.
        rows = await self._fetch_all(filt or {}, limit=1)
        if not rows:
            return None
        return _flatten_row(self.name, rows[0])

    def find(self, filt: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> "_LazyCursor":
        # Synchronous return; rows are fetched on `await cursor.to_list()` or `async for`.
        # `projection` is accepted for API compatibility but ignored.
        return _LazyCursor(self, filt or {})

    async def count_documents(self, filt: Optional[Dict[str, Any]] = None) -> int:
        rows = await self._fetch_all(filt or {})
        return len(rows)

    # --- write ops ---

    async def insert_one(self, doc: Dict[str, Any]) -> InsertOneResult:
        if "id" not in doc:
            import uuid as _uuid
            doc["id"] = str(_uuid.uuid4())
        row = _split_surface_data(self.name, doc)
        await asyncio.to_thread(lambda: self._sb.table(self.table).insert(row).execute())
        return InsertOneResult(inserted_id=doc["id"])

    async def insert_many(self, docs: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
        rows = []
        ids = []
        import uuid as _uuid
        for d in docs:
            if "id" not in d:
                d["id"] = str(_uuid.uuid4())
            ids.append(d["id"])
            rows.append(_split_surface_data(self.name, d))
        if rows:
            await asyncio.to_thread(lambda: self._sb.table(self.table).insert(rows).execute())
        return {"inserted_ids": ids}

    async def update_one(self, filt: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        current_rows = await self._fetch_all(filt, limit=1)
        if not current_rows:
            if upsert:
                # Build a doc from filter + $set fields
                base = dict(filt)
                if "$set" in update:
                    base.update(update["$set"])
                await self.insert_one(base)
                return UpdateResult(matched_count=0, modified_count=0)
            return UpdateResult(matched_count=0, modified_count=0)
        current = current_rows[0]
        new_row = _apply_update(self.name, current, update)
        await asyncio.to_thread(
            lambda: _apply_filter(self._sb.table(self.table).update(new_row), filt, self.name).execute()
        )
        return UpdateResult(matched_count=1, modified_count=1)

    async def update_many(self, filt: Dict[str, Any], update: Dict[str, Any]) -> UpdateResult:
        rows = await self._fetch_all(filt)
        n = 0
        for r in rows:
            new_row = _apply_update(self.name, r, update)
            await asyncio.to_thread(
                lambda nr=new_row, rid=r["id"]: self._sb.table(self.table).update(nr).eq("id", rid).execute()
            )
            n += 1
        return UpdateResult(matched_count=n, modified_count=n)

    async def delete_one(self, filt: Dict[str, Any]) -> DeleteResult:
        rows = await self._fetch_all(filt, limit=1)
        if not rows:
            return DeleteResult(deleted_count=0)
        rid = rows[0]["id"]
        await asyncio.to_thread(lambda: self._sb.table(self.table).delete().eq("id", rid).execute())
        return DeleteResult(deleted_count=1)

    async def delete_many(self, filt: Dict[str, Any]) -> DeleteResult:
        rows = await self._fetch_all(filt)
        for r in rows:
            await asyncio.to_thread(lambda rid=r["id"]: self._sb.table(self.table).delete().eq("id", rid).execute())
        return DeleteResult(deleted_count=len(rows))

    # --- internal ---

    async def _fetch_all(self, filt: Dict[str, Any], limit: Optional[int] = None) -> List[Dict[str, Any]]:
        def _exec():
            q = self._sb.table(self.table).select("*")
            q = _apply_filter(q, filt, self.name)
            if limit:
                q = q.limit(limit)
            return q.execute()
        result = await asyncio.to_thread(_exec)
        return result.data or []

    # --- unsupported ---

    async def aggregate(self, *args, **kwargs):
        raise NotImplementedError(
            f"aggregate() not implemented in mongo_compat for {self.name}. "
            "Translate the pipeline manually to a Supabase rpc() or raw SQL view."
        )

    async def create_index(self, *args, **kwargs):
        # No-op: indexes are managed via SQL migrations.
        return None


class _LazyCursor:
    """Cursor used inside async contexts; resolves on iteration."""
    def __init__(self, coll: CompatCollection, filt: Dict[str, Any]):
        self._coll = coll
        self._filt = filt
        self._sort_field: Optional[str] = None
        self._sort_dir: int = 1
        self._limit_n: Optional[int] = None
        self._skip_n: int = 0
        self._iter_cursor: Optional[AsyncCursor] = None

    def sort(self, field: str, direction: int = 1) -> "_LazyCursor":
        self._sort_field = field
        self._sort_dir = direction
        return self

    def limit(self, n: int) -> "_LazyCursor":
        self._limit_n = n
        return self

    def skip(self, n: int) -> "_LazyCursor":
        self._skip_n = n
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        rows = await self._coll._fetch_all(self._filt)
        cur = AsyncCursor(rows, self._coll.name)
        if self._sort_field:
            cur.sort(self._sort_field, self._sort_dir)
        if self._skip_n:
            cur.skip(self._skip_n)
        if self._limit_n is not None:
            cur.limit(self._limit_n)
        return await cur.to_list(length)

    def __aiter__(self):
        async def _gen():
            for row in await self.to_list():
                yield row
        return _gen()


# ----------------------------------------------------------------------------
# CompatDatabase — emulates motor.AsyncIOMotorDatabase
# ----------------------------------------------------------------------------

class CompatDatabase:
    """Attribute access (`db.users`) and dict access (`db['users']`) both work."""

    def __getattr__(self, name: str) -> CompatCollection:
        if name.startswith("_"):
            raise AttributeError(name)
        return CompatCollection(name)

    def __getitem__(self, name: str) -> CompatCollection:
        return CompatCollection(name)


_db_singleton: Optional[CompatDatabase] = None


def get_mongo_compat_db() -> CompatDatabase:
    global _db_singleton
    if _db_singleton is None:
        _db_singleton = CompatDatabase()
    return _db_singleton
