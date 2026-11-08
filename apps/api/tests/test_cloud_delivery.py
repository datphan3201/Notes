import pytest
from fastapi.testclient import TestClient
from google.api_core.exceptions import AlreadyExists
from sqlalchemy import select
from test_boundaries import make

from planner.config import settings
from planner.db import session_factory
from planner.dispatch import dispatch
from planner.models import Job, Note
from planner.planning import enqueue
from planner.worker_api import app as worker_app


def test_dispatch_reuses_name_after_ambiguous_publish(client, db, monkeypatch):
    make(client, "notes")
    owner = db.scalar(select(Note.user_id))
    enqueue(db, owner, "reminders", "cloud-test", {})
    db.commit()
    monkeypatch.setattr(
        settings(), "cloud_tasks_queue", "projects/test/locations/test/queues/planner"
    )
    monkeypatch.setattr(settings(), "worker_audience", "https://worker.example")
    monkeypatch.setattr(
        settings(), "worker_service_account", "queue@example.iam.gserviceaccount.com"
    )
    calls = []

    class Queue:
        def create_task(self, request):
            calls.append(request["task"]["name"])
            if len(calls) == 1:
                raise ConnectionError("Published but acknowledgement was lost")
            raise AlreadyExists("Task was published on the first attempt")

    with pytest.raises(ConnectionError):
        dispatch(session_factory(), Queue())
    assert dispatch(session_factory(), Queue()) >= 1
    assert calls[0] == calls[1]
    job = db.scalar(select(Job).where(Job.key == "cloud-test"))
    db.refresh(job)
    assert job.dispatched_at is not None


def test_worker_requires_verified_service_identity(monkeypatch):
    monkeypatch.setattr(settings(), "worker_audience", "https://worker.example")
    monkeypatch.setattr(
        settings(), "worker_service_account", "queue@example.iam.gserviceaccount.com"
    )
    with TestClient(worker_app) as client:
        assert client.post("/internal/jobs/missing").status_code == 401
        monkeypatch.setattr(
            "google.oauth2.id_token.verify_oauth2_token",
            lambda *args, **kwargs: {"email": "attacker@example.com", "email_verified": True},
        )
        assert (
            client.post(
                "/internal/jobs/missing", headers={"Authorization": "Bearer fake"}
            ).status_code
            == 403
        )
        monkeypatch.setattr(
            "google.oauth2.id_token.verify_oauth2_token",
            lambda *args, **kwargs: {
                "email": settings().worker_service_account,
                "email_verified": True,
            },
        )
        assert (
            client.post(
                "/internal/jobs/missing", headers={"Authorization": "Bearer fake"}
            ).status_code
            == 200
        )
