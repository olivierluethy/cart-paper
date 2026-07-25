# syntax=docker/dockerfile:1
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

# System libraries: WeasyPrint (pango/cairo/gdk-pixbuf) + image handling + postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      curl \
      libpango-1.0-0 \
      libpangoft2-1.0-0 \
      libharfbuzz0b \
      libffi8 \
      libgdk-pixbuf-2.0-0 \
      libcairo2 \
      shared-mime-info \
      fonts-dejavu-core \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x /app/entrypoint.sh && mkdir -p /data/uploads

EXPOSE 8000

FROM base AS dev
ENV APP_ENV=development
CMD ["/app/entrypoint.sh", "--reload"]

FROM base AS prod
ENV APP_ENV=production
CMD ["/app/entrypoint.sh"]
