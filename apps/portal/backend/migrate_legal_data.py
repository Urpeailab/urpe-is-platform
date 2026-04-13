"""
One-time script to migrate legal library data to MongoDB
Run this once to populate the initial legal library data
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/visa_app')

# Data from the frontend
laws = [
    {
        "id": "law-001",
        "title": "INA § 203(b)(2) - EB-2 Employment-Based Immigration",
        "category": "Employment-Based",
        "description": "Employment-Based Immigration: Second Preference category for professionals with advanced degrees or exceptional ability",
        "reference": "8 U.S.C. § 1153(b)(2)",
        "year": "1990",
        "popular": True
    },
    {
        "id": "law-002",
        "title": "INA § 208 - Asylum",
        "category": "Humanitarian",
        "description": "Asylum procedures for refugees fleeing persecution",
        "reference": "8 U.S.C. § 1158",
        "year": "1980",
        "popular": True
    },
    {
        "id": "law-003",
        "title": "INA § 201 - Family-Sponsored Immigration",
        "category": "Family-Based",
        "description": "Numerical limitations on family-sponsored immigration",
        "reference": "8 U.S.C. § 1151",
        "year": "1965",
        "popular": True
    },
    {
        "id": "law-004",
        "title": "INA § 101(a)(15)(H) - H-1B Specialty Occupation",
        "category": "Non-Immigrant",
        "description": "Nonimmigrant visa category for specialty occupation workers",
        "reference": "8 U.S.C. § 1101(a)(15)(H)",
        "year": "1990",
        "popular": False
    },
    {
        "id": "law-005",
        "title": "INA § 245 - Adjustment of Status",
        "category": "Procedures",
        "description": "Adjustment of status to lawful permanent resident",
        "reference": "8 U.S.C. § 1255",
        "year": "1952",
        "popular": True
    }
]

manuals = [
    {
        "id": "manual-001",
        "title": "USCIS Policy Manual - Volume 6: Employment-Based",
        "category": "Employment",
        "description": "Comprehensive policy guidance for employment-based petitions",
        "chapters": 12,
        "lastUpdated": "2024",
        "url": "https://www.uscis.gov/policy-manual/volume-6",
        "popular": True
    },
    {
        "id": "manual-002",
        "title": "AFM Chapter 22 - Asylum",
        "category": "Asylum",
        "description": "Adjudicators Field Manual chapter on asylum procedures",
        "chapters": 8,
        "lastUpdated": "2023",
        "url": "https://www.uscis.gov/laws-and-policy/other-resources/adjudicators-field-manual",
        "popular": True
    },
    {
        "id": "manual-003",
        "title": "USCIS Policy Manual - Volume 12: Citizenship",
        "category": "Citizenship",
        "description": "Policy guidance on naturalization and citizenship",
        "chapters": 15,
        "lastUpdated": "2024",
        "url": "https://www.uscis.gov/policy-manual/volume-12",
        "popular": False
    },
    {
        "id": "manual-004",
        "title": "I-140 Adjudication Guide",
        "category": "Forms",
        "description": "Internal guidance for adjudicating I-140 petitions",
        "chapters": 6,
        "lastUpdated": "2024",
        "url": "https://www.uscis.gov",
        "popular": True
    }
]

glossary = [
    {
        "id": "term-001",
        "term": "National Interest Waiver (NIW)",
        "definition": "A waiver of the job offer requirement for certain EB-2 immigrants whose work benefits the United States",
        "relatedLaw": "INA § 203(b)(2)",
        "category": "EB-2"
    },
    {
        "id": "term-002",
        "term": "Adjustment of Status (AOS)",
        "definition": "The process of applying for lawful permanent resident status while in the United States",
        "relatedLaw": "INA § 245",
        "category": "Procedures"
    },
    {
        "id": "term-003",
        "term": "Priority Date",
        "definition": "The date that establishes a person's place in line for an immigrant visa",
        "relatedLaw": "INA § 203",
        "category": "General"
    },
    {
        "id": "term-004",
        "term": "Labor Certification (PERM)",
        "definition": "DOL certification that there are no qualified U.S. workers for a position",
        "relatedLaw": "INA § 212(a)(5)(A)",
        "category": "Employment"
    },
    {
        "id": "term-005",
        "term": "Persecution",
        "definition": "Harm or suffering inflicted on an individual due to race, religion, nationality, membership in a particular social group, or political opinion",
        "relatedLaw": "INA § 208",
        "category": "Asylum"
    },
    {
        "id": "term-006",
        "term": "Immediate Relative",
        "definition": "Spouse, unmarried children under 21, or parents of U.S. citizens",
        "relatedLaw": "INA § 201(b)(2)(A)(i)",
        "category": "Family"
    }
]

case_law = [
    {
        "id": "case-001",
        "title": "Matter of Dhanasar",
        "citation": "26 I&N Dec. 884 (AAO 2016)",
        "court": "AAO",
        "year": "2016",
        "category": "EB-2 NIW",
        "summary": "Established new three-prong framework for evaluating National Interest Waiver petitions",
        "impact": "Replaced the Matter of New York State Department of Transportation framework, making NIW criteria more flexible",
        "landmark": True
    },
    {
        "id": "case-002",
        "title": "Kazarian v. USCIS",
        "citation": "596 F.3d 1115 (9th Cir. 2010)",
        "court": "9th Circuit",
        "year": "2010",
        "category": "EB-1",
        "summary": "Established two-step analysis for evaluating EB-1A extraordinary ability petitions",
        "impact": "USCIS must first determine if evidence meets regulatory criteria, then evaluate totality of evidence",
        "landmark": True
    },
    {
        "id": "case-003",
        "title": "Matter of Acosta",
        "citation": "19 I&N Dec. 211 (BIA 1985)",
        "court": "BIA",
        "year": "1985",
        "category": "Asylum",
        "summary": "Defined 'particular social group' for asylum purposes",
        "impact": "Established that persecution must be on account of membership in a particular social group with shared immutable characteristics",
        "landmark": True
    }
]


async def migrate_data():
    """Migrate all legal library data to MongoDB"""
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.get_database()
    
    try:
        # Clear existing data
        print("\nClearing existing data...")
        await db.legal_laws.delete_many({})
        await db.legal_manuals.delete_many({})
        await db.legal_glossary.delete_many({})
        await db.legal_caselaw.delete_many({})
        
        # Insert laws
        print(f"\nInserting {len(laws)} laws...")
        if laws:
            await db.legal_laws.insert_many(laws)
            print(f"✓ {len(laws)} laws inserted")
        
        # Insert manuals
        print(f"\nInserting {len(manuals)} manuals...")
        if manuals:
            await db.legal_manuals.insert_many(manuals)
            print(f"✓ {len(manuals)} manuals inserted")
        
        # Insert glossary
        print(f"\nInserting {len(glossary)} glossary terms...")
        if glossary:
            await db.legal_glossary.insert_many(glossary)
            print(f"✓ {len(glossary)} glossary terms inserted")
        
        # Insert case law
        print(f"\nInserting {len(case_law)} case laws...")
        if case_law:
            await db.legal_caselaw.insert_many(case_law)
            print(f"✓ {len(case_law)} case laws inserted")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(migrate_data())
