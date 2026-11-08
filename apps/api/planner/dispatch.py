"""Transactional jobs are the outbox; Cloud Tasks is an at-least-once delivery adapter."""

from datetime import timedelta

from sqlalchemy import and_, or_, select, update

from planner.config import settings
from planner.db import session_factory
from planner.models import Job, now


def dispatch(factory=None, client=None):
    config = settings()
    if not config.cloud_tasks_queue:
        return 0
    from google.api_core.exceptions import AlreadyExists
    from google.cloud import tasks_v2

    factory = factory or session_factory()
    client = client or tasks_v2.CloudTasksClient()
    with factory() as db:
        jobs = db.scalars(
            select(Job)
            .where(
                or_(
                    and_(Job.status == "queued", Job.available_at <= now()),
                    and_(Job.status == "running", Job.lease_until < now()),
                ),
                or_(Job.dispatched_at.is_(None), Job.dispatched_at < now() - timedelta(minutes=15)),
            )
            .order_by(Job.available_at, Job.id)
            .limit(100)
        ).all()
        db.expunge_all()
    # A crash between publish and marking dispatched republishes the same task name.
    delivered = 0
    for job in jobs:
        generation = job.dispatch_generation
        task_name = config.cloud_tasks_queue + f"/tasks/{job.id}-{generation}"
        try:
            client.create_task(
                request={
                    "parent": config.cloud_tasks_queue,
                    "task": {
                        "name": task_name,
                        "http_request": {
                            "http_method": tasks_v2.HttpMethod.POST,
                            "url": config.worker_audience.rstrip("/") + f"/internal/jobs/{job.id}",
                            "oidc_token": {
                                "service_account_email": config.worker_service_account,
                                "audience": config.worker_audience,
                            },
                        },
                        "dispatch_deadline": {"seconds": 600},
                    },
                }
            )
        except AlreadyExists:
            pass
        with factory() as db:
            db.execute(
                update(Job)
                .where(
                    Job.id == job.id,
                    Job.dispatch_generation == generation,
                    Job.status.in_(["queued", "running"]),
                )
                .values(dispatched_at=now(), dispatch_generation=generation + 1)
            )
            db.commit()
        delivered += 1
    return delivered
