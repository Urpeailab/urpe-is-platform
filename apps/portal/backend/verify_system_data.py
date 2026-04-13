#!/usr/bin/env python3
"""
Verificador de Datos del Sistema URPE
Verifica que todos los datos necesarios estén presentes
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

# Colores
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(status, text):
    if status == "OK":
        print(f"{Colors.GREEN}✅ {text}{Colors.ENDC}")
    elif status == "WARNING":
        print(f"{Colors.YELLOW}⚠️  {text}{Colors.ENDC}")
    elif status == "ERROR":
        print(f"{Colors.RED}❌ {text}{Colors.ENDC}")
    else:
        print(f"{Colors.BLUE}ℹ️  {text}{Colors.ENDC}")

async def verify_system():
    """Verifica que el sistema tenga todos los datos necesarios"""
    
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"\n{Colors.BOLD}{'='*70}")
    print(f"  VERIFICACIÓN DE DATOS DEL SISTEMA URPE")
    print(f"  Base de datos: {db_name}")
    print(f"{'='*70}{Colors.ENDC}\n")
    
    issues = []
    warnings = []
    
    # 1. CASO MAESTRO
    print(f"{Colors.BOLD}1. CASO MAESTRO (CRÍTICO){Colors.ENDC}")
    master_case = await db.visa_cases.find_one({"isMasterCase": True})
    
    if master_case:
        print_status("OK", f"Caso maestro existe: {master_case.get('caseId')}")
        print_status("INFO", f"   Tipo de visa: {master_case.get('visaType')}")
        
        # Verificar etapas
        stages = await db.visa_stages.find({"caseId": master_case['caseId']}).to_list(100)
        if len(stages) >= 5:
            print_status("OK", f"   Etapas: {len(stages)}")
            
            # Verificar que las etapas tengan precios
            stages_without_price = [s for s in stages if not s.get('amount') or s.get('amount') == 0]
            if stages_without_price:
                warning = f"   {len(stages_without_price)} etapas sin precio configurado"
                print_status("WARNING", warning)
                warnings.append(warning)
        else:
            error = f"   Pocas etapas: {len(stages)} (se esperan al menos 5)"
            print_status("ERROR", error)
            issues.append(error)
        
        # Verificar deliverables
        deliverables = await db.visa_deliverables.find({"caseId": master_case['caseId']}).to_list(1000)
        if len(deliverables) >= 10:
            print_status("OK", f"   Deliverables: {len(deliverables)}")
        else:
            warning = f"   Pocos deliverables: {len(deliverables)} (se esperan al menos 10)"
            print_status("WARNING", warning)
            warnings.append(warning)
        
        # Verificar documentos del cliente
        client_docs = await db.visa_client_documents.find({"caseId": master_case['caseId']}).to_list(1000)
        if len(client_docs) >= 5:
            print_status("OK", f"   Documentos del cliente: {len(client_docs)}")
        else:
            warning = f"   Pocos documentos: {len(client_docs)}"
            print_status("WARNING", warning)
            warnings.append(warning)
    else:
        error = "Caso maestro NO EXISTE - CRÍTICO"
        print_status("ERROR", error)
        issues.append(error)
    
    # 2. SUPER ADMIN
    print(f"\n{Colors.BOLD}2. SUPER ADMIN (CRÍTICO){Colors.ENDC}")
    super_admin = await db.staff.find_one({"role": "super_admin"})
    
    if super_admin:
        print_status("OK", f"Super admin existe: {super_admin.get('email')}")
    else:
        error = "Super admin NO EXISTE - necesario para acceder al sistema"
        print_status("ERROR", error)
        issues.append(error)
        print_status("INFO", "   Solución: ejecutar python3 create_super_admin.py")
    
    # 3. OTROS STAFF
    print(f"\n{Colors.BOLD}3. STAFF ADICIONAL (OPCIONAL){Colors.ENDC}")
    all_staff = await db.staff.find({}).to_list(100)
    
    roles_count = {}
    for s in all_staff:
        role = s.get('role', 'unknown')
        roles_count[role] = roles_count.get(role, 0) + 1
    
    if len(all_staff) > 1:
        print_status("OK", f"Staff total: {len(all_staff)}")
        for role, count in roles_count.items():
            print_status("INFO", f"   {role}: {count}")
    else:
        print_status("WARNING", "Solo hay super admin, se recomienda crear coordinadores")
        warnings.append("Crear coordinadores y advisors")
    
    # 4. VARIABLES DE ENTORNO
    print(f"\n{Colors.BOLD}4. VARIABLES DE ENTORNO (CRÍTICO){Colors.ENDC}")
    
    required_env_vars = {
        'MONGO_URL': 'URL de MongoDB',
        'DB_NAME': 'Nombre de la base de datos',
        'JWT_SECRET': 'Secreto para tokens JWT',
        'FANBASIS_API_KEY': 'API Key de FanBasis',
        'FANBASIS_WEBHOOK_SECRET': 'Secret del webhook de FanBasis',
        'SUPABASE_URL': 'URL de Supabase',
        'SUPABASE_KEY': 'Key de Supabase',
        'SUPABASE_STORAGE_BUCKET': 'Bucket de almacenamiento'
    }
    
    for var, description in required_env_vars.items():
        value = os.environ.get(var)
        if value:
            # Ocultar valores sensibles
            display_value = value[:10] + "..." if len(value) > 10 else value
            print_status("OK", f"{var}: configurado ({display_value})")
        else:
            warning = f"{var}: NO configurado - {description}"
            print_status("WARNING", warning)
            warnings.append(warning)
    
    # 5. COLECCIONES DE LA BASE DE DATOS
    print(f"\n{Colors.BOLD}5. COLECCIONES DE LA BASE DE DATOS{Colors.ENDC}")
    
    expected_collections = {
        'visa_cases': True,  # Crítico
        'visa_stages': True,  # Crítico
        'visa_deliverables': True,  # Crítico
        'visa_client_documents': True,  # Crítico
        'staff': True,  # Crítico
        'users': False,  # Se crea automáticamente
        'payment_transactions': False,  # Se crea automáticamente
        'activity_log': False,  # Se crea automáticamente
        'magic_links': False,  # Se crea automáticamente
    }
    
    for coll, is_critical in expected_collections.items():
        count = await db[coll].count_documents({})
        if count > 0:
            print_status("OK", f"{coll}: {count} documentos")
        elif is_critical:
            warning = f"{coll}: VACÍO (se llenará automáticamente)"
            print_status("WARNING", warning)
        else:
            print_status("INFO", f"{coll}: VACÍO (normal, se llena con el uso)")
    
    # 6. CONFIGURACIÓN DE SUPABASE
    print(f"\n{Colors.BOLD}6. SUPABASE STORAGE (CRÍTICO){Colors.ENDC}")
    
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_KEY')
    supabase_bucket = os.environ.get('SUPABASE_STORAGE_BUCKET')
    
    if supabase_url and supabase_key and supabase_bucket:
        print_status("OK", "Configuración de Supabase completa")
        print_status("INFO", f"   Bucket: {supabase_bucket}")
    else:
        error = "Supabase NO configurado - necesario para almacenar archivos"
        print_status("ERROR", error)
        issues.append(error)
        print_status("INFO", "   Solución: revisar SUPABASE_BUCKET_SETUP.md")
    
    # 7. CONFIGURACIÓN DE FANBASIS
    print(f"\n{Colors.BOLD}7. FANBASIS PAGOS (IMPORTANTE){Colors.ENDC}")
    
    fanbasis_key = os.environ.get('FANBASIS_API_KEY')
    fanbasis_secret = os.environ.get('FANBASIS_WEBHOOK_SECRET')
    
    if fanbasis_key and fanbasis_secret:
        print_status("OK", "Configuración de FanBasis completa")
        print_status("INFO", "   Webhook configurado y listo")
    else:
        warning = "FanBasis NO completamente configurado"
        print_status("WARNING", warning)
        warnings.append(warning)
        print_status("INFO", "   Sistema funcionará con flujo manual de pagos")
    
    # RESUMEN
    print(f"\n{Colors.BOLD}{'='*70}")
    print(f"  RESUMEN DE VERIFICACIÓN")
    print(f"{'='*70}{Colors.ENDC}\n")
    
    if not issues and not warnings:
        print_status("OK", "✨ Sistema completamente configurado y listo para usar")
    else:
        if issues:
            print(f"{Colors.RED}{Colors.BOLD}PROBLEMAS CRÍTICOS: {len(issues)}{Colors.ENDC}")
            for issue in issues:
                print(f"   {Colors.RED}❌ {issue}{Colors.ENDC}")
        
        if warnings:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}ADVERTENCIAS: {len(warnings)}{Colors.ENDC}")
            for warning in warnings:
                print(f"   {Colors.YELLOW}⚠️  {warning}{Colors.ENDC}")
    
    print(f"\n{Colors.BOLD}ACCIONES RECOMENDADAS:{Colors.ENDC}")
    
    if not master_case:
        print_status("INFO", "1. Ejecutar script de migración: python3 migrate_to_production.py")
    
    if not super_admin:
        print_status("INFO", "2. Crear super admin: python3 create_super_admin.py")
    
    if not supabase_url or not supabase_key:
        print_status("INFO", "3. Configurar Supabase: revisar SUPABASE_BUCKET_SETUP.md")
    
    if len(all_staff) <= 1:
        print_status("INFO", "4. Crear coordinadores desde el panel de admin")
    
    print(f"\n{Colors.BOLD}{'='*70}{Colors.ENDC}\n")
    
    client.close()
    
    return len(issues) == 0

if __name__ == "__main__":
    success = asyncio.run(verify_system())
    exit(0 if success else 1)
