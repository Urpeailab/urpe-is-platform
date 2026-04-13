"""
USCIS Case Status Cron Job
Refreshes all tracked USCIS cases twice daily at 7:00 AM EST and 7:00 PM EST.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from services.uscis_scraper import fetch_uscis_status
import os

logger = logging.getLogger(__name__)

EST_OFFSET = timedelta(hours=-5)


async def refresh_all_uscis_cases(db):
    """Refresh status for all tracked USCIS cases."""
    cases = await db.uscis_tracker_cases.find({}, {"receiptNumber": 1, "statusTitle": 1}).to_list(1000)

    if not cases:
        logger.info("USCIS cron: No cases to refresh")
        return

    logger.info(f"USCIS cron: Refreshing {len(cases)} cases...")
    updated = 0
    errors = 0

    for case in cases:
        receipt = case.get("receiptNumber")
        if not receipt:
            continue

        try:
            result = await fetch_uscis_status(receipt)

            if not result.get("success"):
                errors += 1
                continue

            old_title = case.get("statusTitle", "")
            new_title = result.get("statusTitle", "")
            status_changed = old_title != new_title and new_title

            update = {
                "status": result["status"],
                "statusTitle": result["statusTitle"],
                "statusDescription": result["statusDescription"],
                "statusDate": result.get("statusDate"),
                "lastCheckedAt": datetime.now(timezone.utc).isoformat(),
            }

            if result.get("formType"):
                update["formType"] = result["formType"]

            if status_changed:
                update["lastStatusChangeAt"] = datetime.now(timezone.utc).isoformat()
                history_entry = {
                    "date": result.get("statusDate") or datetime.now(timezone.utc).isoformat(),
                    "status": result["status"],
                    "statusTitle": result["statusTitle"],
                    "description": result["statusDescription"],
                }
                await db.uscis_tracker_cases.update_one(
                    {"receiptNumber": receipt},
                    {"$push": {"history": {"$each": [history_entry], "$position": 0}}}
                )
                updated += 1

            await db.uscis_tracker_cases.update_one({"receiptNumber": receipt}, {"$set": update})

            # Small delay between requests to avoid rate limiting
            await asyncio.sleep(2)

        except Exception as e:
            logger.error(f"USCIS cron error for {receipt}: {e}")
            errors += 1

    logger.info(f"USCIS cron complete: {len(cases)} checked, {updated} updated, {errors} errors")


async def uscis_cron_loop(db):
    """Run the USCIS refresh cron at 7:00 AM and 7:00 PM EST."""
    logger.info("USCIS cron scheduler started")

    while True:
        try:
            now_utc = datetime.now(timezone.utc)
            now_est = now_utc + EST_OFFSET
            current_hour = now_est.hour
            current_minute = now_est.minute

            # Check if it's 7:00 AM or 7:00 PM EST (within the first minute)
            if current_hour in (7, 19) and current_minute == 0:
                label = "7:00 AM" if current_hour == 7 else "7:00 PM"
                logger.info(f"USCIS cron triggered at {label} EST")
                await refresh_all_uscis_cases(db)
                # Sleep 61 seconds to avoid re-triggering in the same minute
                await asyncio.sleep(61)
            else:
                # Check every 30 seconds
                await asyncio.sleep(30)

        except Exception as e:
            logger.error(f"USCIS cron loop error: {e}")
            await asyncio.sleep(60)
