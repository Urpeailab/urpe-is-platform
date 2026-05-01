#!/usr/bin/env python3
"""
Create the default admin user via the Mongo-compat facade (Supabase-backed).
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / '.env')

from db.mongo_compat import get_mongo_compat_db
from auth import get_password_hash


async def create_admin():
    print("Creando usuario administrador...")
    print("=" * 60)
    db = get_mongo_compat_db()

    existing = await db.users.find_one({"email": "admin@monica.com"})
    if existing:
        print(f"Admin ya existe — id={existing.get('id')}")
        if existing.get("role") != "admin":
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {"role": "admin"}}
            )
            print("Rol actualizado a 'admin'")
    else:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "email": "admin@monica.com",
            "full_name": "Eliana Giraldo",
            "password": get_password_hash("admin123"),
            "role": "admin",
            "status": "active",
            "permissions": ["all"],
            "language_preference": "es",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": None,
        })
        print(f"Admin creado — id={admin_id}")

    print("=" * 60)
    print("Login: admin@monica.com / admin123")


if __name__ == "__main__":
    asyncio.run(create_admin())
