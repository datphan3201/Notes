from datetime import timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from test_boundaries import make

from planner import ai
from planner.config import settings
from planner.db import session_factory
from planner.jobs import claim, finish, materialize, process_one
from planner.models import AIRun, Document, Job, Note, Task, TaskSeries, now
from planner.planning import enqueue


def proposal_run(db, owner, operations, sources):
    proposal = {"operations": operations}
    run = AIRun(
        user_id=owner,
        prompt="Plan",
        status="completed",
        proposal=proposal,
        proposal_hash=ai.canonical_hash(proposal),
        proposal_expires=now() + timedelta(hours=1),
        sources=sources,
    )
    db.add(run)
    db.commit()
    return run


def test_ai_approval_replay_and_hash_binding(client, db):
    make(client, "notes")
    owner = db.scalar(select(Note.user_id))
    run = proposal_run(
        db, owner, [{"kind": "tasks", "action": "create", "fields": {"title": "Approved task"}}], []
    )
    url = f"/api/v1/assistant/runs/{run.id}/apply"
    assert client.post(url, json={"proposal_hash": "0" * 64}).status_code == 409
    assert client.post(url, json={"proposal_hash": run.proposal_hash}).status_code == 200
    assert client.post(url, json={"proposal_hash": run.proposal_hash}).status_code == 200
    assert len(client.get("/api/v1/tasks").json()["items"]) == 1


def test_ai_stale_context_and_atomic_failure(client, db):
    note = make(client, "notes")
    owner = db.scalar(select(Note.user_id))
    source = {"kind": "notes", "id": note["id"], "version": 1}
    run = proposal_run(
        db,
        owner,
        [
            {"kind": "tasks", "action": "create", "fields": {"title": "Should roll back"}},
            {
                "kind": "tasks",
                "action": "create",
                "fields": {"title": "Invalid", "importance": 99},
            },
        ],
        [source],
    )
    assert (
        client.post(
            f"/api/v1/assistant/runs/{run.id}/apply", json={"proposal_hash": run.proposal_hash}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/tasks").json()["items"] == []
    client.patch("/api/v1/notes/" + note["id"], json={"version": 1, "fields": {"title": "Changed"}})
    assert (
        client.post(
            f"/api/v1/assistant/runs/{run.id}/apply", json={"proposal_hash": run.proposal_hash}
        ).status_code
        == 409
    )


def test_retrieval_ignores_foreign_locked_archived_and_stale_documents(client, stranger, db):
    note = make(client, "notes", content="knowledge astronomy")
    make(stranger, "notes", content="knowledge other account")
    for row in db.scalars(select(Note)):
        db.add(
            Document(
                user_id=row.user_id,
                source_kind="notes",
                source_id=row.id,
                source_version=1,
                chunk=0,
                text=row.content,
                content_hash="0" * 64,
            )
        )
    db.commit()
    owner = db.get(Note, note["id"]).user_id
    assert [row["id"] for row in ai.retrieval(db, owner, "knowledge")] == [note["id"]]
    current = db.get(Note, note["id"])
    current.lock_hash = "protected"
    db.commit()
    assert ai.retrieval(db, owner, "knowledge") == []
    current.lock_hash, current.version = None, 2
    db.commit()
    assert ai.retrieval(db, owner, "knowledge") == []
    current.version, current.archived_at = 1, now()
    db.commit()
    assert ai.retrieval(db, owner, "knowledge") == []


def test_semantic_ranking_runs_in_pgvector_with_owner_and_model_filters(
    client, stranger, db, monkeypatch
):
    note = make(client, "notes", content="An idea about a distant subject")
    make(stranger, "notes", content="Another account")
    monkeypatch.setattr(settings(), "embedding_model", "test-vector-v1")
    vector = [1.0] + [0.0] * 1535
    for source in db.scalars(select(Note)):
        db.add(
            Document(
                user_id=source.user_id,
                source_kind="notes",
                source_id=source.id,
                source_version=1,
                chunk=0,
                text=source.content,
                content_hash="0" * 64,
                embedding=vector,
                embedding_model="test-vector-v1",
            )
        )
    db.commit()
    owner = db.get(Note, note["id"]).user_id
    result = ai.retrieval(db, owner, "no-lexical-match", vector)
    assert [row["id"] for row in result] == [note["id"]]
    monkeypatch.setattr(settings(), "embedding_model", "different-model")
    assert ai.retrieval(db, owner, "no-lexical-match", vector) == []


def test_job_lease_retry_and_deduplication(client, db):
    make(client, "notes")
    owner = db.scalar(select(Note.user_id))
    enqueue(db, owner, "example", "same-job", {})
    enqueue(db, owner, "example", "same-job", {})
    db.commit()
    job = db.scalar(select(Job).where(Job.key == "same-job"))
    factory = session_factory()
    first = claim(factory, job.id)
    assert first and claim(factory, job.id) is None
    finish(factory, first, ValueError("transient"))
    db.expire_all()
    row = db.get(Job, job.id)
    assert row.status == "queued" and row.attempts == 1
    row.available_at = now() - timedelta(seconds=1)
    db.commit()
    second = claim(factory, job.id)
    finish(factory, first)  # Old lease cannot acknowledge a newer attempt.
    db.expire_all()
    assert db.get(Job, job.id).status == "running"
    finish(factory, second)
    assert claim(factory, job.id) is None


def test_idle_worker_lane_backs_off_and_resets(monkeypatch):
    from planner import jobs

    sleeps = []
    steps = iter([False, False, False, False, True, False])

    class Stop:
        def is_set(self):
            return False

        def wait(self, seconds):
            sleeps.append(seconds)

    monkeypatch.setattr(jobs, "process_one", lambda **_: next(steps))
    monkeypatch.setattr(jobs, "heartbeat", lambda *_: None)
    with pytest.raises(StopIteration):
        jobs._poll_lane(Stop(), slow=False)
    assert sleeps == [1, 2, 4, 5, 1]


def test_worker_lanes_claim_distinct_job_kinds(client, db):
    from planner.models import User

    owner = db.scalar(select(User.id))
    enqueue(db, owner, "assistant", "lane-assistant", {})
    enqueue(db, owner, "email", "lane-email", {})
    db.commit()
    fast = claim(session_factory(), slow=False)
    slow = claim(session_factory(), slow=True)
    assert fast and fast.kind == "email"
    assert slow and slow.kind in ("assistant", "index")


def test_scheduler_and_fast_lane_run_while_slow_lane_is_busy(monkeypatch):
    import threading

    from planner import jobs

    stop = threading.Event()
    slow_started = threading.Event()
    release_slow = threading.Event()
    fast_ran = threading.Event()
    scheduled = threading.Event()

    def process_one(*, slow):
        if slow:
            slow_started.set()
            release_slow.wait(2)
        else:
            fast_ran.set()
        return False

    monkeypatch.setattr(jobs, "process_one", process_one)
    monkeypatch.setattr(jobs, "schedule", scheduled.set)
    monkeypatch.setattr(jobs, "heartbeat", lambda *_: None)
    threads = [
        threading.Thread(target=jobs._poll_lane, args=(stop,), kwargs={"slow": True}),
        threading.Thread(target=jobs._poll_lane, args=(stop,), kwargs={"slow": False}),
        threading.Thread(target=jobs._scheduler_loop, args=(stop,)),
    ]
    try:
        threads[0].start()
        assert slow_started.wait(1)
        for thread in threads[1:]:
            thread.start()
        assert fast_ran.wait(1)
        assert scheduled.wait(1)
    finally:
        stop.set()
        release_slow.set()
        for thread in threads:
            if thread.ident is not None:
                thread.join(timeout=2)


def test_worker_interruption_releases_the_owned_job_for_retry(client, db, monkeypatch):
    make(client, "notes")
    job = db.scalar(select(Job).where(Job.kind == "index"))

    def interrupt(*args, **kwargs):
        raise KeyboardInterrupt()

    monkeypatch.setattr("planner.jobs.index_source", interrupt)
    with pytest.raises(KeyboardInterrupt):
        process_one(session_factory(), job_id=job.id)
    db.expire_all()
    current = db.get(Job, job.id)
    assert current.status == "queued"
    assert current.lease_until is None
    assert current.error_code == "KeyboardInterrupt"


def test_worker_health_detects_missing_and_stale_lanes(client, db):
    from planner.jobs import heartbeat
    from planner.models import SystemSetting

    assert client.get("/health/worker").status_code == 503
    for lane in ("scheduler", "fast", "slow"):
        heartbeat(lane, session_factory())
    assert client.get("/health/worker").status_code == 200
    row = db.get(SystemSetting, "worker:heartbeat:fast")
    row.value = {"at": (now() - timedelta(minutes=5)).isoformat()}
    db.commit()
    assert client.get("/health/worker").status_code == 503


def test_recurrence_is_not_materialized_on_get_and_is_idempotent(client, db):
    from datetime import date

    series = make(client, "task-series", frequency="daily", start_date=str(date.today()))
    assert client.get("/api/v1/tasks").json()["items"] == []
    row = db.get(TaskSeries, series["id"])
    job = Job(user_id=row.user_id, kind="recurrence", key="test", payload={})
    materialize(db, job)
    first = len(db.scalars(select(Task)).all())
    assert first >= 7
    materialize(db, job)
    assert len(db.scalars(select(Task)).all()) == first


def test_scheduler_only_enqueues_due_reminders_and_recurrences(client, db, monkeypatch):
    from planner import jobs

    jobs.schedule(session_factory())
    def periodic():
        return list(db.scalars(select(Job).where(Job.kind.in_(["recurrence", "reminders"]))))
    assert periodic() == []

    make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    make(client, "task-series", frequency="daily", start_date=str(now().date()))
    db.expire_all()
    jobs.schedule(session_factory())
    db.expire_all()
    first = periodic()
    assert {job.kind for job in first} == {"recurrence", "reminders"}
    for job in first:
        assert jobs.process_one(session_factory(), job_id=job.id)

    original_now = jobs.now
    monkeypatch.setattr(jobs, "now", lambda: original_now() + timedelta(minutes=1))
    db.expire_all()
    jobs.schedule(session_factory())
    db.expire_all()
    later = periodic()
    assert len([job for job in later if job.kind == "reminders"]) == 1
    from planner.timezones import zone

    crossed_local_day = original_now().astimezone(zone("Asia/Ho_Chi_Minh")).date() != (
        original_now() + timedelta(minutes=1)
    ).astimezone(zone("Asia/Ho_Chi_Minh")).date()
    assert len([job for job in later if job.kind == "recurrence"]) == 1 + crossed_local_day


def test_scheduler_does_not_enqueue_expired_reminders_for_other_accounts(client, stranger, db):
    from planner import jobs

    reminder = (now() - timedelta(minutes=1)).isoformat()
    make(client, "tasks", reminder_at=reminder, due_date=str(now().date() - timedelta(days=30)))
    task = make(stranger, "tasks", reminder_at=reminder)
    expected_owner = db.get(Task, task["id"]).user_id
    jobs.schedule(session_factory())
    db.expire_all()
    jobs_due = list(db.scalars(select(Job).where(Job.kind == "reminders")))
    assert [job.user_id for job in jobs_due] == [expected_owner]


def test_queued_reminder_rechecks_rescheduled_task(client, db):
    from planner import jobs
    from planner.models import Notification

    task = make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    jobs.schedule(session_factory())
    db.expire_all()
    job = db.scalar(select(Job).where(Job.kind == "reminders"))
    assert job is not None
    changed = client.patch(
        "/api/v1/tasks/" + task["id"],
        json={"version": task["version"], "fields": {"reminder_at": (now() + timedelta(days=1)).isoformat()}},
    )
    assert changed.status_code == 200
    assert jobs.process_one(session_factory(), job_id=job.id)
    db.expire_all()
    assert db.scalars(select(Notification)).all() == []


def test_due_reminder_batches_skip_ineligible_and_recheck_changes(client, stranger, db):
    from planner import jobs
    from planner.models import Notification

    due = (now() - timedelta(minutes=2)).isoformat()
    make(client, "tasks", reminder_at=due, due_date=str(now().date() - timedelta(days=30)))
    first = make(client, "tasks", reminder_at=due)
    second = make(stranger, "tasks", reminder_at=due)
    with session_factory()() as session:
        assert jobs.schedule_due_reminders(session, limit=1) == 1
        session.commit()
    with session_factory()() as session:
        assert jobs.schedule_due_reminders(session, limit=1) == 1
        session.commit()
    with session_factory()() as session:
        assert jobs.schedule_due_reminders(session, limit=1) == 0
    db.expire_all()
    dispatches = list(db.scalars(select(Job).where(Job.kind == "reminder-dispatch")))
    assert {job.payload["task_id"] for job in dispatches} == {first["id"], second["id"]}
    changed = client.patch(
        "/api/v1/tasks/" + first["id"],
        json={"version": first["version"], "fields": {
            "reminder_at": (now() + timedelta(days=1)).isoformat(),
        }},
    )
    assert changed.status_code == 200
    for job in dispatches:
        assert jobs.process_one(session_factory(), job_id=job.id)
    db.expire_all()
    notifications = list(db.scalars(select(Notification)))
    assert len(notifications) == 1
    assert notifications[0].user_id == db.get(Task, second["id"]).user_id


def test_shadow_scheduler_compares_without_creating_jobs(client, db):
    from planner import jobs

    make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    make(client, "task-series", frequency="daily", start_date=str(now().date()))
    before = len(list(db.scalars(select(Job))))
    with session_factory()() as session:
        assert jobs.compare_scheduler(session)
        session.rollback()
    db.expire_all()
    assert len(list(db.scalars(select(Job)))) == before


def test_series_checkpoint_backfill_is_dry_run_by_default(client, db):
    from planner.scheduler_admin import backfill

    series = make(client, "task-series", frequency="monthly", start_date=str(now().date() + timedelta(days=90)))
    db.expire_all()
    initial = db.get(TaskSeries, series["id"]).next_materialize_at
    assert backfill(session_factory(), batch_size=1) == (1, 1)
    db.expire_all()
    assert db.get(TaskSeries, series["id"]).next_materialize_at == initial
    assert backfill(session_factory(), execute=True, batch_size=1) == (1, 1)
    db.expire_all()
    assert db.get(TaskSeries, series["id"]).next_materialize_at > now() + timedelta(days=80)
    assert backfill(session_factory()) == (1, 0)


def test_due_scheduler_mode_does_not_create_legacy_reminder_jobs(client, db, monkeypatch):
    from planner import jobs

    monkeypatch.setattr(settings(), "scheduler_mode", "due")
    make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    jobs.schedule(session_factory())
    jobs.schedule(session_factory())
    db.expire_all()
    assert len(list(db.scalars(select(Job).where(Job.kind == "reminder-dispatch")))) == 1
    assert list(db.scalars(select(Job).where(Job.kind == "reminders"))) == []


def test_due_scheduler_creates_no_periodic_jobs_for_an_idle_account(client, db, monkeypatch):
    from planner import jobs

    monkeypatch.setattr(settings(), "scheduler_mode", "due")
    start = now()
    for minute in range(65):
        monkeypatch.setattr(jobs, "now", lambda minute=minute: start + timedelta(minutes=minute))
        jobs.schedule(session_factory())
    db.expire_all()
    assert list(db.scalars(select(Job).where(
        Job.kind.in_(["recurrence", "reminders", "reminder-dispatch", "retention"])
    ))) == []


def test_due_series_checkpoint_advances_and_invalidates_stale_jobs(client, db, monkeypatch):
    from datetime import date

    from planner import jobs

    monkeypatch.setattr(settings(), "scheduler_mode", "due")
    series = make(client, "task-series", frequency="daily", start_date=str(date.today()))
    jobs.schedule(session_factory())
    db.expire_all()
    first = db.scalar(select(Job).where(Job.kind == "recurrence"))
    assert first and first.payload["series_id"] == series["id"]
    jobs.schedule(session_factory())
    db.expire_all()
    assert len(list(db.scalars(select(Job).where(Job.kind == "recurrence")))) == 1
    assert jobs.process_one(session_factory(), job_id=first.id)
    db.expire_all()
    row = db.get(TaskSeries, series["id"])
    assert row.next_materialize_at > now()
    assert len(list(db.scalars(select(Task).where(Task.series_id == row.id)))) >= 7
    jobs.schedule(session_factory())
    db.expire_all()
    assert len(list(db.scalars(select(Job).where(Job.kind == "recurrence")))) == 1

    row.next_materialize_at = now() - timedelta(minutes=1)
    db.commit()
    jobs.schedule(session_factory())
    db.expire_all()
    stale = db.scalar(select(Job).where(Job.kind == "recurrence", Job.status == "queued"))
    assert stale
    row.next_materialize_at = now() + timedelta(days=5)
    db.commit()
    count = len(list(db.scalars(select(Task).where(Task.series_id == row.id))))
    assert jobs.process_one(session_factory(), job_id=stale.id)
    db.expire_all()
    assert len(list(db.scalars(select(Task).where(Task.series_id == row.id)))) == count


def test_due_retention_checkpoint_only_enqueues_eligible_owner(client, stranger, db):
    from planner import jobs
    from planner.models import SystemSetting, User

    first = make(client, "tasks", status="done")
    second = make(stranger, "tasks", status="done")
    owner = db.get(Task, first["id"]).user_id
    db.get(Task, first["id"]).completed_at = now() - timedelta(days=10)
    db.get(Task, second["id"]).completed_at = now() - timedelta(days=10)
    db.get(User, owner).preferences = {"history_retention_days": 1}
    db.commit()
    with session_factory()() as session:
        assert jobs.schedule_due_retention(session, limit=10) == 1
        session.commit()
    with session_factory()() as session:
        assert jobs.schedule_due_retention(session, limit=10) == 0
    db.expire_all()
    scheduled = list(db.scalars(select(Job).where(Job.kind == "retention")))
    assert [job.user_id for job in scheduled] == [owner]
    assert db.get(SystemSetting, "scheduler:retention").value.get("next_at")
    assert jobs.process_one(session_factory(), job_id=scheduled[0].id)
    db.expire_all()
    assert db.get(Task, first["id"]).archived_at is not None
    assert db.get(Task, second["id"]).archived_at is None


def test_ai_budget_reserved_before_enqueue(client, db, monkeypatch):
    make(client, "notes")
    owner = db.scalar(select(Note.user_id))
    from pydantic import SecretStr

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    monkeypatch.setattr(settings(), "ai_daily_tokens", 100000)
    first = ai.start_run(db, owner, "Plan")
    db.commit()
    assert first.status == "queued"
    with pytest.raises(HTTPException) as exc:
        ai.start_run(db, owner, "Plan again")
    assert exc.value.status_code == 429


class FakeProvider:
    def embed(self, texts):
        return [None] * len(texts)

    def stream(self, messages, publish):
        publish("A small ")
        publish("next step.")
        return {"role": "assistant", "content": "A small next step."}, {
            "prompt_tokens": 100,
            "completion_tokens": 8,
        }


def test_assistant_uses_durable_worker_and_fake_provider(client, db, monkeypatch):
    from pydantic import SecretStr

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    response = client.post("/api/v1/assistant/runs", json={"prompt": "What next?"})
    assert response.status_code == 202
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == f"assistant:{run_id}"))
    assert process_one(session_factory(), FakeProvider(), job.id)
    result = client.get("/api/v1/assistant/runs/" + run_id).json()
    assert result["status"] == "completed" and result["answer"] == "A small next step."
    assert result["input_tokens"] == 100


def test_assistant_batches_stream_writes_and_flushes_provider_errors(client, db, monkeypatch):
    from pydantic import SecretStr
    from sqlalchemy import event

    from planner.db import engine

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    response = client.post("/api/v1/assistant/runs", json={"prompt": "What next?"})
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == f"assistant:{run_id}"))
    writes = []

    def record(_conn, _cursor, statement, _parameters, _context, _many):
        if statement.lstrip().upper().startswith("UPDATE AI_RUNS SET ANSWER"):
            writes.append(statement)

    class FragmentProvider(FakeProvider):
        def stream(self, messages, publish):
            for _ in range(100):
                publish("x")
            raise RuntimeError("provider failed")

    event.listen(engine(), "before_cursor_execute", record)
    try:
        assert process_one(session_factory(), FragmentProvider(), job.id)
    finally:
        event.remove(engine(), "before_cursor_execute", record)
    db.expire_all()
    assert db.get(AIRun, run_id).answer == "x" * 100
    assert len(writes) == 2


def test_buffered_stream_rechecks_note_lock_before_flushing(client, db, monkeypatch):
    from pydantic import SecretStr

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    note = make(client, "notes", content="Private source")
    response = client.post(f"/api/v1/notes/{note['id']}/summary")
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == f"assistant:{run_id}"))

    class LockingProvider(FakeProvider):
        def stream(self, messages, publish):
            publish("visible before lock")
            publish(" must not be saved")
            with session_factory()() as session:
                session.get(Note, note["id"]).lock_hash = "locked"
                session.commit()
            return {"role": "assistant", "content": ""}, {}

    assert process_one(session_factory(), LockingProvider(), job.id)
    db.expire_all()
    assert db.get(AIRun, run_id).answer == "visible before lock"
    assert db.get(Job, job.id).status == "queued"


def test_note_summary_and_questions_use_owned_source_and_trusted_account_context(
    client, db, monkeypatch
):
    from pydantic import SecretStr

    from planner.models import User
    from planner.timezones import zone

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    note = make(client, "notes", content="Only this source should be summarized.")
    make(client, "notes", content="Unrelated private context.")
    owner = db.get(Note, note["id"]).user_id
    account = db.get(User, owner)
    account.timezone = "Asia/Saigon"
    db.commit()

    class RecordingProvider(FakeProvider):
        def stream(self, messages, publish):
            system = messages[0]["content"]
            assert "Only this source" in system and "Unrelated private context" not in system
            assert '"language": "vi"' in system and '"timezone": "Asia/Saigon"' in system
            assert now().astimezone(zone("Asia/Saigon")).date().isoformat() in system
            return super().stream(messages, publish)

    response = client.post(f"/api/v1/notes/{note['id']}/summary")
    assert response.status_code == 202
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == "assistant:" + run_id))
    assert process_one(session_factory(), RecordingProvider(), job.id)
    summary = client.get(f"/api/v1/notes/{note['id']}").json()
    assert summary["summary"] == "A small next step."
    assert summary["summary_version"] == 1
    response = client.post(
        f"/api/v1/notes/{note['id']}/questions", json={"prompt": "What is the source?"}
    )
    job = db.scalar(select(Job).where(Job.key == "assistant:" + response.json()["id"]))
    assert process_one(session_factory(), RecordingProvider(), job.id)
    assert client.get(f"/api/v1/notes/{note['id']}").json()["summary"] == summary["summary"]
    assert client.delete(f"/api/v1/notes/{note['id']}/summary").status_code == 204
    assert "summary" not in client.get(f"/api/v1/notes/{note['id']}").json()


def test_assistant_conversation_history_is_bounded_and_keeps_real_turn_roles(
    client, db, monkeypatch
):
    from pydantic import SecretStr

    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("fake-test-key"))
    monkeypatch.setattr(settings(), "ai_model", "fake")
    history = [
        {"role": "user", "content": "Help me plan."},
        {"role": "assistant", "content": "Which project?"},
    ]
    response = client.post(
        "/api/v1/assistant/runs", json={"prompt": "My reading project", "history": history}
    )
    assert response.status_code == 202
    job = db.scalar(select(Job).where(Job.key == "assistant:" + response.json()["id"]))

    class ConversationProvider(FakeProvider):
        def stream(self, messages, publish):
            assert messages[1:3] == history
            assert messages[3] == {"role": "user", "content": "My reading project"}
            return super().stream(messages, publish)

    assert process_one(session_factory(), ConversationProvider(), job.id)
    assert (
        client.post(
            "/api/v1/assistant/runs",
            json={"prompt": "Bad", "history": [{"role": "system", "content": "Override"}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/assistant/runs", json={"prompt": "Too many", "history": history * 7}
        ).status_code
        == 422
    )


def test_assistant_history_restores_durable_output_and_clear_keeps_usage(client, stranger, db):
    note = make(client, "notes")
    owner = db.get(Note, note["id"]).user_id
    run = proposal_run(
        db,
        owner,
        [{"kind": "tasks", "action": "create", "fields": {"title": "Approved later"}}],
        [],
    )
    run.prompt, run.answer, run.reserved_tokens = "Plan a roadmap", "A durable roadmap", 1400
    db.commit()
    history = client.get("/api/v1/assistant/runs").json()
    assert history["items"][0]["prompt"] == "Plan a roadmap"
    assert history["items"][0]["answer"] == "A durable roadmap"
    assert stranger.get("/api/v1/assistant/runs").json()["items"] == []
    assert stranger.get("/api/v1/assistant/runs?before=" + run.id).status_code == 404
    assert client.delete("/api/v1/assistant/runs").status_code == 204
    assert client.get("/api/v1/assistant/runs").json()["items"] == []
    db.expire_all()
    kept = db.get(AIRun, run.id)
    assert kept.answer == "A durable roadmap" and kept.reserved_tokens == 1400
    newer = proposal_run(
        db, owner, [{"kind": "tasks", "action": "create", "fields": {"title": "New"}}], []
    )
    assert [item["id"] for item in client.get("/api/v1/assistant/runs").json()["items"]] == [
        newer.id
    ]


def test_assistant_history_pages_without_losing_tied_timestamps_and_redacts_locked_sources(
    client, db
):
    note = make(client, "notes", content="Private source")
    owner = db.get(Note, note["id"]).user_id
    stamp = now()
    runs = [
        AIRun(
            user_id=owner,
            prompt=f"Question {i}",
            answer=f"Answer {i}",
            status="completed",
            created_at=stamp,
        )
        for i in range(33)
    ]
    db.add_all(runs)
    db.commit()
    first = client.get("/api/v1/assistant/runs").json()
    second = client.get("/api/v1/assistant/runs?before=" + first["next_cursor"]).json()
    ids = [item["id"] for item in first["items"] + second["items"]]
    assert len(ids) == len(set(ids)) == 33 and second["next_cursor"] is None
    protected = runs[0]
    protected.sources = [{"kind": "notes", "id": note["id"], "version": 1}]
    db.get(Note, note["id"]).lock_hash = "protected"
    db.commit()
    all_items = client.get("/api/v1/assistant/runs").json()
    older = client.get("/api/v1/assistant/runs?before=" + all_items["next_cursor"]).json()
    masked = next(
        item for item in all_items["items"] + older["items"] if item["id"] == protected.id
    )
    assert masked["error_code"] == "SOURCE_UNAVAILABLE"
    assert masked["prompt"] is None and masked["answer"] == "" and masked["sources"] == []


def test_completed_run_events_return_the_saved_answer(client, db):
    note = make(client, "notes")
    run = AIRun(
        user_id=db.get(Note, note["id"]).user_id,
        prompt="Question",
        answer="Saved answer",
        status="completed",
    )
    db.add(run)
    db.commit()
    response = client.get(f"/api/v1/assistant/runs/{run.id}/events")
    assert response.status_code == 200
    assert '"answer": "Saved answer"' in response.text
    assert '"status": "completed"' in response.text


def test_stream_database_wait_does_not_block_event_loop(monkeypatch):
    import asyncio
    import time
    from types import SimpleNamespace

    from planner import main

    row = SimpleNamespace(status="completed")
    session = SimpleNamespace(expires_at=now() + timedelta(minutes=1))

    class FakeDB:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            pass

        def get(self, *_):
            return session

        def scalar(self, *_):
            return row

        def rollback(self):
            pass

    def slow_result(*_):
        time.sleep(0.2)
        return {"status": "completed"}

    monkeypatch.setattr(main, "session_factory", lambda: FakeDB)
    monkeypatch.setattr(main, "run_result", slow_result)
    auth = SimpleNamespace(user=SimpleNamespace(id="owner"), session=SimpleNamespace(token_hash="s"))
    response = main.events("run", auth, FakeDB())

    async def check():
        timer = asyncio.Event()
        asyncio.get_running_loop().call_later(0.05, timer.set)
        await response.body_iterator.__anext__()
        assert timer.is_set(), "database wait blocked the event loop"

    asyncio.run(check())
