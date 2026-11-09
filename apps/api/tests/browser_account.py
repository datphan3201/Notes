"""Synthetic browser fixtures/outbox inspection, only in the guarded test database."""

import base64
import json
import sys
from datetime import timedelta

from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from planner.accounts import cipher, queue_email, totp_code
from planner.auth import passwords
from planner.config import settings
from planner.db import session_factory
from planner.models import AuthToken, Job, User, now

config = settings()
if config.environment != "testing" or make_url(config.database_url).database != "planner_test":
    raise RuntimeError("Browser fixtures require planner_test")
values = json.load(sys.stdin)
if not values["email"].endswith("@example.com"):
    raise RuntimeError("Only synthetic browser accounts are accepted")
with session_factory()() as db:
    if db.scalar(text("SELECT current_database()")) != "planner_test":
        raise RuntimeError("Actual fixture database is not planner_test")
    action = values.get("action", "seed")
    user = db.scalar(select(User).where(User.email == values["email"]))
    if action == "seed":
        user = User(
            email=values["email"],
            name="Browser acceptance",
            password_hash=passwords.hash(values["password"]),
            locale=values.get("locale", "vi"),
            role="admin" if values.get("admin") else "user",
            email_verified_at=None if values.get("unverified") else now(),
        )
        if values.get("mfa"):
            secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
            user.totp_secret = cipher().encrypt(secret.encode()).decode()
        db.add(user)
    elif action == "legacy-archive":
        from planner import planning
        if values["kind"] not in ("notes", "reviews"):
            raise RuntimeError("Only legacy Notes/Reviews are supported")
        row = planning.owned(db, values["kind"], values["id"], user.id)
        row.archived_at = now()
        row.version += 1
    elif action == "link":
        queue_email(db, user, values["purpose"])
    elif action == "expire":
        for token in db.scalars(
            select(AuthToken).where(
                AuthToken.user_id == user.id, AuthToken.purpose == values["purpose"]
            )
        ):
            token.expires_at = now() - timedelta(seconds=1)
    elif action == "mail":
        job = db.scalar(
            select(Job)
            .where(
                Job.user_id == user.id, Job.kind == "email", Job.key.like(values["purpose"] + ":%")
            )
            .order_by(Job.available_at.desc())
        )
        print(json.dumps(job.payload if job else None))
    elif action == "materialize":
        from types import SimpleNamespace

        from planner.jobs import materialize

        materialize(db, SimpleNamespace(user_id=user.id))
    elif action == "assistant":
        from planner.models import AIRun

        row = AIRun(
            user_id=user.id, prompt=values["prompt"], status="running", model="browser-fixture"
        )
        db.add(row)
        db.flush()
        print(json.dumps({"id": row.id, "status": row.status}))
    elif action in ("assistant-roadmap", "assistant-complete-task"):
        from planner import ai, planning
        from planner.assistant_tools import ToolSession
        from planner.models import AIRun

        tool = ToolSession(user.id, values["prompt"], user.timezone, {})
        if action == "assistant-roadmap":
            area = planning.owned(db, "areas", values["area_id"], user.id, active=True)
            result = tool.execute(
                db,
                "create_roadmap",
                {
                    "goal": {"title": "Learn backend", "area_id": area.id},
                    "milestones": [
                        {"title": "Inspect the project", "tasks": [{"title": "Trace a request"}]},
                        {
                            "title": "Improve the project",
                            "tasks": [{"title": "Write a regression"}],
                        },
                    ],
                },
            )
        else:
            result = tool.execute(db, "complete_task", {"id": values["task_id"]})
        if "error" in result:
            raise RuntimeError(result["error"])
        payload = {"operations": tool.operations}
        row = AIRun(
            user_id=user.id,
            prompt=values["prompt"],
            answer="Ready for confirmation",
            status="completed",
            model="browser-fixture",
            proposal=payload,
            proposal_hash=ai.canonical_hash(payload),
            proposal_expires=now() + timedelta(hours=1),
            sources=list(tool.references.values()),
        )
        db.add(row)
        db.flush()
        print(json.dumps({"id": row.id, "status": row.status}))
    elif action == "assistant-complete":
        from planner.models import AIRun

        row = db.scalar(select(AIRun).where(AIRun.id == values["id"], AIRun.user_id == user.id))
        if row is None:
            raise RuntimeError("Unknown owned fixture run")
        row.status, row.answer = "completed", values["answer"]
    elif action == "totp":
        secret = cipher().decrypt(user.totp_secret.encode()).decode()
        print(json.dumps({"code": totp_code(secret, int(now().timestamp()))}))
    else:
        raise RuntimeError("Unknown fixture action")
    db.commit()
