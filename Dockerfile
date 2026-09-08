# ConnectHub office image: Vite frontend + Python FastAPI + static serve
FROM node:22-bookworm-slim AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN rm -rf public/data public/events
ENV VITE_USE_LOCAL_DB=true
ENV VITE_API_URL=
RUN npx vite build

FROM python:3.12-slim-bookworm
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends dumb-init \
  && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /app/dist ./frontend/dist
COPY init-schema.sql /init-schema.sql
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh \
  && mkdir -p /data/uploads \
  && useradd --create-home --uid 1000 appuser \
  && chown -R appuser:appuser /app /data/uploads

ENV NODE_ENV=production
ENV SERVE_STATIC=1
ENV OFFICE_PORT=8080
ENV UPLOAD_DIR=/data/uploads
ENV PYTHONUNBUFFERED=1

USER appuser
WORKDIR /app/backend

EXPOSE 8080
ENTRYPOINT ["dumb-init", "--", "/docker-entrypoint.sh"]
