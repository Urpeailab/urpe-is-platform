#!/usr/bin/env python3
"""
Script de diagnóstico para verificar inconsistencias en los libros
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def diagnose_books():
    # Conectar a MongoDB
    mongo_url = os.environ.get('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client.docgen_translator
    
    print("=" * 60)
    print("DIAGNÓSTICO DE LIBROS")
    print("=" * 60)
    
    # Obtener todos los clientes
    clients = await db.clients.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    
    print(f"\n📊 Total de clientes: {len(clients)}")
    
    for client in clients:
        client_id = client['id']
        client_name = client['name']
        
        # Contar libros según las estadísticas (como lo hace el backend)
        count_in_progress = await db.books_in_progress.count_documents({"client_id": client_id})
        count_completed = await db.books.count_documents({"client_id": client_id})
        total_count = count_in_progress + count_completed
        
        if total_count > 0:
            print(f"\n{'='*60}")
            print(f"👤 Cliente: {client_name} (ID: {client_id})")
            print(f"   Contador en estadísticas: {count_in_progress} en progreso + {count_completed} completados = {total_count} total")
            
            # Listar libros reales en books_in_progress
            books_in_progress = await db.books_in_progress.find(
                {"client_id": client_id},
                {"_id": 0, "id": 1, "title": 1, "status": 1}
            ).to_list(1000)
            
            print(f"\n   📚 Libros en books_in_progress ({len(books_in_progress)}):")
            for book in books_in_progress:
                print(f"      - {book.get('title', 'Sin título')} (status: {book.get('status', 'N/A')}, id: {book.get('id', 'N/A')})")
            
            # Listar libros completados
            books_completed = await db.books.find(
                {"client_id": client_id},
                {"_id": 0, "id": 1, "title": 1}
            ).to_list(1000)
            
            print(f"\n   ✅ Libros completados ({len(books_completed)}):")
            for book in books_completed:
                print(f"      - {book.get('title', 'Sin título')} (id: {book.get('id', 'N/A')})")
            
            # Verificar si hay inconsistencia
            if total_count != (len(books_in_progress) + len(books_completed)):
                print(f"\n   ⚠️  INCONSISTENCIA DETECTADA:")
                print(f"      El contador dice {total_count} pero se encontraron {len(books_in_progress) + len(books_completed)} libros")
    
    # Buscar libros huérfanos (sin client_id)
    print(f"\n{'='*60}")
    print("🔍 Buscando libros sin client_id...")
    
    orphan_in_progress = await db.books_in_progress.find(
        {"client_id": None},
        {"_id": 0, "id": 1, "title": 1, "status": 1, "user_id": 1}
    ).to_list(1000)
    
    orphan_completed = await db.books.find(
        {"client_id": None},
        {"_id": 0, "id": 1, "title": 1, "user_id": 1}
    ).to_list(1000)
    
    print(f"\n   📚 Libros en progreso sin client_id: {len(orphan_in_progress)}")
    for book in orphan_in_progress:
        print(f"      - {book.get('title', 'Sin título')} (status: {book.get('status', 'N/A')}, user_id: {book.get('user_id', 'N/A')})")
    
    print(f"\n   ✅ Libros completados sin client_id: {len(orphan_completed)}")
    for book in orphan_completed:
        print(f"      - {book.get('title', 'Sin título')} (user_id: {book.get('user_id', 'N/A')})")
    
    print(f"\n{'='*60}")
    print("✅ Diagnóstico completado")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(diagnose_books())
