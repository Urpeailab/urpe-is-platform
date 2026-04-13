"""Date and time helper functions."""
from datetime import datetime, timezone

def get_utc_now():
    """Get current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)

def to_iso_string(dt):
    """Convert datetime to ISO string."""
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()

def parse_iso_date(date_string):
    """Parse ISO format date string to datetime."""
    if not date_string:
        return None
    try:
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except:
        return None
