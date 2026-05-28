# === Stage 1: Build React frontend ===
FROM node:18-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
ENV REACT_APP_BACKEND_URL=""
RUN npm run build

# === Stage 2: Python backend + serve built frontend ===
FROM python:3.11-slim
WORKDIR /app

# System deps for lxml, matplotlib, pdfminer, Pillow, reportlab, playwright.
# tesseract-ocr (+ eng/spa lang packs) provides local OCR fallback for PDFs
# whose text layer is vectorized (Canva / Adobe Express exports) — see the
# cascade in backend/pdf_extractor.py.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev libssl-dev libxml2-dev libxslt1-dev \
    libjpeg-dev zlib1g-dev libfreetype6-dev \
    libcairo2-dev pkg-config \
    tesseract-ocr tesseract-ocr-eng tesseract-ocr-spa \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Playwright browser (for PDF generation via headless Chrome)
RUN playwright install chromium --with-deps 2>/dev/null || true

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./frontend/build

WORKDIR /app/backend
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
