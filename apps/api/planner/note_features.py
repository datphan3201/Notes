"""Note invitations, private attachment removal and durable read-only summaries."""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from planner import ai, planning, schemas
from planner.auth import DB, Auth, lock_owner
from planner.models import Attachment, Job, Note, NoteShare, User
from planner.moderation import notify

router = APIRouter(prefix="/api/v1")


@router.get("/notes/invitations")
def invitations(auth: Auth, db: DB):
    rows = db.execute(
        select(NoteShare, Note, User)
        .join(Note, Note.id == NoteShare.note_id)
        .join(User, User.id == Note.user_id)
        .where(
            NoteShare.user_id == auth.user.id,
            NoteShare.status == "pending",
            Note.archived_at.is_(None),
            User.locked_at.is_(None),
        )
    ).all()
    return [
        {
            "note_id": note.id,
            "title": "Locked Note" if note.lock_hash else note.title,
            "owner": owner.name,
            "can_edit": share.can_edit,
        }
        for share, note, owner in rows
    ]


@router.post("/notes/{note_id}/invitations", status_code=201)
def invite(note_id: str, body: schemas.Share, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    planning.access_note(db, note_id, auth, owner_only=True)
    recipient = db.scalar(
        select(User).where(User.email == str(body.email).lower(), User.locked_at.is_(None))
    )
    if recipient is None or recipient.id == auth.user.id:
        raise HTTPException(422, "Choose another registered account")
    existing = db.get(NoteShare, (note_id, recipient.id))
    if existing:
        existing.can_edit = body.can_edit
    else:
        db.add(
            NoteShare(
                note_id=note_id, user_id=recipient.id, can_edit=body.can_edit, status="pending"
            )
        )
        if recipient.preferences.get("show_shares", True):
            notify(db, recipient.id, auth.user.name + " invited you to a shared Note", "notes")
        if recipient.preferences.get("email_notifications", True) and recipient.preferences.get(
            "show_shares", True
        ):
            from planner.config import settings

            planning.enqueue(
                db,
                recipient.id,
                "email",
                "share:" + note_id + ":" + recipient.id,
                {
                    "to": recipient.email,
                    "subject": "Planner — Note invitation",
                    "category": "sharing",
                    "body": auth.user.name
                    + " invited you to read a Note.\n"
                    + settings().web_origin,
                },
            )
    db.commit()
    return {"id": recipient.id, "status": existing.status if existing else "pending"}


@router.post("/notes/{note_id}/invitations/{decision}", status_code=204)
def respond_invitation(note_id: str, decision: str, auth: Auth, db: DB):
    if decision not in ("accept", "decline"):
        raise HTTPException(404, "Not found")
    row = db.get(NoteShare, (note_id, auth.user.id))
    note = db.get(Note, note_id)
    owner = db.get(User, note.user_id) if note else None
    if (
        row is None
        or row.status != "pending"
        or owner is None
        or owner.locked_at
        or note.archived_at
    ):
        raise HTTPException(404, "Not found")
    if decision == "accept":
        row.status = "accepted"
        notify(db, note.user_id, auth.user.name + " joined your shared Note", "notes")
    else:
        db.delete(row)
    db.commit()


@router.delete("/notes/{note_id}/leave", status_code=204)
def leave_note(note_id: str, auth: Auth, db: DB):
    row = db.get(NoteShare, (note_id, auth.user.id))
    if row is None:
        raise HTTPException(404, "Not found")
    db.delete(row)
    db.commit()


@router.get("/contacts")
def contacts(auth: Auth, db: DB):
    notes = list(db.scalars(select(Note.id).where(Note.user_id == auth.user.id)))
    ids = set(
        db.scalars(
            select(NoteShare.user_id).where(
                NoteShare.note_id.in_(notes), NoteShare.status == "accepted"
            )
        )
    )
    ids |= set(
        db.scalars(
            select(Note.user_id)
            .join(NoteShare, NoteShare.note_id == Note.id)
            .where(NoteShare.user_id == auth.user.id, NoteShare.status == "accepted")
        )
    )
    return [
        {"id": u.id, "email": u.email, "display_name": u.name}
        for u in db.scalars(
            select(User).where(User.id.in_(ids), User.locked_at.is_(None)).order_by(User.name)
        )
    ]


@router.delete("/notes/{note_id}/attachments/{file_id}", status_code=204)
def remove_attachment(note_id: str, file_id: str, auth: Auth, db: DB):
    note = planning.access_note(db, note_id, auth, write=True)
    lock_owner(db, note.user_id)
    row = db.scalar(
        select(Attachment).where(Attachment.id == file_id, Attachment.note_id == note_id)
    )
    if row is None:
        raise HTTPException(404, "Not found")
    if note.details.get("background_id") == file_id:
        note.details = {**note.details, "background_id": None}
        note.version += 1
    planning.enqueue(
        db, row.user_id, "delete-file", "delete-file:" + row.id, {"key": row.storage_key}
    )
    db.delete(row)
    db.commit()


@router.post("/notes/{note_id}/summary", status_code=202)
def summarize(note_id: str, auth: Auth, db: DB):
    note = planning.access_note(db, note_id, auth, owner_only=True)
    if note.lock_hash:
        raise HTTPException(403, "Password-protected Notes are excluded from AI")
    run = ai.start_run(
        db,
        auth.user.id,
        "Summarize this Note accurately in the account language. Do not propose changes.",
    )
    job = db.scalar(select(Job).where(Job.key == "assistant:" + run.id))
    job.payload = {
        **job.payload,
        "note_id": note.id,
        "source_version": note.version,
        "save_summary": True,
    }
    db.commit()
    return {"id": run.id}


@router.delete("/notes/{note_id}/summary", status_code=204)
def clear_summary(note_id: str, auth: Auth, db: DB):
    note = planning.access_note(db, note_id, auth, owner_only=True)
    note.details = {
        key: value
        for key, value in note.details.items()
        if key not in ("summary", "summary_version")
    }
    db.commit()


class NoteQuestion(schemas.Strict):
    prompt: str = schemas.Field(min_length=1, max_length=4000)


@router.post("/notes/{note_id}/questions", status_code=202)
def question(note_id: str, body: NoteQuestion, auth: Auth, db: DB):
    note = planning.access_note(db, note_id, auth, owner_only=True)
    if note.lock_hash:
        raise HTTPException(403, "Password-protected Notes are excluded from AI")
    run = ai.start_run(db, auth.user.id, body.prompt)
    job = db.scalar(select(Job).where(Job.key == "assistant:" + run.id))
    job.payload = {**job.payload, "note_id": note.id, "source_version": note.version}
    db.commit()
    return {"id": run.id}
