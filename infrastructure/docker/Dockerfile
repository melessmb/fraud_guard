FROM python:3.11-slim

# libgomp1 requis par LightGBM (OpenMP) ; curl requis par le healthcheck Docker
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

ENV PYTHONPATH=/app/backend

EXPOSE 8000

# WEB_CONCURRENCY : workers Gunicorn (défaut 4 — règle du pouce : 2×CPU+1)
ENV WEB_CONCURRENCY=4

CMD gunicorn app.main:app \
      --workers ${WEB_CONCURRENCY} \
      --worker-class uvicorn.workers.UvicornWorker \
      --bind 0.0.0.0:8000 \
      --timeout 30 \
      --graceful-timeout 10 \
      --keep-alive 5 \
      --access-logfile - \
      --error-logfile -
