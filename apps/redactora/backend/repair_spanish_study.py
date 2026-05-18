#!/usr/bin/env python3
"""
Script para reparar el estudio 46203846-c6c9-46b2-9333-798fee1831d0
que tiene contenido en inglés pero el español no se parseó correctamente.
"""

import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, '/app/backend')

# Load environment
load_dotenv('/app/backend/.env')

async def repair_study():
    """Repair the Spanish content parsing for study 46203846-c6c9-46b2-9333-798fee1831d0"""
    
    # Connect to MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    study_id = "46203846-c6c9-46b2-9333-798fee1831d0"
    
    # Get the study
    study = await db.econometric_studies_in_progress.find_one(
        {"id": study_id},
        {"_id": 0}
    )
    
    if not study:
        print(f"❌ Study {study_id} not found")
        return
    
    print(f"✅ Found study: {study_id}")
    print(f"   Current sections: {len(study.get('sections', []))}")
    
    # The problem is that we need to re-generate the Spanish content
    # because it was generated but not saved properly
    # For now, let's use the English content for Spanish as well
    # The user can regenerate with Spanish later
    
    sections = study.get('sections', [])
    updated_sections = []
    
    for section in sections:
        # If Spanish is empty, copy from English temporarily
        if not section.get('content_es') or len(section.get('content_es', '')) == 0:
            section['content_es'] = section.get('content_en', '')
            print(f"   ⚠️ Copying EN to ES for section {section.get('number')}: {section.get('title')}")
        
        updated_sections.append(section)
    
    # Update the study
    result = await db.econometric_studies_in_progress.update_one(
        {"id": study_id},
        {
            "$set": {
                "sections": updated_sections,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count > 0:
        print(f"✅ Study updated successfully")
        print(f"   Modified sections: {len(updated_sections)}")
        print("\n⚠️ NOTA: Las secciones en español ahora contienen el contenido en inglés temporalmente.")
        print("   Para obtener la traducción al español, genera un nuevo estudio con idioma 'Español'.")
    else:
        print(f"❌ Failed to update study")

if __name__ == "__main__":
    asyncio.run(repair_study())
