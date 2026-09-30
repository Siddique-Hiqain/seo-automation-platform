# syntax=docker/dockerfile:1

# Build the React application separately so Node.js is not shipped in the
# production image.
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.12-slim-bookworm AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production \
    APP_DEBUG=false

RUN apt-get update \
    && apt-get install --no-install-recommends --yes \
        ca-certificates \
        libgomp1 \
        nginx \
        supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r /tmp/requirements.txt

COPY backend/ /app/backend/
COPY hiqain-wordpress-plugin.zip /app/hiqain-wordpress-plugin.zip
COPY --from=frontend-builder /build/frontend/dist/ /usr/share/nginx/html/

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh

WORKDIR /app/backend

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1/health', timeout=3)"]

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
