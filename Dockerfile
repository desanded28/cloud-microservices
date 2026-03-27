# --------------------------------------------------------------------------
# Multi-stage Python Dockerfile for all microservices
# Usage: docker build --build-arg SERVICE=gateway -t gateway .
# --------------------------------------------------------------------------

# Stage 1: Build dependencies
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

LABEL maintainer="cloud-microservices-team"
LABEL description="Task Management Microservice"

# Security: run as non-root
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Build arg to select which service to include
ARG SERVICE=gateway
COPY ./${SERVICE}/ ./

# Create data directory for SQLite (writable by appuser)
RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

# Default env vars
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE ${PORT}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen(f'http://localhost:{__import__(\"os\").getenv(\"PORT\",\"8000\")}/health')" || exit 1

CMD ["python", "main.py"]
