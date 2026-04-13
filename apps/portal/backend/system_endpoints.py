"""
System Management Endpoints
Endpoints para gestionar el sistema desde HTTP
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from admin_models import StaffModel
import logging

load_dotenv()
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/system", tags=["system"])


def setup_system_endpoints(db, verify_admin_token):
    """Setup system management endpoints"""
    
    @router.get("/verify")
    async def verify_system_data():
        """
        Verifica que el sistema tenga todos los datos necesarios
        Endpoint público para debugging (considerar proteger en producción)
        """
        try:
            issues = []
            warnings = []
            results = {}
            
            # 1. CASO MAESTRO
            master_case = await db.visa_cases.find_one({"isMasterCase": True})
            
            if master_case:
                results['master_case'] = {
                    'exists': True,
                    'caseId': master_case.get('caseId'),
                    'visaType': master_case.get('visaType')
                }
                
                # Verificar etapas
                stages = await db.visa_stages.find({"caseId": master_case['caseId']}).to_list(100)
                results['stages'] = {
                    'count': len(stages),
                    'ok': len(stages) >= 5
                }
                
                if len(stages) < 5:
                    issues.append(f"Pocas etapas: {len(stages)} (se esperan al menos 5)")
                
                # Verificar precios
                stages_without_price = [s for s in stages if not s.get('amount') or s.get('amount') == 0]
                if stages_without_price:
                    warnings.append(f"{len(stages_without_price)} etapas sin precio configurado")
                
                # Verificar deliverables
                deliverables = await db.visa_deliverables.find({"caseId": master_case['caseId']}).to_list(1000)
                results['deliverables'] = {
                    'count': len(deliverables),
                    'ok': len(deliverables) >= 10
                }
                
                if len(deliverables) < 10:
                    warnings.append(f"Pocos deliverables: {len(deliverables)}")
                
                # Verificar documentos del cliente
                client_docs = await db.visa_client_documents.find({"caseId": master_case['caseId']}).to_list(1000)
                results['client_documents'] = {
                    'count': len(client_docs),
                    'ok': len(client_docs) >= 5
                }
                
            else:
                results['master_case'] = {'exists': False}
                issues.append("Caso maestro NO EXISTE - CRÍTICO")
            
            # 2. SUPER ADMIN
            super_admin = await db.staff.find_one({"role": "super_admin"})
            
            if super_admin:
                results['super_admin'] = {
                    'exists': True,
                    'email': super_admin.get('email')
                }
            else:
                results['super_admin'] = {'exists': False}
                issues.append("Super admin NO EXISTE - necesario para acceder al sistema")
            
            # 3. STAFF
            all_staff = await db.staff.find({}).to_list(100)
            roles_count = {}
            for s in all_staff:
                role = s.get('role', 'unknown')
                roles_count[role] = roles_count.get(role, 0) + 1
            
            results['staff'] = {
                'total': len(all_staff),
                'by_role': roles_count,
                'ok': len(all_staff) > 0
            }
            
            # 4. VARIABLES DE ENTORNO
            env_vars = {
                'MONGO_URL': bool(os.environ.get('MONGO_URL')),
                'DB_NAME': bool(os.environ.get('DB_NAME')),
                'JWT_SECRET': bool(os.environ.get('JWT_SECRET')),
                'FANBASIS_API_KEY': bool(os.environ.get('FANBASIS_API_KEY')),
                'FANBASIS_WEBHOOK_SECRET': bool(os.environ.get('FANBASIS_WEBHOOK_SECRET')),
                'SUPABASE_URL': bool(os.environ.get('SUPABASE_URL')),
                'SUPABASE_KEY': bool(os.environ.get('SUPABASE_KEY')),
                'SUPABASE_STORAGE_BUCKET': bool(os.environ.get('SUPABASE_STORAGE_BUCKET'))
            }
            
            results['environment'] = env_vars
            
            missing_env = [k for k, v in env_vars.items() if not v]
            if missing_env:
                warnings.extend([f"{var} no configurado" for var in missing_env])
            
            # 5. COLECCIONES
            collections_count = {
                'visa_cases': await db.visa_cases.count_documents({}),
                'visa_stages': await db.visa_stages.count_documents({}),
                'visa_deliverables': await db.visa_deliverables.count_documents({}),
                'visa_client_documents': await db.visa_client_documents.count_documents({}),
                'staff': await db.staff.count_documents({}),
                'users': await db.users.count_documents({}),
                'payment_transactions': await db.payment_transactions.count_documents({})
            }
            
            results['collections'] = collections_count
            
            # RESUMEN
            results['summary'] = {
                'ready_for_production': len(issues) == 0,
                'critical_issues': issues,
                'warnings': warnings,
                'issues_count': len(issues),
                'warnings_count': len(warnings)
            }
            
            return {
                'success': True,
                'results': results,
                'message': 'Sistema listo para producción' if len(issues) == 0 else 'Hay problemas que resolver'
            }
            
        except Exception as e:
            logger.error(f"Error en verificación: {e}")
            raise HTTPException(status_code=500, detail=f"Error en verificación: {str(e)}")
    
    
    @router.post("/create-super-admin")
    async def create_super_admin_endpoint():
        """
        Crea el super admin si no existe
        Endpoint público para setup inicial
        """
        try:
            # Check if super admin exists
            existing = await db.staff.find_one({'role': 'super_admin'})
            
            if existing:
                return {
                    'success': False,
                    'message': f"Super admin ya existe: {existing['email']}",
                    'email': existing['email']
                }
            
            # Create super admin
            super_admin = StaffModel.create_staff(
                email="admin@urpe.com",
                password="urpe2024",
                name="Super Administrator",
                role="super_admin",
                phone="+1234567890"
            )
            
            result = await db.staff.insert_one(super_admin)
            
            logger.info(f"Super admin created: {super_admin['email']}")
            
            return {
                'success': True,
                'message': 'Super Admin creado exitosamente',
                'admin': {
                    'email': super_admin['email'],
                    'name': super_admin['name'],
                    'role': super_admin['role'],
                    'id': str(result.inserted_id)
                },
                'credentials': {
                    'email': 'admin@urpe.com',
                    'password': 'urpe2024',
                    'warning': '⚠️ Cambiar contraseña inmediatamente en producción'
                }
            }
            
        except Exception as e:
            logger.error(f"Error creando super admin: {e}")
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
    
    @router.get("/export-master-case")
    async def export_master_case():
        """
        Exporta el caso maestro y sus datos en formato JSON
        Para migración manual
        """
        try:
            master_case = await db.visa_cases.find_one({"isMasterCase": True})
            
            if not master_case:
                raise HTTPException(status_code=404, detail="Caso maestro no encontrado")
            
            # Convertir ObjectId a string
            master_case['_id'] = str(master_case['_id'])
            
            # Obtener etapas
            stages = await db.visa_stages.find({"caseId": master_case['caseId']}).to_list(1000)
            for stage in stages:
                stage['_id'] = str(stage['_id'])
            
            # Obtener deliverables
            deliverables = await db.visa_deliverables.find({"caseId": master_case['caseId']}).to_list(1000)
            for deliv in deliverables:
                deliv['_id'] = str(deliv['_id'])
            
            # Obtener documentos
            client_docs = await db.visa_client_documents.find({"caseId": master_case['caseId']}).to_list(1000)
            for doc in client_docs:
                doc['_id'] = str(doc['_id'])
            
            return {
                'success': True,
                'data': {
                    'master_case': master_case,
                    'stages': stages,
                    'deliverables': deliverables,
                    'client_documents': client_docs
                },
                'counts': {
                    'stages': len(stages),
                    'deliverables': len(deliverables),
                    'client_documents': len(client_docs)
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error exportando caso maestro: {e}")
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
    
    @router.post("/create-master-case-from-template")
    async def create_master_case_from_template():
        """
        Crea el caso maestro usando datos hardcodeados (template fijo)
        No requiere conexión a desarrollo - datos están embebidos en el código
        """
        try:
            from master_case_data import MASTER_CASE_DATA
            
            logger.info("🚀 Iniciando creación de caso maestro desde template hardcodeado")
            
            master_case = MASTER_CASE_DATA['master_case']
            stages = MASTER_CASE_DATA['stages']
            deliverables = MASTER_CASE_DATA['deliverables']
            client_documents = MASTER_CASE_DATA['client_documents']
            
            results = {
                'master_case': {},
                'stages': {},
                'deliverables': {},
                'client_documents': {}
            }
            
            master_case_id = master_case.get('caseId')
            logger.info(f"📦 Template: {master_case_id}")
            
            # 1. CREAR/ACTUALIZAR CASO MAESTRO
            existing_master = await db.visa_cases.find_one({"isMasterCase": True})
            
            if existing_master:
                # Actualizar el existente
                await db.visa_cases.replace_one(
                    {"isMasterCase": True},
                    master_case
                )
                results['master_case'] = {
                    'action': 'updated',
                    'caseId': master_case_id,
                    'message': f"Caso maestro actualizado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro actualizado")
            else:
                # Crear nuevo
                await db.visa_cases.insert_one(master_case)
                results['master_case'] = {
                    'action': 'created',
                    'caseId': master_case_id,
                    'message': f"Caso maestro creado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro creado")
            
            # 2. CREAR ETAPAS
            if stages:
                # Limpiar etapas existentes
                delete_result = await db.visa_stages.delete_many({"caseId": master_case_id})
                
                # Insertar nuevas etapas
                await db.visa_stages.insert_many(stages)
                results['stages'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(stages),
                    'message': f"Importadas {len(stages)} etapas"
                }
                logger.info(f"✅ Importadas {len(stages)} etapas")
            
            # 3. CREAR DELIVERABLES
            if deliverables:
                # Limpiar deliverables existentes
                delete_result = await db.visa_deliverables.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos deliverables
                await db.visa_deliverables.insert_many(deliverables)
                results['deliverables'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(deliverables),
                    'message': f"Importados {len(deliverables)} deliverables"
                }
                logger.info(f"✅ Importados {len(deliverables)} deliverables")
            
            # 4. CREAR DOCUMENTOS DEL CLIENTE
            if client_documents:
                # Limpiar documentos existentes
                delete_result = await db.visa_client_documents.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos documentos
                await db.visa_client_documents.insert_many(client_documents)
                results['client_documents'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(client_documents),
                    'message': f"Importados {len(client_documents)} documentos"
                }
                logger.info(f"✅ Importados {len(client_documents)} documentos")
            
            logger.info("🎉 Caso maestro creado exitosamente desde template")
            
            return {
                'success': True,
                'message': 'Caso maestro creado exitosamente desde template hardcodeado',
                'source': {
                    'type': 'hardcoded_template',
                    'date': 'December 2024'
                },
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Error creando caso maestro desde template: {e}")
            raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    
    
    @router.post("/migrate-from-dev")
    async def migrate_from_dev():
        """
        Migra el caso maestro directamente desde el ambiente de desarrollo
        Se conecta al MongoDB de desarrollo y copia todo automáticamente
        """
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            
            # URL del MongoDB de desarrollo (configurar en .env)
            DEV_MONGO_URL = os.environ.get('DEV_MONGO_URL')
            DEV_DB_NAME = os.environ.get('DEV_DB_NAME', 'test_database')
            
            if not DEV_MONGO_URL:
                raise HTTPException(
                    status_code=400, 
                    detail="DEV_MONGO_URL no configurado. Agregue la URL de MongoDB de desarrollo en .env"
                )
            
            logger.info(f"🔄 Iniciando migración desde desarrollo: {DEV_DB_NAME}")
            
            # Conectar al MongoDB de desarrollo
            dev_client = AsyncIOMotorClient(DEV_MONGO_URL)
            dev_db = dev_client[DEV_DB_NAME]
            
            # Verificar conexión a desarrollo
            try:
                await dev_db.command('ping')
                logger.info("✅ Conexión a desarrollo exitosa")
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"No se pudo conectar al MongoDB de desarrollo: {str(e)}"
                )
            
            results = {
                'master_case': {},
                'stages': {},
                'deliverables': {},
                'client_documents': {}
            }
            
            # 1. COPIAR CASO MAESTRO
            logger.info("📦 Copiando caso maestro...")
            master_case = await dev_db.visa_cases.find_one({"isMasterCase": True}, {"_id": 0})
            
            if not master_case:
                raise HTTPException(
                    status_code=404,
                    detail="No se encontró caso maestro en el ambiente de desarrollo"
                )
            
            master_case_id = master_case.get('caseId')
            logger.info(f"   Caso maestro encontrado: {master_case_id}")
            
            # Verificar si ya existe en producción (ambiente actual)
            existing_master = await db.visa_cases.find_one({"isMasterCase": True})
            
            if existing_master:
                # Actualizar el existente
                await db.visa_cases.replace_one(
                    {"isMasterCase": True},
                    master_case
                )
                results['master_case'] = {
                    'action': 'updated',
                    'caseId': master_case_id,
                    'message': f"Caso maestro actualizado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro actualizado")
            else:
                # Crear nuevo
                await db.visa_cases.insert_one(master_case)
                results['master_case'] = {
                    'action': 'created',
                    'caseId': master_case_id,
                    'message': f"Caso maestro creado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro creado")
            
            # 2. COPIAR ETAPAS
            logger.info("📋 Copiando etapas del caso maestro...")
            stages = await dev_db.visa_stages.find({"caseId": master_case_id}, {"_id": 0}).to_list(1000)
            
            if stages:
                # Limpiar etapas existentes
                delete_result = await db.visa_stages.delete_many({"caseId": master_case_id})
                
                # Insertar nuevas etapas
                await db.visa_stages.insert_many(stages)
                results['stages'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(stages),
                    'message': f"Importadas {len(stages)} etapas"
                }
                logger.info(f"✅ Importadas {len(stages)} etapas (eliminadas {delete_result.deleted_count} antiguas)")
            else:
                results['stages'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay etapas para importar"
                }
            
            # 3. COPIAR DELIVERABLES
            logger.info("📦 Copiando deliverables del caso maestro...")
            deliverables = await dev_db.visa_deliverables.find({"caseId": master_case_id}, {"_id": 0}).to_list(1000)
            
            if deliverables:
                # Limpiar deliverables existentes
                delete_result = await db.visa_deliverables.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos deliverables
                await db.visa_deliverables.insert_many(deliverables)
                results['deliverables'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(deliverables),
                    'message': f"Importados {len(deliverables)} deliverables"
                }
                logger.info(f"✅ Importados {len(deliverables)} deliverables (eliminados {delete_result.deleted_count} antiguos)")
            else:
                results['deliverables'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay deliverables para importar"
                }
            
            # 4. COPIAR DOCUMENTOS DEL CLIENTE
            logger.info("📄 Copiando documentos requeridos del caso maestro...")
            client_documents = await dev_db.visa_client_documents.find({"caseId": master_case_id}, {"_id": 0}).to_list(1000)
            
            if client_documents:
                # Limpiar documentos existentes
                delete_result = await db.visa_client_documents.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos documentos
                await db.visa_client_documents.insert_many(client_documents)
                results['client_documents'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(client_documents),
                    'message': f"Importados {len(client_documents)} documentos"
                }
                logger.info(f"✅ Importados {len(client_documents)} documentos (eliminados {delete_result.deleted_count} antiguos)")
            else:
                results['client_documents'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay documentos para importar"
                }
            
            # Cerrar conexión a desarrollo
            dev_client.close()
            logger.info("🎉 Migración completada exitosamente")
            
            return {
                'success': True,
                'message': 'Caso maestro migrado exitosamente desde desarrollo',
                'source': {
                    'environment': 'development',
                    'database': DEV_DB_NAME
                },
                'results': results
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error en migración automática: {e}")
            raise HTTPException(status_code=500, detail=f"Error en migración: {str(e)}")
    
    
    @router.post("/import-master-case")
    async def import_master_case(data: dict):
        """
        Importa un caso maestro completo con etapas, deliverables y documentos
        Usa el JSON exportado de /export-master-case
        """
        try:
            # Validar que el JSON tenga la estructura correcta
            if 'data' not in data:
                raise HTTPException(status_code=400, detail="Formato inválido. Se espera {data: {...}}")
            
            case_data = data['data']
            
            if 'master_case' not in case_data:
                raise HTTPException(status_code=400, detail="Falta 'master_case' en los datos")
            
            master_case = case_data['master_case']
            stages = case_data.get('stages', [])
            deliverables = case_data.get('deliverables', [])
            client_documents = case_data.get('client_documents', [])
            
            # Verificar si ya existe un caso maestro
            existing_master = await db.visa_cases.find_one({"isMasterCase": True})
            
            results = {
                'master_case': {},
                'stages': {},
                'deliverables': {},
                'client_documents': {}
            }
            
            # 1. IMPORTAR CASO MAESTRO
            master_case_id = master_case.get('caseId')
            
            if existing_master:
                # Actualizar el existente
                await db.visa_cases.replace_one(
                    {"isMasterCase": True},
                    master_case
                )
                results['master_case'] = {
                    'action': 'updated',
                    'caseId': master_case_id,
                    'message': f"Caso maestro actualizado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro actualizado: {master_case_id}")
            else:
                # Crear nuevo
                await db.visa_cases.insert_one(master_case)
                results['master_case'] = {
                    'action': 'created',
                    'caseId': master_case_id,
                    'message': f"Caso maestro creado: {master_case_id}"
                }
                logger.info(f"✅ Caso maestro creado: {master_case_id}")
            
            # 2. IMPORTAR ETAPAS
            if stages:
                # Limpiar etapas existentes del caso maestro
                delete_result = await db.visa_stages.delete_many({"caseId": master_case_id})
                
                # Insertar nuevas etapas
                await db.visa_stages.insert_many(stages)
                results['stages'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(stages),
                    'message': f"Importadas {len(stages)} etapas"
                }
                logger.info(f"✅ Importadas {len(stages)} etapas (eliminadas {delete_result.deleted_count} antiguas)")
            else:
                results['stages'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay etapas para importar"
                }
            
            # 3. IMPORTAR DELIVERABLES
            if deliverables:
                # Limpiar deliverables existentes del caso maestro
                delete_result = await db.visa_deliverables.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos deliverables
                await db.visa_deliverables.insert_many(deliverables)
                results['deliverables'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(deliverables),
                    'message': f"Importados {len(deliverables)} deliverables"
                }
                logger.info(f"✅ Importados {len(deliverables)} deliverables (eliminados {delete_result.deleted_count} antiguos)")
            else:
                results['deliverables'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay deliverables para importar"
                }
            
            # 4. IMPORTAR DOCUMENTOS DEL CLIENTE
            if client_documents:
                # Limpiar documentos existentes del caso maestro
                delete_result = await db.visa_client_documents.delete_many({"caseId": master_case_id})
                
                # Insertar nuevos documentos
                await db.visa_client_documents.insert_many(client_documents)
                results['client_documents'] = {
                    'deleted': delete_result.deleted_count,
                    'imported': len(client_documents),
                    'message': f"Importados {len(client_documents)} documentos"
                }
                logger.info(f"✅ Importados {len(client_documents)} documentos (eliminados {delete_result.deleted_count} antiguos)")
            else:
                results['client_documents'] = {
                    'deleted': 0,
                    'imported': 0,
                    'message': "No hay documentos para importar"
                }
            
            return {
                'success': True,
                'message': 'Caso maestro importado exitosamente',
                'results': results
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error importando caso maestro: {e}")
            raise HTTPException(status_code=500, detail=f"Error importando caso maestro: {str(e)}")
    
    
    @router.get("/health")
    async def health_check():
        """
        Health check del sistema
        """
        try:
            # Verificar conexión a MongoDB
            await db.command('ping')
            
            # Contar documentos críticos
            master_case_count = await db.visa_cases.count_documents({"isMasterCase": True})
            super_admin_count = await db.staff.count_documents({"role": "super_admin"})
            
            return {
                'success': True,
                'status': 'healthy',
                'database': 'connected',
                'master_case': master_case_count > 0,
                'super_admin': super_admin_count > 0,
                'ready': master_case_count > 0 and super_admin_count > 0
            }
            
        except Exception as e:
            return {
                'success': False,
                'status': 'unhealthy',
                'error': str(e)
            }
    
    return router
