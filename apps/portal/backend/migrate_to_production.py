#!/usr/bin/env python3
"""
Script de Migración a Producción para URPE
Migra el caso maestro y datos esenciales del sistema
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import sys

# Configuración de MongoDB
SOURCE_MONGO_URL = "mongodb://localhost:27017"
SOURCE_DB_NAME = "test_database"

# IMPORTANTE: Configurar la URL de producción
PRODUCTION_MONGO_URL = os.getenv("PRODUCTION_MONGO_URL", "mongodb://localhost:27017")
PRODUCTION_DB_NAME = os.getenv("PRODUCTION_DB_NAME", "urpe_production")

# Colores para output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}{Colors.ENDC}\n")


def print_success(text):
    print(f"{Colors.OKGREEN}✅ {text}{Colors.ENDC}")


def print_warning(text):
    print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")


def print_error(text):
    print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")


def print_info(text):
    print(f"{Colors.OKCYAN}ℹ️  {text}{Colors.ENDC}")


async def migrate_master_case():
    """Migra el caso maestro y sus datos asociados"""
    
    print_header("SCRIPT DE MIGRACIÓN A PRODUCCIÓN - URPE")
    
    # Conectar a base de datos de origen
    print_info(f"Conectando a base de datos de origen: {SOURCE_DB_NAME}")
    source_client = AsyncIOMotorClient(SOURCE_MONGO_URL)
    source_db = source_client[SOURCE_DB_NAME]
    
    # Conectar a base de datos de producción
    print_info(f"Conectando a base de datos de producción: {PRODUCTION_DB_NAME}")
    prod_client = AsyncIOMotorClient(PRODUCTION_MONGO_URL)
    prod_db = prod_client[PRODUCTION_DB_NAME]
    
    try:
        # 1. MIGRAR CASO MAESTRO
        print_header("1. MIGRANDO CASO MAESTRO")
        
        master_case = await source_db.visa_cases.find_one({"isMasterCase": True})
        
        if not master_case:
            print_error("No se encontró caso maestro en la base de datos de origen")
            print_warning("Creando caso maestro básico...")
            
            # Crear caso maestro básico si no existe
            master_case = {
                "caseId": "master_case_eb2_niw",
                "userId": "MASTER_TEMPLATE",
                "visaType": "EB-2 NIW",
                "status": "template",
                "isMasterCase": True,
                "currentStage": 1,
                "overallProgress": 0,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        
        # Verificar si ya existe en producción
        existing_master = await prod_db.visa_cases.find_one({"isMasterCase": True})
        
        if existing_master:
            print_warning(f"Caso maestro ya existe en producción: {existing_master.get('caseId')}")
            response = input("¿Desea sobrescribirlo? (y/n): ")
            if response.lower() != 'y':
                print_info("Saltando migración del caso maestro")
            else:
                await prod_db.visa_cases.replace_one(
                    {"isMasterCase": True},
                    master_case
                )
                print_success(f"Caso maestro actualizado: {master_case.get('caseId')}")
        else:
            result = await prod_db.visa_cases.insert_one(master_case)
            print_success(f"Caso maestro creado: {master_case.get('caseId')}")
        
        # 2. MIGRAR ETAPAS DEL CASO MAESTRO
        print_header("2. MIGRANDO ETAPAS DEL CASO MAESTRO")
        
        master_case_id = master_case.get('caseId')
        stages = await source_db.visa_stages.find({"caseId": master_case_id}).to_list(1000)
        
        if stages:
            # Limpiar etapas existentes del caso maestro en producción
            delete_result = await prod_db.visa_stages.delete_many({"caseId": master_case_id})
            if delete_result.deleted_count > 0:
                print_info(f"Eliminadas {delete_result.deleted_count} etapas antiguas")
            
            # Insertar nuevas etapas
            if stages:
                await prod_db.visa_stages.insert_many(stages)
                print_success(f"Migradas {len(stages)} etapas del caso maestro")
                
                for stage in stages:
                    print_info(f"   - Stage {stage.get('stageNumber')}: {stage.get('name', {}).get('es', 'N/A')}")
        else:
            print_warning("No se encontraron etapas para el caso maestro")
        
        # 3. MIGRAR DELIVERABLES DEL CASO MAESTRO
        print_header("3. MIGRANDO DELIVERABLES DEL CASO MAESTRO")
        
        deliverables = await source_db.visa_deliverables.find({"caseId": master_case_id}).to_list(1000)
        
        if deliverables:
            # Limpiar deliverables existentes del caso maestro en producción
            delete_result = await prod_db.visa_deliverables.delete_many({"caseId": master_case_id})
            if delete_result.deleted_count > 0:
                print_info(f"Eliminados {delete_result.deleted_count} deliverables antiguos")
            
            # Insertar nuevos deliverables
            await prod_db.visa_deliverables.insert_many(deliverables)
            print_success(f"Migrados {len(deliverables)} deliverables del caso maestro")
            
            # Agrupar por stage
            by_stage = {}
            for deliv in deliverables:
                stage_num = deliv.get('stageNumber', 0)
                if stage_num not in by_stage:
                    by_stage[stage_num] = []
                by_stage[stage_num].append(deliv)
            
            for stage_num in sorted(by_stage.keys()):
                print_info(f"   - Stage {stage_num}: {len(by_stage[stage_num])} deliverables")
        else:
            print_warning("No se encontraron deliverables para el caso maestro")
        
        # 4. MIGRAR DOCUMENTOS DEL CLIENTE (template)
        print_header("4. MIGRANDO DOCUMENTOS DEL CLIENTE (TEMPLATE)")
        
        client_docs = await source_db.visa_client_documents.find({"caseId": master_case_id}).to_list(1000)
        
        if client_docs:
            # Limpiar documentos existentes
            delete_result = await prod_db.visa_client_documents.delete_many({"caseId": master_case_id})
            if delete_result.deleted_count > 0:
                print_info(f"Eliminados {delete_result.deleted_count} documentos antiguos")
            
            # Insertar nuevos documentos
            await prod_db.visa_client_documents.insert_many(client_docs)
            print_success(f"Migrados {len(client_docs)} documentos del cliente (template)")
            
            # Agrupar por stage
            by_stage = {}
            for doc in client_docs:
                stage_num = doc.get('stageNumber', 0)
                if stage_num not in by_stage:
                    by_stage[stage_num] = []
                by_stage[stage_num].append(doc)
            
            for stage_num in sorted(by_stage.keys()):
                print_info(f"   - Stage {stage_num}: {len(by_stage[stage_num])} documentos")
        else:
            print_info("No hay documentos de cliente en el template (esto es normal)")
        
        # 5. MIGRAR SUPER ADMIN
        print_header("5. VERIFICANDO SUPER ADMIN")
        
        super_admin = await source_db.staff.find_one({"role": "super_admin"})
        
        if super_admin:
            existing_admin = await prod_db.staff.find_one({"email": super_admin.get('email')})
            
            if existing_admin:
                print_warning(f"Super admin ya existe: {super_admin.get('email')}")
            else:
                await prod_db.staff.insert_one(super_admin)
                print_success(f"Super admin creado: {super_admin.get('email')}")
        else:
            print_warning("No se encontró super admin en origen")
            print_info("Recuerda crear un super admin con: python3 create_super_admin.py")
        
        # 6. RESUMEN
        print_header("RESUMEN DE MIGRACIÓN")
        
        # Contar datos en producción
        master_cases_count = await prod_db.visa_cases.count_documents({"isMasterCase": True})
        stages_count = await prod_db.visa_stages.count_documents({"caseId": master_case_id})
        deliverables_count = await prod_db.visa_deliverables.count_documents({"caseId": master_case_id})
        client_docs_count = await prod_db.visa_client_documents.count_documents({"caseId": master_case_id})
        admin_count = await prod_db.staff.count_documents({"role": "super_admin"})
        
        print_success(f"Casos maestros: {master_cases_count}")
        print_success(f"Etapas: {stages_count}")
        print_success(f"Deliverables: {deliverables_count}")
        print_success(f"Documentos cliente: {client_docs_count}")
        print_success(f"Super admins: {admin_count}")
        
        print_header("MIGRACIÓN COMPLETADA EXITOSAMENTE")
        
        print_info("\n📝 PRÓXIMOS PASOS:")
        print_info("1. Verificar datos en producción")
        print_info("2. Crear super admin si es necesario: python3 create_super_admin.py")
        print_info("3. Configurar variables de entorno de producción")
        print_info("4. Probar creación de un caso real desde el admin panel")
        
    except Exception as e:
        print_error(f"Error durante la migración: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        source_client.close()
        prod_client.close()
    
    return True


async def verify_migration():
    """Verifica que la migración se haya realizado correctamente"""
    
    print_header("VERIFICACIÓN DE MIGRACIÓN")
    
    prod_client = AsyncIOMotorClient(PRODUCTION_MONGO_URL)
    prod_db = prod_client[PRODUCTION_DB_NAME]
    
    try:
        # Verificar caso maestro
        master_case = await prod_db.visa_cases.find_one({"isMasterCase": True})
        
        if not master_case:
            print_error("❌ Caso maestro no encontrado en producción")
            return False
        
        print_success(f"Caso maestro: {master_case.get('caseId')}")
        
        # Verificar etapas
        stages_count = await prod_db.visa_stages.count_documents({"caseId": master_case.get('caseId')})
        print_success(f"Etapas: {stages_count}")
        
        # Verificar deliverables
        deliverables_count = await prod_db.visa_deliverables.count_documents({"caseId": master_case.get('caseId')})
        print_success(f"Deliverables: {deliverables_count}")
        
        # Listar etapas
        print_info("\nEtapas migradas:")
        stages = await prod_db.visa_stages.find(
            {"caseId": master_case.get('caseId')},
            {"stageNumber": 1, "name": 1, "amount": 1}
        ).sort("stageNumber", 1).to_list(100)
        
        for stage in stages:
            stage_name = stage.get('name', {}).get('es', 'N/A')
            stage_amount = stage.get('amount', 0)
            print_info(f"   Stage {stage.get('stageNumber')}: {stage_name} - ${stage_amount}")
        
        return True
        
    except Exception as e:
        print_error(f"Error en verificación: {e}")
        return False
    finally:
        prod_client.close()


def main():
    """Función principal"""
    
    print_info("🚀 Iniciando script de migración a producción...")
    print_info(f"📁 Base de datos de origen: {SOURCE_DB_NAME}")
    print_info(f"📁 Base de datos de producción: {PRODUCTION_DB_NAME}")
    
    if PRODUCTION_MONGO_URL == SOURCE_MONGO_URL and PRODUCTION_DB_NAME == SOURCE_DB_NAME:
        print_warning("\n⚠️  ADVERTENCIA: Origen y destino son la misma base de datos!")
        print_warning("Esto sobrescribirá datos existentes.")
        response = input("\n¿Continuar de todos modos? (yes/no): ")
        if response.lower() != 'yes':
            print_info("Migración cancelada")
            return
    
    print_warning("\n⚠️  Este script migrará los siguientes datos:")
    print_info("   - Caso maestro (template)")
    print_info("   - Etapas del caso maestro")
    print_info("   - Deliverables del caso maestro")
    print_info("   - Documentos del cliente (template)")
    print_info("   - Super admin")
    
    response = input("\n¿Desea continuar? (y/n): ")
    
    if response.lower() != 'y':
        print_info("Migración cancelada")
        return
    
    # Ejecutar migración
    success = asyncio.run(migrate_master_case())
    
    if success:
        print_info("\n¿Desea verificar la migración? (y/n): ")
        response = input()
        if response.lower() == 'y':
            asyncio.run(verify_migration())
    else:
        print_error("La migración falló. Revisa los errores arriba.")
        sys.exit(1)


if __name__ == "__main__":
    main()
