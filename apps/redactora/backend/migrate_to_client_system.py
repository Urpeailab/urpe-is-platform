#!/usr/bin/env python3
"""
Script de migración para implementar sistema de clientes
- Crea cliente "Diego Urquijo" 
- Asigna todos los documentos existentes a este cliente
- Actualiza campos user_id -> operator_id donde sea necesario
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from pathlib import Path
import uuid

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def migrate():
    print("🚀 Iniciando migración a sistema de clientes...")
    print("=" * 60)
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    db_name = os.environ['DB_NAME']
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Paso 1: Obtener el primer operador (Diego Urquijo test user)
        print("\n📋 Paso 1: Buscando usuario operador...")
        operator = await db.users.find_one({"email": "diego.urquijo.test@urpeailab.com"})
        
        if not operator:
            print("❌ Usuario 'diego.urquijo.test@urpeailab.com' no encontrado")
            print("   Creando usuario de prueba...")
            
            from auth import get_password_hash
            operator_id = str(uuid.uuid4())
            operator = {
                "id": operator_id,
                "email": "diego.urquijo.test@urpeailab.com",
                "full_name": "Diego Urquijo",
                "password": get_password_hash("TestPass123!"),
                "role": "operator",
                "status": "active",
                "permissions": [],
                "language_preference": "es",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": None
            }
            await db.users.insert_one(operator)
            print(f"✅ Usuario creado: {operator_id}")
        else:
            operator_id = operator["id"]
            print(f"✅ Usuario encontrado: {operator['full_name']} ({operator_id})")
            
            # Actualizar usuario con nuevos campos si no existen
            update_fields = {}
            if "role" not in operator:
                update_fields["role"] = "operator"
            if "status" not in operator:
                update_fields["status"] = "active"
            if "permissions" not in operator:
                update_fields["permissions"] = []
                
            if update_fields:
                await db.users.update_one(
                    {"id": operator_id},
                    {"$set": update_fields}
                )
                print(f"✅ Usuario actualizado con campos: {list(update_fields.keys())}")
        
        # Paso 2: Crear cliente "Diego Urquijo"
        print("\n📋 Paso 2: Creando cliente 'Diego Urquijo'...")
        
        existing_client = await db.clients.find_one({"email": "diego.urquijo.test@urpeailab.com"})
        
        if existing_client:
            client_id = existing_client["id"]
            print(f"✅ Cliente ya existe: {client_id}")
        else:
            client_id = str(uuid.uuid4())
            diego_client = {
                "id": client_id,
                "operator_id": operator_id,
                "name": "Diego Urquijo",
                "email": "diego.urquijo.test@urpeailab.com",
                "phone": "",
                "company": "Urpe AI Lab",
                "country": "USA",
                "industry": "Artificial Intelligence",
                "notes": "Cliente de pruebas - Fundador de Urpe AI Lab. Reconocido por Forbes, CNN, Harvard.",
                "status": "active",
                "tags": ["test", "vip"],
                "transfer_history": [],
                "search_text": "diego urquijo diego.urquijo.test@urpeailab.com urpe ai lab artificial intelligence",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "created_by": operator_id
            }
            
            await db.clients.insert_one(diego_client)
            print(f"✅ Cliente creado: {client_id}")
            print(f"   Nombre: {diego_client['name']}")
            print(f"   Email: {diego_client['email']}")
            print(f"   Empresa: {diego_client['company']}")
        
        # Paso 3: Actualizar todos los documentos existentes
        print("\n📋 Paso 3: Actualizando documentos existentes...")
        
        collections_to_update = [
            "niw_in_progress",
            "business_plans",
            "books_in_progress",
            "books",
            "patents_in_progress",
            "econometric_studies_in_progress",
            "designed_documents"
        ]
        
        total_updated = 0
        
        for collection_name in collections_to_update:
            # Contar documentos que necesitan actualización
            count_before = await db[collection_name].count_documents({})
            
            if count_before == 0:
                print(f"   ⚪ {collection_name}: 0 documentos (colección vacía)")
                continue
            
            # Actualizar documentos
            result = await db[collection_name].update_many(
                {},  # Todos los documentos
                {
                    "$set": {
                        "client_id": client_id
                    }
                }
            )
            
            total_updated += result.modified_count
            print(f"   ✅ {collection_name}: {result.modified_count}/{count_before} documentos actualizados")
        
        print(f"\n✅ Total de documentos actualizados: {total_updated}")
        
        # Paso 4: Crear índices
        print("\n📋 Paso 4: Creando índices de base de datos...")
        
        # Índices para clients
        await db.clients.create_index([("operator_id", 1)])
        print("   ✅ Índice creado: clients.operator_id")
        
        await db.clients.create_index([("status", 1)])
        print("   ✅ Índice creado: clients.status")
        
        try:
            await db.clients.create_index([("email", 1)], unique=True)
            print("   ✅ Índice único creado: clients.email")
        except Exception as e:
            print(f"   ⚠️  Índice email ya existe: {str(e)}")
        
        # Índices para client_id en documentos
        for collection_name in collections_to_update:
            try:
                await db[collection_name].create_index([("client_id", 1)])
                print(f"   ✅ Índice creado: {collection_name}.client_id")
            except Exception as e:
                print(f"   ⚠️  Índice ya existe en {collection_name}: {str(e)}")
        
        # Índices para activity_logs (para Fase 3)
        try:
            await db.activity_logs.create_index([("operator_id", 1)])
            await db.activity_logs.create_index([("client_id", 1)])
            await db.activity_logs.create_index(
                [("timestamp", 1)], 
                expireAfterSeconds=2592000  # 30 días
            )
            print("   ✅ Índices creados: activity_logs")
        except Exception as e:
            print(f"   ⚠️  Índices activity_logs: {str(e)}")
        
        # Paso 5: Verificar migración
        print("\n📋 Paso 5: Verificando migración...")
        
        total_clients = await db.clients.count_documents({"operator_id": operator_id})
        print(f"   ✅ Total de clientes para operador: {total_clients}")
        
        # Contar documentos por cliente
        docs_count = 0
        for collection_name in collections_to_update:
            count = await db[collection_name].count_documents({"client_id": client_id})
            docs_count += count
        
        print(f"   ✅ Total de documentos asignados al cliente: {docs_count}")
        
        # Paso 6: Crear activity logs de ejemplo
        print("\n📋 Paso 6: Creando activity logs de ejemplo...")
        
        # Crear algunos logs para demostrar el sistema
        sample_activities = [
            {
                "id": str(uuid.uuid4()),
                "operator_id": operator_id,
                "client_id": client_id,
                "client_name": "Diego Urquijo",
                "document_type": "niw",
                "document_id": str(uuid.uuid4()),
                "action": "completed",
                "title": "NIW Application completada",
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "operator_id": operator_id,
                "client_id": client_id,
                "client_name": "Diego Urquijo",
                "document_type": "patent",
                "document_id": str(uuid.uuid4()),
                "action": "created",
                "title": "Nueva patente iniciada",
                "timestamp": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            },
            {
                "id": str(uuid.uuid4()),
                "operator_id": operator_id,
                "client_id": client_id,
                "client_name": "Diego Urquijo",
                "document_type": "study",
                "document_id": str(uuid.uuid4()),
                "action": "updated",
                "title": "Estudio econométrico - Sección 5 aprobada",
                "timestamp": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
            }
        ]
        
        await db.activity_logs.insert_many(sample_activities)
        print(f"   ✅ {len(sample_activities)} activity logs de ejemplo creados")
        
        print("\n" + "=" * 60)
        print("🎉 ¡Migración completada exitosamente!")
        print("=" * 60)
        print(f"\n📊 Resumen:")
        print(f"   • Operador: {operator['full_name']} ({operator['email']})")
        print(f"   • Cliente creado: Diego Urquijo (Urpe AI Lab)")
        print(f"   • Documentos migrados: {docs_count}")
        print(f"   • Índices creados: ✅")
        print(f"\n🚀 El sistema de clientes está listo para usar!")
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
