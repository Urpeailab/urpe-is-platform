"""
Retry script to generate missing face images for success stories.
Respects Gemini API rate limits (10 req/min).
"""
import os
import sys
import time
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pymongo import MongoClient
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / '.env')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

GEMINI_API_KEY = 'AIzaSyDUw5hpmldxVKtWzXUqF3bInBiS5UrOBrU'
FACES_DIR = Path(__file__).parent.parent / 'uploads' / 'faces'
FACES_DIR.mkdir(parents=True, exist_ok=True)

mongo_client = MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
db = mongo_client[os.environ.get('DB_NAME', 'test_database')]
gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def generate_face(story, index_num):
    """Generate a face image for a story."""
    gender = story.get('gender', 'M')
    age = story.get('age', 40)
    profession = story.get('profession', 'Professional')
    name = story.get('name', 'Unknown')
    
    gender_word = "man" if gender == "M" else "woman"
    gender_desc = "Latino" if gender == "M" else "Latina"
    
    prompt = (
        f"Professional corporate headshot photograph of a {age}-year-old {gender_desc} {gender_word}, "
        f"who is a {profession}, wearing formal business attire, "
        f"studio lighting, neutral gray background, looking directly at camera, "
        f"confident expression, high quality portrait photography, sharp focus, "
        f"natural skin tones, professional setting"
    )
    
    filename = f"face_{index_num:03d}_{gender.lower()}.png"
    filepath = FACES_DIR / filename
    
    if filepath.exists() and filepath.stat().st_size > 1000:
        logger.info(f"Image already exists: {filename}")
        return filename
    
    try:
        response = gemini_client.models.generate_images(
            model='imagen-4.0-fast-generate-001',
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1)
        )
        
        if response.generated_images:
            img_bytes = response.generated_images[0].image.image_bytes
            with open(filepath, 'wb') as f:
                f.write(img_bytes)
            logger.info(f"Generated: {filename} for {name} ({len(img_bytes)} bytes)")
            return filename
        else:
            logger.warning(f"No image generated for {name}")
            return None
    except Exception as e:
        logger.error(f"Error for {name}: {e}")
        return None


def main():
    logger.info("=" * 60)
    logger.info("RETRY - Generating missing face images")
    logger.info("=" * 60)
    
    # Get all stories sorted by creation
    stories = list(db.success_stories.find({}).sort("createdAt", 1))
    logger.info(f"Total stories: {len(stories)}")
    
    missing = []
    for i, story in enumerate(stories):
        photo = story.get('photo')
        if photo:
            # Check if the file exists
            filename = photo.replace('/api/faces/', '')
            filepath = FACES_DIR / filename
            if filepath.exists() and filepath.stat().st_size > 1000:
                continue
        missing.append((i, story))
    
    logger.info(f"Stories needing images: {len(missing)}")
    
    if not missing:
        logger.info("All images are present!")
        return
    
    batch_count = 0
    total_generated = 0
    
    for idx, (i, story) in enumerate(missing):
        filename = generate_face(story, i)
        
        if filename:
            photo_url = f"/api/faces/{filename}"
            db.success_stories.update_one(
                {"id": story["id"]},
                {"$set": {"photo": photo_url}}
            )
            total_generated += 1
        
        batch_count += 1
        
        # Rate limit: 10 per minute, so wait 7 seconds between each to be safe
        if batch_count < len(missing):
            wait_time = 7
            logger.info(f"[{idx+1}/{len(missing)}] Waiting {wait_time}s for rate limit...")
            time.sleep(wait_time)
    
    logger.info("=" * 60)
    logger.info(f"RETRY COMPLETE: {total_generated}/{len(missing)} images generated")
    
    # Final stats
    total_with_photo = db.success_stories.count_documents({"photo": {"$ne": None}})
    logger.info(f"Stories with photos: {total_with_photo}/100")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
