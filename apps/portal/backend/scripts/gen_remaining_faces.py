"""
Generate remaining face images using gemini-2.0-flash-exp-image-generation model.
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


def generate_face_flash(story, index_num):
    gender = story.get('gender', 'M')
    age = story.get('age', 40)
    profession = story.get('profession', 'Professional')
    name = story.get('name', 'Unknown')
    
    gender_word = "man" if gender == "M" else "woman"
    gender_desc = "Latino" if gender == "M" else "Latina"
    
    prompt = (
        f"Generate a professional corporate headshot photograph of a {age}-year-old {gender_desc} {gender_word}, "
        f"who is a {profession}, wearing formal business attire, "
        f"studio lighting, neutral gray background, looking directly at camera, "
        f"confident expression, high quality portrait photography, sharp focus"
    )
    
    filename = f"face_{index_num:03d}_{gender.lower()}.png"
    filepath = FACES_DIR / filename
    
    if filepath.exists() and filepath.stat().st_size > 1000:
        return filename
    
    try:
        response = gemini_client.models.generate_content(
            model='gemini-2.0-flash-exp-image-generation',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE']
            )
        )
        
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                img_bytes = part.inline_data.data
                with open(filepath, 'wb') as f:
                    f.write(img_bytes)
                logger.info(f"Generated: {filename} for {name} ({len(img_bytes)} bytes)")
                return filename
        
        logger.warning(f"No image in response for {name}")
        return None
    except Exception as e:
        logger.error(f"Error for {name}: {e}")
        return None


def main():
    logger.info("GENERATING REMAINING FACE IMAGES (gemini-2.0-flash)")
    
    stories = list(db.success_stories.find({}).sort("createdAt", 1))
    
    missing = []
    for i, story in enumerate(stories):
        photo = story.get('photo')
        if photo:
            filename = photo.replace('/api/faces/', '')
            filepath = FACES_DIR / filename
            if filepath.exists() and filepath.stat().st_size > 1000:
                continue
        missing.append((i, story))
    
    logger.info(f"Missing images: {len(missing)}")
    
    generated = 0
    for idx, (i, story) in enumerate(missing):
        filename = generate_face_flash(story, i)
        
        if filename:
            photo_url = f"/api/faces/{filename}"
            db.success_stories.update_one(
                {"id": story["id"]},
                {"$set": {"photo": photo_url}}
            )
            generated += 1
        
        if idx < len(missing) - 1:
            time.sleep(4)  # ~15 per minute
    
    logger.info(f"DONE: Generated {generated}/{len(missing)} images")
    with_photo = db.success_stories.count_documents({"photo": {"$regex": "^/api/faces/"}})
    existing_files = len(list(FACES_DIR.glob("face_*.png")))
    logger.info(f"DB records with photo: {with_photo}/100, Files on disk: {existing_files}")


if __name__ == "__main__":
    main()
