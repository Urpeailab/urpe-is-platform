# Redactora — Mongo → Supabase Migration Plan

## Status
- **Session 1: ✅ COMPLETE** (artifacts ready, app NOT yet running on Supabase)
- Sessions 2-N: pending

## Session 1 deliverables (this session)

| Artifact | Path | Purpose |
|---|---|---|
| Inventory of Mongo usage | [apps/redactora/backend/MONGO_INVENTORY.md](backend/MONGO_INVENTORY.md) | Catalog of 42 collections, operators, sample fields |
| SQL schema for Supabase | [database/migrations/redactora/001_initial_schema.sql](../../database/migrations/redactora/001_initial_schema.sql) | 42 tables prefixed `redactora_*`, JSONB for nested arrays |
| Mongo→Supabase wrapper | [apps/redactora/backend/db/mongo_compat.py](backend/db/mongo_compat.py) | Drop-in replacement for `motor` `AsyncIOMotorDatabase` |
| Multi-session plan | this file | Roadmap |

## Session 2 — Apply schema + swap the `db` object (estimate: 1 working day)

1. Apply `001_initial_schema.sql` to Supabase (using `psql` from a Docker postgres container, since psql isn't installed locally).
2. In `server.py` line 230 (and 18230, 18719, 18842, 23353), replace:
   ```python
   from motor.motor_asyncio import AsyncIOMotorClient
   client = AsyncIOMotorClient(mongo_url)
   db = client[db_name]
   ```
   with:
   ```python
   from db.mongo_compat import get_mongo_compat_db
   db = get_mongo_compat_db()
   ```
3. Refactor `create_admin.py` to use the new `db` (or call Supabase directly).
4. Run the container, hit the login endpoint, see what breaks.
5. Fix the first round of obvious bugs (missing surface columns, unsupported operators).

## Session 3 — Endpoint-by-endpoint validation (estimate: 2-3 working days)

For each major feature, exercise it through the UI and fix the failures:

- [ ] Login / users
- [ ] Clients CRUD
- [ ] Business plans / NIW (the big one — sections array)
- [ ] Books (chapters array)
- [ ] Patents
- [ ] Whitepapers
- [ ] Recommendation letters
- [ ] Self-petition letters (v1 + v2)
- [ ] Expert letters
- [ ] Econometric studies
- [ ] Case studies
- [ ] Translations
- [ ] Chat
- [ ] Comments / versions
- [ ] Activity logs

Watch for these recurring problems:
- **Aggregation pipelines** (3 places: `document_versions`, `business_plans`, `prompt_history`). The wrapper raises `NotImplementedError`. Translate each manually to a Supabase RPC function or compute in Python.
- **Datetime serialization**: Mongo accepts `datetime` objects; Supabase needs ISO strings. The wrapper does NOT auto-convert yet — add this to `_split_surface_data` if needed.
- **Field name expectations**: code may read `doc["created_at"]` and get a string instead of a datetime.

## Session 4 — Data migration (only if you have prod data to preserve)

If there's existing Mongo data that must move:
1. Spin up a temporary Mongo container.
2. Restore the prod dump into it.
3. Write a one-shot Python script: read each collection from Mongo, transform via `_split_surface_data`, insert into Supabase.
4. Validate row counts and a few spot-checks per collection.

If this is a fresh deployment with no prod data: skip.

## Session 5 — Remove MongoDB dependencies

1. Drop `motor`, `pymongo` from `requirements.txt` (only after Session 3 endpoints are stable).
2. Delete `server_mongodb_backup.py`, `server.py.backup`, `server.py.backup_*` (already not part of the build).
3. Update CLAUDE.md / README to reflect Supabase as the single source of truth.

## Risks and gotchas

- **Wrapper coverage**: the wrapper handles the operators in the inventory, but uncatalogued usages will raise `NotImplementedError`. That's intentional — better a clear failure than silently-wrong data. Expand the wrapper as gaps surface.
- **`find()` semantics**: the wrapper materializes results eagerly. Fine for typical pages of <1000 rows, slow for unbounded scans. If you hit perf issues, add streaming via PostgREST range headers.
- **No transactions**: Mongo code didn't use them, but if Session 3 reveals a multi-write operation that needs atomicity, use Supabase RPC + plpgsql function.
- **JSONB queries**: filtering on fields inside `data` JSONB works (`data->>field`) but is not as fast as indexed columns. If a field becomes hot, promote it to a real column (update SQL schema + `SURFACE_COLUMNS` + run `UPDATE ... SET col = data->>'col'`).

## What's NOT covered by the wrapper

- `aggregate()` — raises NotImplementedError
- `find_one_and_update`, `replace_one`, `bulk_write` — not used in inventory; not implemented
- `create_index` — no-op (use SQL migrations)
- GridFS — not used; not implemented

## How to test the wrapper in isolation

```bash
docker exec -it urpe-is-platform-redactora-1 python -c "
import asyncio
from db.mongo_compat import get_mongo_compat_db

async def smoke():
    db = get_mongo_compat_db()
    # Insert
    r = await db.users.insert_one({'email': 'test@example.com', 'role': 'user', 'status': 'active'})
    print('inserted', r.inserted_id)
    # Read back
    u = await db.users.find_one({'email': 'test@example.com'})
    print('read', u)
    # Update
    await db.users.update_one({'email': 'test@example.com'}, {'\$set': {'role': 'admin'}})
    # Verify
    u = await db.users.find_one({'email': 'test@example.com'})
    assert u['role'] == 'admin'
    print('update OK')
    # Cleanup
    await db.users.delete_one({'email': 'test@example.com'})
    print('delete OK')

asyncio.run(smoke())
"
```
