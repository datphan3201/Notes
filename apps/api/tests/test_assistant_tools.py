"""Real PostgreSQL tool compilation, approval, graph writes and isolation."""

import json
from datetime import timedelta

from pydantic import SecretStr
from sqlalchemy import func, select
from test_boundaries import make

from planner import ai
from planner.assistant_tools import ToolSession, catalogue
from planner.config import settings
from planner.db import session_factory
from planner.jobs import process_one
from planner.models import (
    Activity,
    AIRun,
    Dependency,
    Goal,
    Job,
    Note,
    Task,
    now,
)


def owner_id(client):
    return client.get("/api/v1/auth/me").json()["user"]["id"]


def compiler(client, db, question="Create a learning roadmap", timezone="Asia/Ho_Chi_Minh"):
    return ToolSession(owner_id(client), question, timezone, {})


def save(db, tool):
    payload = {"operations": tool.operations}
    run = AIRun(
        user_id=tool.user_id,
        prompt=tool.question,
        answer="Ready to confirm",
        status="completed",
        sources=list(tool.references.values()),
        proposal=payload,
        proposal_hash=ai.canonical_hash(payload),
        proposal_expires=now() + timedelta(hours=1),
    )
    db.add(run)
    db.commit()
    return run


def apply(client, run, status=200, acknowledgements=()):
    response = client.post(
        f"/api/v1/assistant/runs/{run.id}/apply",
        json={"proposal_hash": run.proposal_hash, "acknowledgements": list(acknowledgements)},
    )
    assert response.status_code == status, response.text
    return response


def test_named_tools_match_baseline_actions():
    names = {t["function"]["name"] for t in catalogue()}
    assert {
        "list_areas",
        "get_roadmap",
        "create_roadmap",
        "create_milestones",
        "create_tasks",
        "move_tasks",
        "reschedule",
        "check_in_habit",
    } <= names
    for kind in ["goal", "milestone", "task", "habit", "note"]:
        assert {"update_" + kind, "delete_" + kind} <= names
    for kind in ["goal", "milestone", "task"]:
        assert {"complete_" + kind, "reopen_" + kind} <= names


def test_worker_named_tools_queue_one_roadmap_and_apply_graph_once(client, db, monkeypatch):
    make(client, "areas")
    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("synthetic-key"))
    monkeypatch.setattr(settings(), "ai_model", "synthetic-tools")

    class RoadmapProvider:
        def __init__(self):
            self.step = 0

        def stream(self, messages, publish):
            step = self.step
            self.step += 1
            if step == 0:
                name, args = "list_areas", {}
            elif step == 1:
                areas = json.loads(messages[-1]["content"])["areas"]
                name, args = (
                    "create_roadmap",
                    {
                        "goal": {"title": "Software Engineering", "area_id": areas[0]["id"]},
                        "milestones": [
                            {
                                "title": "Inspect a project",
                                "tasks": [{"title": "Run locally"}, {"title": "Trace one request"}],
                            },
                            {
                                "title": "Improve it",
                                "tasks": [
                                    {"title": "Write a regression"},
                                    {"title": "Ship a change"},
                                ],
                            },
                        ],
                    },
                )
            else:
                assert (
                    json.loads(messages[-1]["content"])["status"] == "queued_for_user_confirmation"
                )
                publish("Roadmap ready for confirmation.")
                return {"role": "assistant", "content": "Roadmap ready for confirmation."}, {
                    "prompt_tokens": 100,
                    "completion_tokens": 20,
                }
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": f"call{step}",
                        "type": "function",
                        "function": {"name": name, "arguments": json.dumps(args)},
                    }
                ],
            }, {"prompt_tokens": 100, "completion_tokens": 50}

    response = client.post(
        "/api/v1/assistant/runs",
        json={"prompt": "Create a Software Engineering roadmap with Milestones and Tasks"},
    )
    assert response.status_code == 202
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == "assistant:" + run_id))
    assert process_one(session_factory(), RoadmapProvider(), job.id)
    preview = client.get("/api/v1/assistant/runs/" + run_id)
    assert preview.status_code == 200
    assert (
        preview.json()["status"] == "completed"
        and len(preview.json()["proposal"]["operations"]) == 8
    )
    assert client.get("/api/v1/goals").json()["items"] == []
    run = db.get(AIRun, run_id)
    apply(client, run)
    assert len(client.get("/api/v1/goals").json()["items"]) == 1
    milestones = client.get("/api/v1/milestones").json()["items"]
    tasks = client.get("/api/v1/tasks").json()["items"]
    assert len(milestones) == 2 and len(tasks) == 4
    assert {t["milestone_id"] for t in tasks} == {m["id"] for m in milestones}
    assert db.scalar(select(func.count()).select_from(Dependency)) == 1
    apply(client, run)
    assert db.scalar(select(func.count()).select_from(Task)) == 4


def test_roadmap_refs_are_namespaced_per_proposal_and_literal_text_is_preserved(client, db):
    area = make(client, "areas")
    for title in ["First outcome", "Second outcome"]:
        tool = compiler(client, db)
        result = tool.execute(
            db,
            "create_roadmap",
            {
                "goal": {"title": title, "area_id": area["id"]},
                "milestones": [
                    {"title": "Checkpoint", "tasks": [{"title": "c1", "content": "literal c1"}]}
                ],
            },
        )
        assert "error" not in result
        apply(client, save(db, tool))
    assert db.scalar(select(func.count()).select_from(Goal)) == 2
    assert [t.content for t in db.scalars(select(Task))] == ["literal c1", "literal c1"]


def test_invalid_roadmap_never_leaves_partial_operations_or_business_data(client, db):
    area = make(client, "areas")
    tool = compiler(client, db)
    result = tool.execute(
        db,
        "create_roadmap",
        {
            "goal": {"title": "No partial graph", "area_id": area["id"]},
            "milestones": [
                {"title": "Valid", "tasks": [{"title": "OK"}]},
                {"title": "Invalid", "tasks": [{"title": ""}]},
            ],
        },
    )
    assert "error" in result and tool.operations == [] and tool.locals == {}
    assert db.scalar(select(func.count()).select_from(Goal)) == 0
    goal = make(client, "goals", area_id=area["id"])
    assert "error" in tool.execute(
        db, "create_goal", {"title": goal["title"], "area_id": area["id"]}
    )
    assert tool.operations == []
    tool.question = "Create Milestones for this Goal"
    assert "error" in tool.execute(
        db, "create_goal", {"title": "Phase pretending to be a Goal", "parent_goal_id": goal["id"]}
    )


def test_reads_and_relationships_are_owned_and_locked_notes_are_excluded(client, stranger, db):
    mine = make(client, "notes", title="Own source")
    foreign = make(stranger, "notes", title="Other account")
    protected = make(client, "notes", title="Hidden source")
    db.get(Note, protected["id"]).lock_hash = "protected"
    db.commit()
    tool = compiler(client, db)
    result = tool.execute(db, "search_notes", {"query": ""})
    assert [item["id"] for item in result["notes"]] == [mine["id"]]
    for identifier in [foreign["id"], protected["id"]]:
        assert "error" in tool.execute(db, "get_note", {"id": identifier})
        assert "error" in tool.execute(
            db, "update_note", {"id": identifier, "content": "Forbidden"}
        )
    area = make(stranger, "areas")
    assert "error" in tool.execute(
        db, "create_goal", {"title": "Foreign parent", "area_id": area["id"]}
    )
    assert tool.operations == []


def test_move_existing_tasks_to_new_milestones_keeps_identity_checklist_and_version_guards(
    client, db
):
    area = make(client, "areas")
    goal = make(client, "goals", area_id=area["id"])
    task = make(
        client, "tasks", title="Existing work", checklist=[{"text": "Keep me", "checked": True}]
    )
    tool = compiler(client, db, question="Move the existing Task into phases")
    result = tool.execute(
        db, "create_milestones", {"goal_id": goal["id"], "milestones": [{"title": "First phase"}]}
    )
    ref = result["created"][0]["ref"]
    assert "error" not in tool.execute(
        db, "move_tasks", {"task_ids": [task["id"]], "milestone_id": ref}
    )
    run = save(db, tool)
    apply(client, run)
    moved = client.get("/api/v1/tasks/" + task["id"]).json()
    assert moved["id"] == task["id"] and moved["checklist"] == task["checklist"]
    assert moved["milestone_id"] and moved["goal_id"] is None
    stale = compiler(client, db)
    stale.execute(db, "update_task", {"id": task["id"], "title": "Stale proposal"})
    run = save(db, stale)
    client.patch(
        "/api/v1/tasks/" + task["id"],
        json={"version": moved["version"], "fields": {"title": "Current edit"}},
    )
    apply(client, run, 409)
    assert client.get("/api/v1/tasks/" + task["id"]).json()["title"] == "Current edit"


def test_transition_requires_explicit_ack_and_habit_checkin_uses_normal_domain(client, db):
    task = make(client, "tasks", checklist=[{"text": "Still open", "checked": False}])
    habit = make(client, "habits", timezone="Asia/Ho_Chi_Minh")
    tool = compiler(client, db)
    assert "error" not in tool.execute(db, "complete_task", {"id": task["id"]})
    assert "error" not in tool.execute(db, "check_in_habit", {"id": habit["id"]})
    run = save(db, tool)
    apply(client, run, 422)
    assert client.get("/api/v1/tasks/" + task["id"]).json()["status"] == "todo"
    apply(client, run, acknowledgements=["unchecked"])
    assert client.get("/api/v1/tasks/" + task["id"]).json()["checklist"][0]["checked"] is False
    before = db.scalar(select(func.count()).select_from(Activity))
    apply(client, run, acknowledgements=["unchecked"])
    assert db.scalar(select(func.count()).select_from(Activity)) == before


def test_reschedule_keeps_clock_times_across_dst_and_rejects_partial_batch(client, db):
    task = make(
        client,
        "tasks",
        due_date="2027-03-13",
        scheduled_at="2027-03-13T14:00:00Z",
        scheduled_end="2027-03-13T15:00:00Z",
    )
    completed = make(client, "tasks", status="done")
    tool = compiler(client, db, timezone="America/New_York")
    assert "error" in tool.execute(
        db,
        "reschedule",
        {
            "items": [{"type": "task", "id": task["id"]}, {"type": "task", "id": completed["id"]}],
            "shift_days": 1,
        },
    )
    assert tool.operations == []
    assert "error" not in tool.execute(
        db, "reschedule", {"items": [{"type": "task", "id": task["id"]}], "shift_days": 1}
    )
    apply(client, save(db, tool))
    moved = client.get("/api/v1/tasks/" + task["id"]).json()
    assert moved["due_date"] == "2027-03-14"
    assert moved["scheduled_at"].startswith("2027-03-14T13:00:00")


def test_note_delete_and_append_are_real_confirmed_operations(client, db):
    note = make(client, "notes", content="Original")
    tool = compiler(client, db)
    tool.execute(db, "update_note", {"id": note["id"], "append_content": "One"})
    tool.execute(db, "update_note", {"id": note["id"], "append_content": "Two"})
    apply(client, save(db, tool))
    assert client.get("/api/v1/notes/" + note["id"]).json()["content"] == "Original\nOne\nTwo"
    tool = compiler(client, db, question="Delete this Note")
    tool.execute(db, "delete_note", {"id": note["id"]})
    run = save(db, tool)
    assert client.get("/api/v1/notes/" + note["id"]).status_code == 200
    apply(client, run)
    assert client.get("/api/v1/notes/" + note["id"]).status_code == 404


def test_restructure_guard_withdraws_delete_and_milestone_delete_accepts_queued_moves(client, db):
    area = make(client, "areas")
    goal = make(client, "goals", area_id=area["id"])
    milestone = make(client, "milestones", goal_id=goal["id"])
    task = make(client, "tasks", title="Preserve identity", milestone_id=milestone["id"])
    tool = compiler(client, db, question="Move existing work into phases")
    tool.execute(db, "delete_task", {"id": task["id"]})
    assert "error" in tool.execute(
        db, "create_tasks", {"tasks": [{"title": "Preserve identity", "goal_id": goal["id"]}]}
    )
    assert tool.operations == []
    assert "error" not in tool.execute(
        db, "move_tasks", {"task_ids": [task["id"]], "goal_id": goal["id"]}
    )
    assert "error" not in tool.execute(db, "delete_milestone", {"id": milestone["id"]})
    apply(client, save(db, tool))
    assert client.get("/api/v1/tasks/" + task["id"]).json()["goal_id"] == goal["id"]
    assert client.get("/api/v1/milestones/" + milestone["id"]).json()["archived_at"] is not None


def test_reject_is_hash_bound_owned_persistent_and_blocks_apply(client, stranger, db):
    tool = compiler(client, db)
    assert "error" not in tool.execute(db, "create_note", {"title": "Rejected draft"})
    run = save(db, tool)
    url = f"/api/v1/assistant/runs/{run.id}/reject"
    assert stranger.post(url, json={"proposal_hash": run.proposal_hash}).status_code == 404
    assert client.post(url, json={"proposal_hash": "0" * 64}).status_code == 409
    assert client.post(url, json={"proposal_hash": run.proposal_hash}).status_code == 204
    assert client.post(url, json={"proposal_hash": run.proposal_hash}).status_code == 204
    assert client.get("/api/v1/assistant/runs").json()["items"][0]["status"] == "rejected"
    apply(client, run, 409)
    assert client.get("/api/v1/notes").json()["items"] == []


def test_worker_drops_proposal_when_recreation_guard_withdraws_all_changes(client, db, monkeypatch):
    task = make(client, "tasks", title="Keep my task identity")
    monkeypatch.setattr(settings(), "ai_api_key", SecretStr("synthetic-key"))
    monkeypatch.setattr(settings(), "ai_model", "synthetic-tools")

    class RestructureProvider:
        def __init__(self):
            self.step = 0

        def stream(self, messages, publish):
            step = self.step
            self.step += 1
            if step == 0:
                name, args = "delete_task", {"id": task["id"]}
            elif step == 1:
                name, args = "create_tasks", {"tasks": [{"title": task["title"]}]}
            else:
                assert "withdrawn" in json.loads(messages[-1]["content"])["error"]
                publish("The original Task remains unchanged.")
                return {"role": "assistant", "content": "No changes queued."}, {}
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": f"call{step}",
                        "type": "function",
                        "function": {"name": name, "arguments": json.dumps(args)},
                    }
                ],
            }, {}

    response = client.post("/api/v1/assistant/runs", json={"prompt": "Restructure my Tasks"})
    assert response.status_code == 202
    run_id = response.json()["id"]
    job = db.scalar(select(Job).where(Job.key == "assistant:" + run_id))
    assert process_one(session_factory(), RestructureProvider(), job.id)
    result = client.get("/api/v1/assistant/runs/" + run_id).json()
    assert result["status"] == "completed" and result["proposal"] is None
    assert client.get("/api/v1/tasks/" + task["id"]).json()["version"] == 1
