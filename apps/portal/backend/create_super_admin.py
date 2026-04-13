#!/usr/bin/env python3
"""
Script to create initial super admin
Run: python create_super_admin.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from admin_models import StaffModel

load_dotenv()

async def create_super_admin():
    """Create super admin if not exists"""
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if super admin exists
    existing = await db.staff.find_one({'role': 'super_admin'})
    
    if existing:
        print(f"✅ Super admin already exists: {existing['email']}")
        client.close()
        return
    
    # Create super admin
    super_admin = StaffModel.create_staff(
        email="admin@urpe.com",
        password="urpe2024",  # Cambiar en producción
        name="Super Administrator",
        role="super_admin",
        phone="+1234567890"
    )
    
    await db.staff.insert_one(super_admin)
    
    print("✅ Super Admin created successfully!")
    print(f"   Email: admin@urpe.com")
    print(f"   Password: urpe2024")
    print(f"   ID: {super_admin['_id']}")
    print("\n⚠️  IMPORTANT: Change the password immediately in production!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_super_admin())
