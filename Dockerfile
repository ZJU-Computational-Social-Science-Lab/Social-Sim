FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

ARG FRONTEND_BASE_URL=/
ARG VITE_API_BASE_URL
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
ENV FRONTEND_BASE_URL=${FRONTEND_BASE_URL}
RUN FRONTEND_BASE_URL=${FRONTEND_BASE_URL} VITE_API_BASE_URL=${VITE_API_BASE_URL} npm run build

FROM python:latest AS backend
ARG FRONTEND_BASE_URL=/
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=1000 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev

COPY pyproject.toml poetry.lock README.md ./
COPY requirements.txt ./

# Install dependencies from the requirements file provided by the repo
RUN pip install --no-cache-dir --default-timeout=${PIP_DEFAULT_TIMEOUT} -r requirements.txt \
    && pip install --no-cache-dir lxml-html-clean

RUN groupadd -g 1000 appuser \
    && useradd -m -u 1000 -g 1000 -s /bin/bash appuser



COPY src ./src
COPY scripts ./scripts

# Install the application code (--no-deps is safe here because we installed requirements above)
RUN pip install --no-cache-dir --no-deps .

COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY docker/backend-entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENV SOCIALSIM4_FRONTEND_DIST_PATH=/app/frontend/dist

RUN pip uninstall -y poetry \
    && apt-get purge -y build-essential \
    && apt-get autoremove -y --purge \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
