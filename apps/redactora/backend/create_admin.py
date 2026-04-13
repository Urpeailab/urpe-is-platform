#!/usr/bin/env python3
"""
Script para crear usuario admin
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path
import uuid

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_admin():
    print("🚀 Creando usuario administrador...")
    print("=" * 60)
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Verificar si ya existe un admin
        existing_admin = await db.users.find_one({"email": "admin@monica.com"})
        
        if existing_admin:
            print("✅ Admin ya existe")
            print(f"   Email: admin@monica.com")
            print(f"   ID: {existing_admin['id']}")
            
            # Actualizar a admin si no lo es
            if existing_admin.get("role") != "admin":
                await db.users.update_one(
                    {"id": existing_admin["id"]},
                    {"$set": {"role": "admin"}}
                )
                print("   ✅ Rol actualizado a 'admin'")
        else:
            from auth import get_password_hash
            
            admin_id = str(uuid.uuid4())
            admin = {
                "id": admin_id,
                "email": "admin@monica.com",
                "full_name": "Eliana Giraldo",
                "password": get_password_hash("admin123"),
                "role": "admin",
                "status": "active",
                "permissions": ["all"],
                "language_preference": "es",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None
            }
            
            await db.users.insert_one(admin)
            print("✅ Admin creado exitosamente")
            print(f"   Email: admin@monica.com")
            print(f"   Password: admin123")
            print(f"   ID: {admin_id}")
            print(f"   Nombre: Eliana Giraldo")
        
        print("\n" + "=" * 60)
        print("🎉 ¡Admin listo!")
        print("   Login: admin@monica.com")
        print("   Password: admin123")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
