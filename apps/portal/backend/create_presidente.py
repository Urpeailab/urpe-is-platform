#!/usr/bin/env python3
"""
Script para agregar a Diego Urquijo como Presidente
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from admin_models import StaffModel

async def create_presidente():
    # Conectar a MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'urpe_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Información del Presidente
    email = 'dau@urpeintegralservices.co'
    name = 'Diego Urquijo'
    password = 'UrpePresidente2024!'  # Contraseña temporal - debe cambiarla después
    phone = '7865698666'
    department = 'presidente'
    linkedin = 'https://www.linkedin.com/in/diego-urquijo-2ab5a9237/'
    role = 'super_admin'  # Presidente tiene máximos permisos
    
    # Verificar si ya existe
    existing = await db.staff.find_one({'email': email.lower()})
    if existing:
        print(f"✅ El usuario {email} ya existe en el sistema")
        print(f"   Actualizando información...")
        
        # Actualizar información
        await db.staff.update_one(
            {'email': email.lower()},
            {'$set': {
                'name': name,
                'phone': phone,
                'department': department,
                'linkedin': linkedin,
                'role': role,
                'roleLevel': 1
            }}
        )
        print(f"✅ Información actualizada correctamente")
    else:
        # Crear nuevo staff
        staff_data = StaffModel.create_staff(
            email=email,
            password=password,
            name=name,
            role=role,
            phone=phone,
            department=department,
            linkedin=linkedin
        )
        
        # Insertar en la base de datos
        await db.staff.insert_one(staff_data)
        print(f"✅ Presidente Diego Urquijo creado exitosamente!")
        print(f"   Email: {email}")
        print(f"   Contraseña temporal: {password}")
        print(f"   Departamento: Presidente")
        print(f"   LinkedIn: {linkedin}")
        print(f"\n⚠️  IMPORTANTE: Cambia la contraseña al iniciar sesión")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_presidente())
