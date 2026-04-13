"""
Migration script to fix currentStage field in all existing visa cases.
This script updates the currentStage field based on the highest unlocked/paid stage.

Usage: python fix_current_stage_migration.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import os
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def fix_current_stage_for_case(case_id: str, case_name: str = ""):
    """
    Fix the currentStage field for a single case.
    """
    try:
        # Get all stages for this case, sorted by stageNumber
        stages = await db.visa_stages.find(
            {"caseId": case_id}
        ).sort("stageNumber", 1).to_list(100)
        
        if not stages:
            logger.warning(f"❌ No stages found for case {case_id} ({case_name})")
            return None
        
        # Find the highest stage number that is unlocked or paid
        current_stage_number = 1  # Default to stage 1
        old_current_stage = None
        
        for stage in stages:
            stage_status = stage.get('status', 'locked')
            is_paid = stage.get('isPaid', False)
            stage_number = stage.get('stageNumber', 1)
            
            # If stage is unlocked or paid, update current stage
            if stage_status == 'unlocked' or is_paid:
                current_stage_number = stage_number
            else:
                # Stop at the first locked and unpaid stage
                break
        
        # Get the old currentStage value
        case = await db.visa_cases.find_one({"caseId": case_id})
        if case:
            old_current_stage = case.get('currentStage', 1)
        
        # Only update if there's a change
        if old_current_stage != current_stage_number:
            # Update the visa_cases collection
            result = await db.visa_cases.update_one(
                {"caseId": case_id},
                {"$set": {"currentStage": current_stage_number}}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Updated case {case_id} ({case_name}): {old_current_stage} → {current_stage_number}")
                return {
                    "case_id": case_id,
                    "case_name": case_name,
                    "old_stage": old_current_stage,
                    "new_stage": current_stage_number
                }
        else:
            logger.debug(f"✓ Case {case_id} ({case_name}) already correct at stage {current_stage_number}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error fixing case {case_id}: {str(e)}")
        return None


async def main():
    """
    Main migration function.
    """
    logger.info("=" * 60)
    logger.info("🔧 STARTING CURRENTSTAGE MIGRATION")
    logger.info("=" * 60)
    
    try:
        # Get all visa cases (excluding master cases)
        all_cases = await db.visa_cases.find({
            "isMasterCase": {"$ne": True}
        }).to_list(None)
        
        logger.info(f"📊 Found {len(all_cases)} cases to check")
        
        updated_cases = []
        skipped_count = 0
        error_count = 0
        
        # Process each case
        for case in all_cases:
            case_id = case.get('caseId') or case.get('id')
            case_name = f"{case.get('visaType', 'Unknown')} - User: {case.get('userId', 'Unknown')}"
            
            result = await fix_current_stage_for_case(case_id, case_name)
            
            if result:
                updated_cases.append(result)
            else:
                skipped_count += 1
        
        # Summary
        logger.info("=" * 60)
        logger.info("📊 MIGRATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Total cases checked: {len(all_cases)}")
        logger.info(f"Cases updated: {len(updated_cases)}")
        logger.info(f"Cases skipped (already correct): {skipped_count}")
        logger.info(f"Errors: {error_count}")
        
        if updated_cases:
            logger.info("\n📝 UPDATED CASES:")
            for update in updated_cases:
                logger.info(f"  - {update['case_id']}: Stage {update['old_stage']} → {update['new_stage']}")
        
        logger.info("=" * 60)
        logger.info("✅ MIGRATION COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        raise
    finally:
        # Close MongoDB connection
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
