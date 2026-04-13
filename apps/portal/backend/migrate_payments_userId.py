#!/usr/bin/env python3
"""
Script de migración: Agregar userId a pagos manuales existentes
Busca el userId desde el caso asociado y lo agrega al registro del pago
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'urpe_db')

async def migrate_payments():
    """Migrate existing manual payments to add userId field"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        print("🔍 Buscando pagos manuales sin userId...")
        
        # Find all manual payments that don't have userId
        payments_without_userId = await db.manual_payments.find(
            {'userId': {'$exists': False}},
            {'_id': 0, 'id': 1, 'caseId': 1}
        ).to_list(length=10000)
        
        total_payments = len(payments_without_userId)
        print(f"📊 Encontrados {total_payments} pagos sin userId")
        
        if total_payments == 0:
            print("✅ No hay pagos que migrar. Todos los pagos ya tienen userId.")
            return
        
        updated_count = 0
        skipped_count = 0
        
        for payment in payments_without_userId:
            payment_id = payment.get('id')
            case_id = payment.get('caseId')
            
            if not case_id:
                print(f"⚠️  Pago {payment_id}: No tiene caseId, omitiendo...")
                skipped_count += 1
                continue
            
            # Find the case to get userId
            case = await db.visa_cases.find_one({'id': case_id}, {'_id': 0, 'userId': 1})
            
            if not case:
                print(f"⚠️  Pago {payment_id}: Caso {case_id} no encontrado, omitiendo...")
                skipped_count += 1
                continue
            
            user_id = case.get('userId')
            if not user_id:
                print(f"⚠️  Pago {payment_id}: Caso {case_id} no tiene userId, omitiendo...")
                skipped_count += 1
                continue
            
            # Update the payment with userId
            result = await db.manual_payments.update_one(
                {'id': payment_id},
                {'$set': {'userId': user_id}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"✅ Pago {payment_id}: userId agregado ({user_id[:10]}...)")
            else:
                print(f"⚠️  Pago {payment_id}: No se pudo actualizar")
                skipped_count += 1
        
        print("\n" + "="*60)
        print("📊 RESUMEN DE MIGRACIÓN")
        print("="*60)
        print(f"Total de pagos procesados: {total_payments}")
        print(f"✅ Pagos actualizados: {updated_count}")
        print(f"⚠️  Pagos omitidos: {skipped_count}")
        print("="*60)
        
        if updated_count > 0:
            print("\n✅ Migración completada exitosamente!")
        else:
            print("\n⚠️  No se actualizó ningún pago.")
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()
        print("\n🔌 Conexión a MongoDB cerrada")

if __name__ == "__main__":
    print("="*60)
    print("🚀 SCRIPT DE MIGRACIÓN: Agregar userId a pagos manuales")
    print("="*60)
    print()
    
    # Run the migration
    asyncio.run(migrate_payments())
