#!/usr/bin/env python3
"""
Script to seed advisors
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from content_models import AdvisorModel

load_dotenv()

async def seed_advisors():
    """Seed some example advisors"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Get super admin ID
    super_admin = await db.staff.find_one({'role': 'super_admin'})
    if not super_admin:
        print("❌ Super admin not found. Run create_super_admin.py first")
        return
    
    # Check if advisors already exist
    existing_count = await db.advisors.count_documents({})
    if existing_count > 0:
        print(f"✅ {existing_count} advisors already exist")
        client.close()
        return
    
    # Sample advisors
    advisors_data = [
        {
            'name': 'Gigliola Bocanegra',
            'email': 'gigliola@urpe.com',
            'phone': '+1-555-0001',
            'title': 'Founder & CEO',
            'bio': {
                'en': 'Immigration expert with 15+ years of experience. Specialized in EB-2 NIW cases with 95% success rate.',
                'es': 'Experta en inmigración con más de 15 años de experiencia. Especializada en casos EB-2 NIW con 95% de tasa de éxito.'
            },
            'specialties': ['EB-2 NIW', 'Green Card', 'Business Immigration'],
            'years_experience': 15,
            'photo': 'https://i.pravatar.cc/150?img=1'
        },
        {
            'name': 'Carlos Rodriguez',
            'email': 'carlos@urpe.com',
            'phone': '+1-555-0002',
            'title': 'Senior Immigration Advisor',
            'bio': {
                'en': 'Expert in family immigration and asylum cases. Helped over 500 families reunite.',
                'es': 'Experto en inmigración familiar y casos de asilo. Ha ayudado a más de 500 familias a reunirse.'
            },
            'specialties': ['Family Immigration', 'Asylum', 'DACA'],
            'years_experience': 10,
            'photo': 'https://i.pravatar.cc/150?img=12'
        },
        {
            'name': 'Maria Garcia',
            'email': 'maria@urpe.com',
            'phone': '+1-555-0003',
            'title': 'Immigration Consultant',
            'bio': {
                'en': 'Specializes in employment-based immigration. Former USCIS officer with insider knowledge.',
                'es': 'Especialista en inmigración basada en empleo. Ex oficial de USCIS con conocimiento interno.'
            },
            'specialties': ['EB-1', 'EB-2', 'O-1 Visa'],
            'years_experience': 8,
            'photo': 'https://i.pravatar.cc/150?img=5'
        }
    ]
    
    created = []
    for advisor_data in advisors_data:
        advisor = AdvisorModel.create_advisor(
            name=advisor_data['name'],
            email=advisor_data['email'],
            phone=advisor_data['phone'],
            title=advisor_data['title'],
            bio=advisor_data['bio'],
            specialties=advisor_data['specialties'],
            years_experience=advisor_data['years_experience'],
            created_by=super_admin['_id'],
            photo=advisor_data['photo']
        )
        
        await db.advisors.insert_one(advisor)
        created.append(advisor)
        print(f"✅ Created advisor: {advisor['name']}")
    
    print(f"\n✅ Successfully seeded {len(created)} advisors!")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_advisors())
