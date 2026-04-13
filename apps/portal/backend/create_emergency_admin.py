#!/usr/bin/env python3
"""
Script para crear un admin de emergencia
Ejecutar en el servidor de producción cuando se pierde el acceso admin
"""

import requests
import os
import sys

# Configuración
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8001')
EMERGENCY_KEY = os.getenv('EMERGENCY_ADMIN_KEY', 'URPE-EMERGENCY-2024-SECURE')

def create_emergency_admin():
    """Crea un admin de emergencia de forma interactiva"""
    
    print("=" * 60)
    print("🚨 CREACIÓN DE ADMIN DE EMERGENCIA")
    print("=" * 60)
    print()
    
    # Solicitar datos
    print("Por favor, ingresa los datos del nuevo admin:")
    print()
    
    email = input("Email: ").strip()
    if not email:
        print("❌ Error: El email no puede estar vacío")
        sys.exit(1)
    
    name = input("Nombre completo: ").strip()
    if not name:
        print("❌ Error: El nombre no puede estar vacío")
        sys.exit(1)
    
    password = input("Password (min 8 caracteres): ").strip()
    if len(password) < 8:
        print("❌ Error: La contraseña debe tener al menos 8 caracteres")
        sys.exit(1)
    
    print()
    print("Clave secreta de emergencia:")
    print(f"Por defecto: URPE-EMERGENCY-2024-SECURE")
    print(f"Variable de entorno EMERGENCY_ADMIN_KEY: {EMERGENCY_KEY}")
    secret_key = input("Clave secreta [presiona Enter para usar por defecto]: ").strip()
    if not secret_key:
        secret_key = EMERGENCY_KEY
    
    print()
    print("-" * 60)
    print("📋 RESUMEN:")
    print(f"   Email: {email}")
    print(f"   Nombre: {name}")
    print(f"   Backend URL: {BACKEND_URL}")
    print("-" * 60)
    print()
    
    confirm = input("¿Confirmas la creación? (si/no): ").strip().lower()
    if confirm not in ['si', 's', 'yes', 'y']:
        print("❌ Operación cancelada")
        sys.exit(0)
    
    print()
    print("⏳ Creando admin de emergencia...")
    
    try:
        # Hacer la petición
        response = requests.post(
            f"{BACKEND_URL}/api/admin/auth/emergency-create",
            json={
                "secret_key": secret_key,
                "email": email,
                "password": password,
                "name": name
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print()
            print("=" * 60)
            print("✅ ¡ADMIN CREADO EXITOSAMENTE!")
            print("=" * 60)
            print()
            print("📋 Información del admin:")
            print(f"   ID: {data['admin']['id']}")
            print(f"   Email: {data['admin']['email']}")
            print(f"   Nombre: {data['admin']['name']}")
            print(f"   Rol: {data['admin']['role']}")
            print()
            print("🔑 CREDENCIALES PARA INICIAR SESIÓN:")
            print(f"   Email: {email}")
            print(f"   Password: {password}")
            print()
            print("⚠️  IMPORTANTE:")
            print("   1. Guarda estas credenciales en un lugar seguro")
            print("   2. Inicia sesión inmediatamente")
            print("   3. Cambia la contraseña desde el panel de admin")
            print()
            
        elif response.status_code == 403:
            print()
            print("❌ ERROR: Clave secreta incorrecta")
            print(f"   Verifica la variable EMERGENCY_ADMIN_KEY en el servidor")
            print(f"   Clave usada: {secret_key[:10]}...")
            
        elif response.status_code == 400:
            print()
            print("❌ ERROR: Ya existe un admin con ese email")
            print("   Usa un email diferente o elimina el admin existente")
            
        else:
            print()
            print(f"❌ ERROR: {response.status_code}")
            print(f"   Detalle: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print()
        print("❌ ERROR: No se puede conectar al backend")
        print(f"   URL: {BACKEND_URL}")
        print("   Verifica que el backend esté corriendo:")
        print("   sudo supervisorctl status backend")
        
    except requests.exceptions.Timeout:
        print()
        print("❌ ERROR: Timeout en la petición")
        print("   El servidor está tardando demasiado en responder")
        
    except Exception as e:
        print()
        print(f"❌ ERROR INESPERADO: {str(e)}")

if __name__ == "__main__":
    try:
        create_emergency_admin()
    except KeyboardInterrupt:
        print()
        print("❌ Operación cancelada por el usuario")
        sys.exit(0)
