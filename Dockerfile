FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for xgboost, numpy, pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python requirements first (layer caching)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy the full project
COPY . .

# Expose the port (Render sets $PORT dynamically)
EXPOSE 10000

# Run with gunicorn — Render assigns $PORT at runtime
CMD cd backend && gunicorn -w 2 -b 0.0.0.0:$PORT run:app --timeout 120 --log-level info
