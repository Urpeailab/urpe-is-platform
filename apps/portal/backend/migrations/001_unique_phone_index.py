"""
Migration: Create unique index on phone field in users collection
Date: 2024-12-16
Description: 
  - Identifies and handles duplicate phone numbers
  - Creates a unique index on the phone field
  - Prevents future duplicate phone registrations
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')


async def find_duplicates(db):
    """Find all duplicate phone numbers"""
    pipeline = [
        {'$match': {'phone': {'$ne': None, '$ne': '', '$exists': True}}},
        {'$group': {
            '_id': '$phone',
            'count': {'$sum': 1},
            'users': {'$push': {'_id': '$_id', 'id': '$id', 'email': '$email', 'name': '$name', 'createdAt': '$createdAt'}}
        }},
        {'$match': {'count': {'$gt': 1}}},
        {'$sort': {'count': -1}}
    ]
    
    duplicates = await db.users.aggregate(pipeline).to_list(1000)
    return duplicates


async def handle_duplicates(db, duplicates, dry_run=True):
    """
    Handle duplicate phone numbers by keeping the oldest user and clearing 
    phone from newer duplicates (appending _duplicate_N suffix)
    """
    changes = []
    
    for dup in duplicates:
        phone = dup['_id']
        users = dup['users']
        
        # Sort by createdAt (oldest first), handle missing dates
        def get_date(u):
            created = u.get('createdAt')
            if created:
                if isinstance(created, str):
                    try:
                        dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                        # Make timezone-naive for comparison
                        return dt.replace(tzinfo=None) if dt.tzinfo else dt
                    except:
                        return datetime.min
                # If it's a datetime object, make it naive
                if hasattr(created, 'tzinfo') and created.tzinfo:
                    return created.replace(tzinfo=None)
                return created
            return datetime.min
        
        users_sorted = sorted(users, key=get_date)
        
        # Keep the first (oldest) user, modify the rest
        keep_user = users_sorted[0]
        duplicate_users = users_sorted[1:]
        
        print(f"\n📱 Phone: {phone}")
        print(f"  ✅ Keep: {keep_user.get('email')} (ID: {keep_user.get('_id')})")
        
        for idx, user in enumerate(duplicate_users, 1):
            new_phone = f"{phone}_duplicate_{idx}"
            print(f"  ❌ Modify: {user.get('email')} (ID: {user.get('_id')}) -> phone: {new_phone}")
            
            changes.append({
                'user_id': user['_id'],
                'old_phone': phone,
                'new_phone': new_phone,
                'email': user.get('email')
            })
            
            if not dry_run:
                await db.users.update_one(
                    {'_id': user['_id']},
                    {'$set': {
                        'phone': new_phone,
                        'phone_duplicate_original': phone,
                        'updatedAt': datetime.now(timezone.utc).isoformat()
                    }}
                )
    
    return changes


async def handle_empty_phones(db):
    """Convert empty string phones to null so they don't conflict with unique index"""
    # Find users with empty phone strings
    empty_phone_users = await db.users.find({'phone': ''}).to_list(1000)
    
    if empty_phone_users:
        print(f"\n📋 Found {len(empty_phone_users)} users with empty phone strings")
        
        # Update all empty phones to None/null
        result = await db.users.update_many(
            {'phone': ''},
            {'$set': {'phone': None}}
        )
        print(f"✅ Converted {result.modified_count} empty phones to null")
    
    return len(empty_phone_users)


async def create_unique_index(db):
    """Create unique sparse index on phone field"""
    try:
        # First handle empty phone strings
        await handle_empty_phones(db)
        
        # Drop existing phone index if any
        existing_indexes = await db.users.index_information()
        for name in existing_indexes:
            if 'phone' in name:
                print(f"🗑️  Dropping existing phone index: {name}")
                await db.users.drop_index(name)
        
        # Create unique partial index
        # partialFilterExpression ensures only non-null, non-empty phones are indexed
        # This allows multiple users with null/missing phone
        result = await db.users.create_index(
            [('phone', 1)],
            unique=True,
            name='phone_unique_idx',
            partialFilterExpression={'phone': {'$type': 'string', '$gt': ''}}
        )
        print(f"✅ Created unique index: {result}")
        return True
        
    except Exception as e:
        print(f"❌ Error creating index: {e}")
        return False


async def verify_index(db):
    """Verify the unique index exists"""
    indexes = await db.users.index_information()
    
    print("\n=== Current Indexes ===")
    for name, info in indexes.items():
        unique = "UNIQUE" if info.get('unique') else ""
        sparse = "SPARSE" if info.get('sparse') else ""
        print(f"  {name}: {info.get('key')} {unique} {sparse}")
    
    return 'phone_unique_idx' in indexes


async def run_migration(dry_run=True):
    """Run the complete migration"""
    print("=" * 60)
    print("MIGRATION: Unique Phone Index")
    print(f"Mode: {'DRY RUN' if dry_run else 'EXECUTE'}")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Step 1: Find duplicates
        print("\n📋 Step 1: Finding duplicate phone numbers...")
        duplicates = await find_duplicates(db)
        
        if duplicates:
            print(f"\n⚠️  Found {len(duplicates)} phone numbers with duplicates:")
            total_affected = sum(d['count'] - 1 for d in duplicates)
            print(f"   Total users to modify: {total_affected}")
            
            # Step 2: Handle duplicates
            print("\n📋 Step 2: Handling duplicates...")
            changes = await handle_duplicates(db, duplicates, dry_run=dry_run)
            
            if dry_run:
                print(f"\n⚠️  DRY RUN: {len(changes)} users would be modified")
                print("   Run with --execute to apply changes")
            else:
                print(f"\n✅ Modified {len(changes)} users")
        else:
            print("\n✅ No duplicate phone numbers found")
        
        # Step 3: Create unique index (only if not dry run)
        if not dry_run:
            print("\n📋 Step 3: Creating unique index...")
            success = await create_unique_index(db)
            
            if not success:
                print("❌ Migration failed: Could not create index")
                return False
        else:
            print("\n📋 Step 3: Would create unique index (skipped in dry run)")
        
        # Step 4: Verify
        print("\n📋 Step 4: Verification...")
        if not dry_run:
            has_index = await verify_index(db)
            if has_index:
                print("\n✅ Migration completed successfully!")
            else:
                print("\n⚠️  Warning: Index verification failed")
        else:
            await verify_index(db)
            print("\n⚠️  DRY RUN complete. Run with --execute to apply changes.")
        
        return True
        
    finally:
        client.close()


async def rollback_migration():
    """Rollback the migration by removing the unique index"""
    print("=" * 60)
    print("ROLLBACK: Removing Unique Phone Index")
    print("=" * 60)
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # Drop the unique index
        try:
            await db.users.drop_index('phone_unique_idx')
            print("✅ Dropped phone_unique_idx")
        except Exception as e:
            print(f"⚠️  Index might not exist: {e}")
        
        # Restore original phone numbers for duplicates
        cursor = db.users.find({'phone_duplicate_original': {'$exists': True}})
        restored = 0
        async for user in cursor:
            original_phone = user.get('phone_duplicate_original')
            await db.users.update_one(
                {'_id': user['_id']},
                {
                    '$set': {'phone': original_phone},
                    '$unset': {'phone_duplicate_original': ''}
                }
            )
            restored += 1
        
        print(f"✅ Restored {restored} phone numbers to original values")
        print("\n✅ Rollback completed")
        
    finally:
        client.close()


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Migration: Create unique phone index')
    parser.add_argument('--execute', action='store_true', help='Execute the migration (default is dry run)')
    parser.add_argument('--rollback', action='store_true', help='Rollback the migration')
    
    args = parser.parse_args()
    
    if args.rollback:
        asyncio.run(rollback_migration())
    else:
        asyncio.run(run_migration(dry_run=not args.execute))
