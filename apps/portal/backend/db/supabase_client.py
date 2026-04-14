"""
Supabase client for URPE IS Platform.
Replaces MongoDB motor client. All database operations go through this module.
Shared by both Portal and Redactora apps.
"""

import os
import logging
import re
import threading
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_supabase: Client = None
_lock = threading.Lock()

# Column name aliases: camelCase → snake_case
# Auto-translates legacy camelCase field names to new PostgreSQL snake_case columns
_COLUMN_ALIASES = {
    'userId': 'client_id',
    'clientId': 'client_id',
    'caseId': 'case_id',
    'stageId': 'stage_id',
    'stageNumber': 'stage_number',
    'staffId': 'staff_id',
    'advisorId': 'advisor_id',
    'coordinatorId': 'coordinator_id',
    'salesRepId': 'advisor_id',  # alias
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'userState': 'user_state',
    'isActive': 'is_active',
    'isPaid': 'is_paid',
    'isMasterCase': 'is_master_case',
    'currentStage': 'current_stage',
    'paymentMethod': 'payment_method',
    'paymentDate': 'paid_at',
    'visaType': 'visa_type',
    'fileUrl': 'file_url',
    'fileName': 'file_name',
    'documentType': 'document_type',
    'rejectionReason': 'rejection_reason',
    'revisionCount': 'revision_count',
    'scheduledAt': 'scheduled_at',
    'meetingUrl': 'meeting_url',
    'receiptUrl': 'receipt_url',
    'cvUrl': 'cv_url',
    'originalFileUrl': 'original_file_url',
    'templateId': 'template_id',
    'formType': 'form_type',
    'formData': 'form_data',
    'passwordHash': 'password_hash',
    'password': 'password_hash',
    'lastLogin': 'last_login_at',  # column may not exist
    'user': 'client_name',  # generic 'user' field — assume client_name
    'users': 'clients',  # tabla
    'salesRepId': 'sales_rep_id',
    'overallProgress': 'overall_progress',
    'clientName': 'client_name',
    'paidAmount': 'paid_amount',
    'remainingBalance': 'remaining_balance',
    'totalFee': 'total_fee',
}

# Columns that don't exist in any table - filter out from selects
_UNKNOWN_COLUMNS = set()

def _translate_key(k: str) -> str:
    """Convert a camelCase field name to snake_case for Supabase."""
    if k in _COLUMN_ALIASES:
        return _COLUMN_ALIASES[k]
    # Generic camelCase → snake_case fallback
    return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', k).lower()

def _translate_dict(d):
    """Translate dict keys recursively."""
    if not isinstance(d, dict):
        return d
    return {_translate_key(k): v for k, v in d.items()}


# Reverse alias map: snake_case → camelCase for backward compat
def _snake_to_camel(s: str) -> str:
    parts = s.split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


def _add_camel_aliases(d):
    """Augment dict with camelCase aliases of snake_case keys (so legacy code keeps working)."""
    if not isinstance(d, dict):
        return d
    out = dict(d)
    for k, v in list(d.items()):
        if '_' in k:
            camel = _snake_to_camel(k)
            if camel not in out:
                out[camel] = v
    return out


def get_supabase() -> Client:
    """Get or create a Supabase client (thread-safe)."""
    global _supabase
    if _supabase is None:
        with _lock:
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
    # Translate columns string (e.g. "coordinatorId,userId" → "coordinator_id,client_id")
    if columns and columns != "*":
        cols = [_translate_key(c.strip()) for c in columns.split(",")]
        columns = ",".join(cols)
    q = sb.table(table).select(columns)

    if filters:
        for key, val in filters.items():
            q = q.eq(_translate_key(key), val)

    if order:
        q = q.order(_translate_key(order), desc=order_desc)

    if limit:
        q = q.limit(limit)

    result = q.execute()

    if single:
        if result.data:
            return _add_camel_aliases(result.data[0])
        return None
    return [_add_camel_aliases(d) for d in result.data]


def insert(table: str, data: dict) -> dict:
    """INSERT helper. Returns the inserted row."""
    sb = get_supabase()
    result = sb.table(table).insert(_translate_dict(data)).execute()
    if result.data:
        return _add_camel_aliases(result.data[0])
    return {}


def update(table: str, filters: dict, data: dict) -> list:
    """UPDATE helper. Returns updated rows.

    SAFETY: filters must not be empty to prevent updating all rows.
    """
    if not filters:
        raise ValueError("update() requires non-empty filters to prevent updating all rows")
    sb = get_supabase()
    q = sb.table(table).update(_translate_dict(data))
    for key, val in filters.items():
        q = q.eq(_translate_key(key), val)
    result = q.execute()
    return result.data


class _DeleteResult(list):
    """List subclass with deleted_count property for MongoDB compatibility."""
    @property
    def deleted_count(self):
        return len(self)


def delete(table: str, filters: dict) -> "_DeleteResult":
    """DELETE helper. Returns deleted rows with .deleted_count property.

    SAFETY: filters must not be empty to prevent deleting all rows.
    """
    if not filters:
        raise ValueError("delete() requires non-empty filters to prevent deleting all rows")
    sb = get_supabase()
    q = sb.table(table).delete()
    for key, val in filters.items():
        q = q.eq(_translate_key(key), val)
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
            q = q.eq(_translate_key(key), val)
    result = q.execute()
    return result.count or 0


def rpc(function_name: str, params: dict = None):
    """Call a Supabase RPC function."""
    sb = get_supabase()
    result = sb.rpc(function_name, params or {}).execute()
    return result.data
