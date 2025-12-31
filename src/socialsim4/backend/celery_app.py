from __future__ import annotations

import os

from celery import Celery

# Broker URL - prefer env var, fallback to redis localhost
BROKER_URL = os.environ.get("REDIS_URL") or os.environ.get("SOCIALSIM4_REDIS_URL") or "redis://localhost:6379/0"

celery_app = Celery("socialsim4", broker=BROKER_URL)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_track_started=True,
)
