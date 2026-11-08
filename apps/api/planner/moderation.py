"""Account-scoped reports and explicitly authorized administrator actions."""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import EmailStr, Field
from sqlalchemy import delete, select

from planner import planning, schemas
from planner.auth import DB, Auth, lock_owner, password_matches
from planner.db import Base
from planner.models import (
    AccountFile,
    AdminAction,
    Attachment,
    Job,
    LoginSession,
    Note,
    NoteShare,
    Notification,
    Report,
    SystemSetting,
    User,
    new_id,
)

router = APIRouter(prefix="/api/v1")


def administrator(auth):
    if auth.user.role != "admin":
        raise HTTPException(404, "Not found")


def notify(db, user_id, message, destination="notifications"):
    db.add(
        Notification(
            user_id=user_id,
            key="notice:" + new_id(),
            message=message[:500],
            details={"destination": destination},
        )
    )


class ReportInput(schemas.Strict):
    kind: Literal["note", "user"] = "user"
    target: str = Field(min_length=1, max_length=320)
    reason: str = Field(min_length=10, max_length=2000)
    evidence: list[str] = Field(default_factory=list, max_length=3)


@router.post("/reports", status_code=201)
def report(body: ReportInput, auth: Auth, db: DB):
    from planner.auth import limit

    limit(db, "report:" + auth.user.id, 10, 3600)
    lock_owner(db, auth.user.id)
    note, snapshot = None, ""
    if body.kind == "note":
        note = planning.access_note(db, body.target, auth)
        target = db.get(User, note.user_id)
        snapshot = note.title + "\n\n" + note.content
    else:
        target = db.scalar(select(User).where(User.email == body.target.strip().lower()))
    if target is None:
        raise HTTPException(422, "No account with this email")
    if target.id == auth.user.id:
        raise HTTPException(422, "You cannot report yourself")
    for file_id in body.evidence:
        if (
            db.scalar(
                select(AccountFile.id).where(
                    AccountFile.id == file_id,
                    AccountFile.user_id == auth.user.id,
                    AccountFile.purpose == "evidence",
                )
            )
            is None
        ):
            raise HTTPException(404, "Not found")
    if db.scalar(
        select(Report.id).where(
            Report.reporter_id == auth.user.id,
            Report.target_user_id == target.id,
            Report.status == "open",
        )
    ):
        raise HTTPException(409, "A report is already awaiting review")
    row = Report(
        reporter_id=auth.user.id,
        target_user_id=target.id,
        note_id=note.id if note else None,
        kind=body.kind,
        target=target.email,
        snapshot=snapshot,
        reason=body.reason,
        evidence=body.evidence,
    )
    db.add(row)
    for admin in db.scalars(select(User).where(User.role == "admin", User.locked_at.is_(None))):
        notify(db, admin.id, "A new report needs review", "admin")
    db.commit()
    return {"id": row.id}


def report_values(row, db):
    owner = db.get(User, row.target_user_id) if row.target_user_id else None
    reporter = db.get(User, row.reporter_id) if row.reporter_id else None
    return {
        "id": row.id,
        "kind": row.kind,
        "target": row.note_id or row.target,
        "owner": owner.id if owner else "",
        "owner_name": owner.name if owner else row.target,
        "reporter": reporter.name if reporter else "Deleted account",
        "reporter_id": row.reporter_id,
        "reason": row.reason,
        "evidence": ["/api/v1/account-files/" + v for v in row.evidence],
        "snapshot": row.snapshot,
        "state": row.status,
        "actions": row.actions,
        "reply": row.reply,
    }


@router.get("/reports")
def reports(auth: Auth, db: DB):
    return [
        report_values(row, db)
        for row in db.scalars(
            select(Report)
            .where(Report.reporter_id == auth.user.id)
            .order_by(Report.created_at.desc())
        )
    ]


@router.get("/admin/state")
def admin_state(auth: Auth, db: DB):
    administrator(auth)
    policy = db.get(SystemSetting, "registration")
    history = db.get(SystemSetting, "history_limit")
    return {
        "history_limit": history.value.get("limit", 1000) if history else 1000,
        "members": [
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "admin": user.role == "admin",
                "locked": bool(user.locked_at),
                "warned": bool(user.profile.get("warned")),
            }
            for user in db.scalars(select(User).order_by(User.created_at))
        ],
        "reports": [
            report_values(row, db)
            for row in db.scalars(select(Report).order_by(Report.created_at.desc()))
        ],
        "registration": policy.value.get("mode", "open") if policy else "open",
        "invitations": policy.value.get("invitations", []) if policy else [],
        "log": [
            {"id": row.id, "title": row.action + ": " + row.subject, "at": row.created_at}
            for row in db.scalars(select(AdminAction).order_by(AdminAction.created_at.desc()))
        ],
    }


class Resolve(schemas.Strict):
    state: Literal["resolved", "dismissed"]
    actions: list[Literal["warn", "lock", "revoke_shares"]] = Field(default_factory=list)
    reply: str = Field(default="", max_length=2000)


def set_locked(db, user, actor, locked, reason=""):
    if user.id == actor.id or user.role == "admin":
        raise HTTPException(422, "Administrators and yourself cannot be locked here")
    from planner.models import now

    user.locked_at = now() if locked else None
    user.profile = {
        **user.profile,
        "locked_by": actor.name if locked else "",
        "lock_reason": reason if locked else "",
    }
    if locked:
        db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.add(
        AdminAction(
            actor_id=actor.id,
            action="Locked account" if locked else "Unlocked account",
            subject=user.email,
        )
    )


@router.post("/admin/reports/{report_id}/resolve")
def resolve_report(report_id: str, body: Resolve, auth: Auth, db: DB):
    administrator(auth)
    row = db.get(Report, report_id)
    if row is None:
        raise HTTPException(404, "Not found")
    for user_id in sorted({value for value in (row.target_user_id, row.reporter_id) if value}):
        lock_owner(db, user_id)
    row = db.scalar(
        select(Report)
        .where(Report.id == report_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row.status != "open":
        raise HTTPException(409, "This report has already been reviewed")
    target = db.get(User, row.target_user_id) if row.target_user_id else None
    if body.state == "resolved" and target and not target.locked_at and not body.actions:
        raise HTTPException(422, "Choose an action before resolving")
    if body.state == "dismissed" and body.actions:
        raise HTTPException(422, "Dismiss takes no moderation action")
    if target:
        lock_owner(db, target.id)
        if "lock" in body.actions:
            set_locked(db, target, auth.user, True, row.reason)
        if "warn" in body.actions:
            target.profile = {**target.profile, "warned": True}
            notify(db, target.id, body.reply or "Please follow the community rules")
        if "revoke_shares" in body.actions:
            db.execute(
                delete(NoteShare).where(
                    NoteShare.note_id.in_(select(Note.id).where(Note.user_id == target.id))
                )
            )
    row.status, row.actions, row.reply = body.state, body.actions, body.reply
    if row.reporter_id:
        notify(db, row.reporter_id, "Your report was reviewed: " + body.state, "reports")
    db.add(AdminAction(actor_id=auth.user.id, action="Reviewed report", subject=row.id))
    db.commit()
    return {"state": row.status}


class AccountLock(schemas.Strict):
    locked: bool
    reason: str = Field(default="", max_length=2000)


@router.put("/admin/users/{user_id}/lock")
def lock_account(user_id: str, body: AccountLock, auth: Auth, db: DB):
    administrator(auth)
    lock_owner(db, user_id)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Not found")
    set_locked(db, user, auth.user, body.locked, body.reason)
    db.commit()
    return {"locked": bool(user.locked_at)}


class Registration(schemas.Strict):
    mode: Literal["open", "invitation", "closed"]
    invitations: list[EmailStr] = Field(default_factory=list, max_length=1000)


@router.put("/admin/registration")
def registration(body: Registration, auth: Auth, db: DB):
    administrator(auth)
    lock_owner(db, auth.user.id)
    values = {
        "mode": body.mode,
        "invitations": list(dict.fromkeys(str(email).lower() for email in body.invitations)),
    }
    row = db.scalar(
        select(SystemSetting).where(SystemSetting.key == "registration").with_for_update()
    )
    if row:
        row.value = values
    else:
        db.add(SystemSetting(key="registration", value=values))
    db.add(
        AdminAction(actor_id=auth.user.id, action="Updated registration policy", subject=body.mode)
    )
    db.commit()
    return values


def delete_account(db, user, actor_id=None):
    if user.role == "admin":
        raise HTTPException(422, "Remove the administrator role with the server console first")
    retained = {file_id for report in db.scalars(select(Report)) for file_id in report.evidence}
    files = list(db.scalars(select(AccountFile).where(AccountFile.user_id == user.id)))
    keys = [
        row.storage_key
        for row in db.scalars(select(Attachment).where(Attachment.user_id == user.id))
    ]
    keys += [row.storage_key for row in files if row.id not in retained]
    for row in files:
        if row.id in retained:
            row.user_id = None
    db.flush()
    # Reverse FK order removes personal graph rows, not the immutable migration archive.
    for table in reversed(Base.metadata.sorted_tables):
        if table.name != "users" and "user_id" in table.c:
            db.execute(table.delete().where(table.c.user_id == user.id))
    email = user.email
    db.delete(user)
    for key in keys:
        db.add(
            Job(
                user_id=None,
                kind="delete-file",
                key="delete-file:" + new_id(),
                payload={"key": key},
            )
        )
    db.add(AdminAction(actor_id=actor_id, action="Deleted account", subject=email))
    db.flush()


class DeleteAccount(schemas.Strict):
    confirm_email: EmailStr
    current_password: str = Field(default="", max_length=128)


@router.delete("/admin/users/{user_id}", status_code=204)
def admin_delete_account(user_id: str, body: DeleteAccount, auth: Auth, db: DB):
    administrator(auth)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Not found")
    lock_owner(db, user_id)
    if str(body.confirm_email).strip().lower() != user.email:
        raise HTTPException(422, "Type the account email to confirm deletion")
    delete_account(db, user, auth.user.id)
    db.commit()


@router.delete("/auth/account", status_code=204)
def self_delete_account(body: DeleteAccount, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    if str(body.confirm_email).strip().lower() != auth.user.email or not password_matches(
        body.current_password, auth.user.password_hash
    ):
        raise HTTPException(403, "Email or current password is incorrect")
    delete_account(db, auth.user)
    db.commit()


class HistoryLimit(schemas.Strict):
    limit: int = Field(ge=1, le=100000)


@router.put("/admin/history")
def history_limit(body: HistoryLimit, auth: Auth, db: DB):
    administrator(auth)
    lock_owner(db, auth.user.id)
    row = db.get(SystemSetting, "history_limit")
    if row:
        row.value = {"limit": body.limit}
    else:
        db.add(SystemSetting(key="history_limit", value={"limit": body.limit}))
    db.add(
        AdminAction(actor_id=auth.user.id, action="Updated history cap", subject=str(body.limit))
    )
    db.commit()
    return {"limit": body.limit}
