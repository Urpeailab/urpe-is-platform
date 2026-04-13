"""
Script para exportar el Caso Maestro (Master Case) de desarrollo
y poder importarlo en producción.

Uso:
  # Exportar caso maestro a JSON
  python scripts/export_master_case.py --export
  
  # Importar caso maestro desde JSON (en producción)
  python scripts/export_master_case.py --import
  
  # Ver el caso maestro actual
  python scripts/export_master_case.py --view
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Configuración de base de datos
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Nombre del archivo de exportación
EXPORT_FILE = 'master_case_export.json'


async def get_db():
    """Conectar a la base de datos"""
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME], client


async def export_master_case():
    """Exportar el caso maestro y sus etapas a un archivo JSON"""
    print("=" * 60)
    print("EXPORTAR CASO MAESTRO")
    print("=" * 60)
    
    db, client = await get_db()
    
    try:
        # 1. Buscar el caso maestro
        print("\n📋 Buscando caso maestro...")
        master_case = await db.visa_cases.find_one({'_id': 'master_case_eb2_niw'})
        
        if not master_case:
            print("❌ No se encontró el caso maestro con _id='master_case_eb2_niw'")
            return False
        
        print(f"✅ Caso maestro encontrado: {master_case.get('visaType', 'N/A')}")
        
        # 2. Buscar las etapas del caso maestro
        print("\n📋 Buscando etapas del caso maestro...")
        stages_cursor = db.visa_stages.find({'caseId': 'master_case_eb2_niw'})
        master_stages = await stages_cursor.to_list(100)
        
        print(f"✅ {len(master_stages)} etapas encontradas")
        
        # 3. Preparar datos para exportación
        export_data = {
            'exportedAt': datetime.now(timezone.utc).isoformat(),
            'exportedFrom': DB_NAME,
            'masterCase': master_case,
            'masterStages': master_stages,
            'summary': {
                'caseId': master_case.get('_id'),
                'visaType': master_case.get('visaType'),
                'totalStages': len(master_stages),
                'stages': [
                    {
                        'number': s.get('stageNumber'),
                        'name': s.get('stageName'),
                        'amount': s.get('amount')
                    }
                    for s in sorted(master_stages, key=lambda x: x.get('stageNumber', 0))
                ]
            }
        }
        
        # 4. Guardar a archivo JSON
        with open(EXPORT_FILE, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"\n✅ Exportación completada: {EXPORT_FILE}")
        print("\n📊 Resumen:")
        print(f"   - Caso: {export_data['summary']['caseId']}")
        print(f"   - Tipo de Visa: {export_data['summary']['visaType']}")
        print(f"   - Total Etapas: {export_data['summary']['totalStages']}")
        print("\n   Etapas:")
        for stage in export_data['summary']['stages']:
            print(f"   {stage['number']}. {stage['name']} - ${stage['amount']}")
        
        return True
        
    finally:
        client.close()


async def import_master_case(force=False):
    """Importar el caso maestro desde un archivo JSON"""
    print("=" * 60)
    print("IMPORTAR CASO MAESTRO")
    print("=" * 60)
    
    # 1. Verificar que existe el archivo
    if not os.path.exists(EXPORT_FILE):
        print(f"❌ No se encontró el archivo: {EXPORT_FILE}")
        print("   Primero ejecuta: python scripts/export_master_case.py --export")
        return False
    
    # 2. Cargar datos del archivo
    print(f"\n📋 Cargando datos de {EXPORT_FILE}...")
    with open(EXPORT_FILE, 'r', encoding='utf-8') as f:
        import_data = json.load(f)
    
    master_case = import_data.get('masterCase')
    master_stages = import_data.get('masterStages', [])
    
    print(f"✅ Datos cargados:")
    print(f"   - Exportado: {import_data.get('exportedAt')}")
    print(f"   - Desde: {import_data.get('exportedFrom')}")
    print(f"   - Etapas: {len(master_stages)}")
    
    db, client = await get_db()
    
    try:
        # 3. Verificar si ya existe el caso maestro
        existing_case = await db.visa_cases.find_one({'_id': 'master_case_eb2_niw'})
        
        if existing_case and not force:
            print("\n⚠️  Ya existe un caso maestro en esta base de datos.")
            print("   Usa --force para sobrescribir.")
            return False
        
        # 4. Eliminar caso maestro existente si se usa --force
        if existing_case and force:
            print("\n🗑️  Eliminando caso maestro existente...")
            await db.visa_cases.delete_one({'_id': 'master_case_eb2_niw'})
            await db.visa_stages.delete_many({'caseId': 'master_case_eb2_niw'})
            print("✅ Caso maestro anterior eliminado")
        
        # 5. Insertar nuevo caso maestro
        print("\n📥 Insertando caso maestro...")
        await db.visa_cases.insert_one(master_case)
        print("✅ Caso maestro insertado")
        
        # 6. Insertar etapas
        print(f"\n📥 Insertando {len(master_stages)} etapas...")
        if master_stages:
            await db.visa_stages.insert_many(master_stages)
        print("✅ Etapas insertadas")
        
        print("\n" + "=" * 60)
        print("✅ IMPORTACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        
        return True
        
    finally:
        client.close()


async def view_master_case():
    """Ver el caso maestro actual en la base de datos"""
    print("=" * 60)
    print("VER CASO MAESTRO")
    print("=" * 60)
    
    db, client = await get_db()
    
    try:
        # Buscar caso maestro
        master_case = await db.visa_cases.find_one({'_id': 'master_case_eb2_niw'})
        
        if not master_case:
            print("\n❌ No se encontró caso maestro en la base de datos.")
            return
        
        # Buscar etapas
        stages_cursor = db.visa_stages.find({'caseId': 'master_case_eb2_niw'})
        stages = await stages_cursor.to_list(100)
        
        print(f"\n📋 Caso Maestro:")
        print(f"   ID: {master_case.get('_id')}")
        print(f"   Tipo de Visa: {master_case.get('visaType')}")
        print(f"   Descripción: {master_case.get('description', 'N/A')}")
        print(f"   Creado: {master_case.get('createdAt', 'N/A')}")
        
        print(f"\n📋 Etapas ({len(stages)}):")
        for stage in sorted(stages, key=lambda x: x.get('stageNumber', 0)):
            status = '✅' if stage.get('status') == 'completed' else '⏳'
            print(f"   {status} Etapa {stage.get('stageNumber')}: {stage.get('stageName')} - ${stage.get('amount', 0)}")
            
            # Mostrar deliverables si existen
            deliverables = stage.get('deliverables', [])
            if deliverables:
                for d in deliverables[:3]:  # Mostrar máximo 3
                    print(f"      - {d.get('name', 'N/A')}")
                if len(deliverables) > 3:
                    print(f"      ... y {len(deliverables) - 3} más")
        
    finally:
        client.close()


def print_usage():
    """Mostrar instrucciones de uso"""
    print("""
Uso: python scripts/export_master_case.py [opción]

Opciones:
  --export    Exportar caso maestro a JSON
  --import    Importar caso maestro desde JSON
  --force     Usar con --import para sobrescribir existente
  --view      Ver caso maestro actual
  --help      Mostrar esta ayuda

Ejemplos:
  # En desarrollo - exportar
  python scripts/export_master_case.py --export
  
  # En producción - importar
  python scripts/export_master_case.py --import
  
  # Sobrescribir caso existente
  python scripts/export_master_case.py --import --force
""")


if __name__ == '__main__':
    args = sys.argv[1:]
    
    if not args or '--help' in args:
        print_usage()
        sys.exit(0)
    
    if '--export' in args:
        asyncio.run(export_master_case())
    elif '--import' in args:
        force = '--force' in args
        asyncio.run(import_master_case(force=force))
    elif '--view' in args:
        asyncio.run(view_master_case())
    else:
        print("❌ Opción no reconocida")
        print_usage()
        sys.exit(1)
