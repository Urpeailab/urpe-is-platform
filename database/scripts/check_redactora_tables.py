"""
Check which `redactora_*` tables already exist in the Supabase project.

Read-only: only does GET requests against the PostgREST endpoint to ask
"does this table accept queries?". Does not write or alter anything.

Usage (from repo root):
    python database/scripts/check_redactora_tables.py
"""
import os
import re
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' is required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = REPO_ROOT / ".env"
SQL_FILES = [
    REPO_ROOT / "database" / "migrations" / "redactora" / "001_initial_schema.sql",
    REPO_ROOT / "database" / "migrations" / "redactora" / "003_remaining_tables.sql",
]


def load_env(path: Path) -> dict:
    """Tiny .env parser. Ignores comments and blank lines. No expansion."""
    out = {}
    if not path.exists():
        print(f"ERROR: .env not found at {path}", file=sys.stderr)
        sys.exit(1)
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip()
    return out


def extract_table_names(sql_path: Path) -> list[str]:
    """Pull table names from `CREATE TABLE IF NOT EXISTS name (` lines."""
    pattern = re.compile(
        r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)",
        re.IGNORECASE,
    )
    text = sql_path.read_text(encoding="utf-8")
    return pattern.findall(text)


def check_table(supabase_url: str, key: str, table: str) -> str:
    """Return 'exists', 'missing', or 'error: <detail>'."""
    url = f"{supabase_url.rstrip('/')}/rest/v1/{table}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Range": "0-0",
        "Prefer": "count=exact",
    }
    try:
        r = requests.get(url, headers=headers, timeout=10, params={"select": "*"})
    except requests.RequestException as e:
        return f"error: {e.__class__.__name__}"
    if r.status_code in (200, 206):
        return "exists"
    if r.status_code == 404:
        return "missing"
    body = (r.text or "")[:200]
    if "does not exist" in body or "PGRST204" in body or "42P01" in body:
        return "missing"
    return f"error: HTTP {r.status_code} — {body}"


def main():
    env = load_env(ENV_PATH)
    supabase_url = env.get("SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_KEY")

    if not supabase_url or not service_key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    print(f"Project: {supabase_url}")
    print()

    expected = []
    for sql in SQL_FILES:
        if not sql.exists():
            print(f"WARN: missing migration file {sql}", file=sys.stderr)
            continue
        names = extract_table_names(sql)
        expected.extend(names)
        print(f"  {sql.relative_to(REPO_ROOT)}: {len(names)} tables")

    expected = sorted(set(expected))
    print(f"\nTotal unique tables expected: {len(expected)}\n")

    results = {}
    for t in expected:
        results[t] = check_table(supabase_url, service_key, t)

    exists = [t for t, s in results.items() if s == "exists"]
    missing = [t for t, s in results.items() if s == "missing"]
    errors = {t: s for t, s in results.items() if s.startswith("error")}

    print(f"EXISTS  ({len(exists)}):")
    for t in exists:
        print(f"  [OK]   {t}")
    print(f"\nMISSING ({len(missing)}):")
    for t in missing:
        print(f"  [MISS] {t}")
    if errors:
        print(f"\nERRORS  ({len(errors)}):")
        for t, s in errors.items():
            print(f"  [ERR]  {t}: {s}")

    print(f"\nSummary: {len(exists)}/{len(expected)} exist, {len(missing)} missing, {len(errors)} errors")


if __name__ == "__main__":
    main()
