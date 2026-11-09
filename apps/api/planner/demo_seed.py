"""Provision one new, clearly synthetic account with two calendar months of history."""

import argparse
import calendar
import hashlib
import json
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url

from planner import planning
from planner.auth import passwords
from planner.config import settings
from planner.db import session_factory
from planner.models import (
    Activity,
    AdminAction,
    Dependency,
    Document,
    Focus,
    HabitDay,
    Notification,
    TaskSelection,
    User,
    now,
)
from planner.schemas import Register
from planner.workspace import review_snapshot

ZONE = ZoneInfo("Asia/Ho_Chi_Minh")
MARKER = "two-month-roadmap-v1"
PHASES = (
    "Python và HTTP",
    "FastAPI và API cơ bản",
    "PostgreSQL và thiết kế dữ liệu",
    "Đăng nhập và phân quyền",
    "Giao dịch và xử lý nền",
    "React và trải nghiệm người dùng",
    "Kiểm thử và triển khai",
    "Hoàn thiện và tổng kết",
)


def history_start(as_of):
    month = as_of.year * 12 + as_of.month - 3
    year, index = divmod(month, 12)
    return date(year, index + 1, min(as_of.day, calendar.monthrange(year, index + 1)[1]))


def verify_target(db, expected_database, expected_schema):
    actual = db.execute(text("SELECT current_database(), current_schema() ")).one()
    if tuple(actual) != (expected_database, expected_schema):
        raise ValueError("Connected database/schema does not match the explicitly selected target")
    if db.scalar(text("SELECT version_num FROM alembic_version")) != "0006":
        raise ValueError("Demo requires the current 0006 schema; no migrations were performed")


def seed_account(db, email, password, as_of):
    """Caller owns the transaction. No reset, existing-user writes or external side effects."""
    identity = Register(email=email, password=password, name="Roadmap Demo · Dữ liệu giả lập")
    email = str(identity.email).lower()
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": "demo:" + email}
    )
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise ValueError("Email already exists; existing accounts are never reset or modified")
    first = history_start(as_of)
    last = as_of - timedelta(days=1)
    days = [first + timedelta(days=i) for i in range((as_of - first).days)]

    def stamp(day, hour=9):
        return datetime.combine(day, time(hour), ZONE)

    user = User(
        email=email,
        name=identity.name,
        password_hash=passwords.hash(password),
        email_verified_at=now(),
        created_at=stamp(first),
        timezone=ZONE.key,
        locale="vi",
        role="user",
        profile={
            "bio": "Tài khoản thử nghiệm. Toàn bộ lịch sử là dữ liệu giả lập.",
            "demo_fixture": {"version": MARKER, "first": str(first), "last": str(last)},
        },
        preferences={
            "visual_theme": "mountain",
            "show_reminders": False,
            "email_notifications": False,
            "history_completed_hours": 168,
            "history_overdue_days": 14,
        },
    )
    db.add(user)
    db.flush()
    rows = {kind: [] for kind in planning.MODELS}

    def add(kind, day, **fields):
        values = planning.validated(kind, fields)
        planning.validate_relations(db, kind, user.id, values)
        model = planning.MODELS[kind]
        columns = set(model.__table__.columns.keys())
        row = model(
            user_id=user.id,
            created_at=stamp(day),
            updated_at=stamp(day, 18),
            details={
                **{k: v for k, v in values.items() if k not in columns},
                "demo_fixture": MARKER,
            },
            **{k: v for k, v in values.items() if k in columns},
        )
        db.add(row)
        db.flush()
        rows[kind].append(row)
        return row

    areas = [
        add("areas", first, title=title, icon=icon, importance=importance)
        for title, icon, importance in [
            ("Học tập và nghề nghiệp", "code", 5),
            ("Sức khỏe", "heart", 4),
            ("Dự án cá nhân", "rocket", 3),
        ]
    ]
    goals = [
        add(
            "goals",
            first,
            title=title,
            area_id=area.id,
            start_date=first,
            due_date=last,
            status="doing",
            content="[GIẢ LẬP] Mục tiêu hai tháng để thử nghiệm Planner.",
            strategy="Chia nhỏ theo tuần, thực hành mỗi ngày và nhìn lại cuối tuần.",
        )
        for title, area in zip(
            [
                "Roadmap Backend trong 2 tháng",
                "Xây dựng nếp sống khỏe",
                "Hoàn thiện portfolio cá nhân",
            ],
            areas,
            strict=True,
        )
    ]
    add(
        "goals",
        first,
        title="Luyện kỹ năng thiết kế API",
        parent_goal_id=goals[0].id,
        start_date=first,
        due_date=last,
        status="doing",
    )
    milestones = []
    for index, title in enumerate(PHASES):
        start = first + timedelta(days=index * len(days) // len(PHASES))
        end = first + timedelta(days=(index + 1) * len(days) // len(PHASES) - 1)
        milestone = add(
            "milestones",
            start,
            title=f"{index + 1}. {title}",
            goal_id=goals[0].id,
            start_date=start,
            due_date=end,
            status="done" if index < 5 else "doing" if index == 5 else "todo",
            completion_criteria="Hoàn thành bài thực hành và ghi chú rút kinh nghiệm.",
        )
        milestones.append(milestone)
        if index:
            db.add(
                Dependency(
                    user_id=user.id,
                    milestone_id=milestone.id,
                    prerequisite_id=milestones[index - 1].id,
                )
            )
    for index, day in enumerate(days):
        phase = max(i for i, milestone in enumerate(milestones) if milestone.start_date <= day)
        for slot in range(1 if day.weekday() >= 5 else 2):
            status = (
                "done"
                if index < len(days) - 12 and (index + slot) % 9
                else ("todo", "doing", "blocked")[(index + slot) % 3]
            )
            # A completed Milestone has completed Tasks; open states remain on later phases.
            if phase < 5:
                status = "done"
            task = add(
                "tasks",
                day,
                title=f"{day:%d/%m} · {'Thực hành' if slot else 'Học'} {PHASES[phase]}",
                milestone_id=milestones[phase].id,
                status=status,
                start_date=day,
                due_date=day,
                scheduled_at=stamp(day, 19 if slot else 9),
                scheduled_end=stamp(day, 20 if slot else 10),
                estimated_minutes=60,
                importance=3 + index % 3,
                checklist=[
                    {"text": "Đọc tài liệu và chuẩn bị ví dụ", "checked": True},
                    {"text": "Hoàn thành bài tập nhỏ", "checked": status == "done"},
                    {"text": "Ghi lại điều đã học", "checked": status == "done"},
                ],
                tags=["demo", "backend"],
            )
            add("notes", day, title=task.title, task_id=task.id,
                content="[GIẢ LẬP] Đã thử ví dụ, ghi nhận lỗi và các câu hỏi cần kiểm tra.")
            if status == "done":
                task.completed_at = stamp(day, 20)
                db.add(
                    Activity(
                        user_id=user.id,
                        kind="task.completed",
                        entity_id=task.id,
                        created_at=stamp(day, 20),
                    )
                )
            if index < 4:
                task.archived_at = stamp(first + timedelta(days=7), 21)
            monday = day - timedelta(days=day.weekday())
            db.add_all(
                [
                    TaskSelection(user_id=user.id, task_id=task.id, period="daily", day=day),
                    TaskSelection(user_id=user.id, task_id=task.id, period="weekly", day=monday),
                ]
            )
    for i, title in enumerate(
        [
            "Dọn README portfolio",
            "Đọc thêm về transaction",
            "Thử tạo Task từ Calendar",
            "Thử gửi đề xuất cho trợ lý AI",
        ]
    ):
        add(
            "tasks",
            last,
            title=title,
            goal_id=goals[2].id if i == 0 else None,
            status="todo",
            tags=["demo", "thử-nghiệm"],
        )
    for index, (title, frequency, target) in enumerate(
        [
            ("Đọc sách 20 phút", "daily", 1),
            ("Đi bộ 30 phút", "daily", 1),
            ("Tập thể dục 3 buổi/tuần", "weekly", 3),
        ]
    ):
        habit = add(
            "habits",
            first,
            title=title,
            frequency=frequency,
            target=target,
            timezone=ZONE.key,
            primary_goal_id=goals[1].id,
            icon="book" if index == 0 else "activity",
        )
        habit.first_check_in_at = stamp(first, 7)
        for offset, day in enumerate(days):
            if (offset + index) % 7 == 0:
                db.add(HabitDay(habit_id=habit.id, day=day, state="rest"))
            elif (offset + index) % 5 and (frequency == "daily" or day.weekday() in (0, 2, 4)):
                db.add(HabitDay(habit_id=habit.id, day=day, state="done"))
                db.add(
                    Activity(
                        user_id=user.id,
                        kind="habit.completed",
                        entity_id=habit.id,
                        created_at=stamp(day, 7),
                    )
                )
    for index in range(10):
        day = days[min(index * 6, len(days) - 1)]
        note = add(
            "notes",
            day,
            title=f"Nhật ký học tập tuần {index + 1}",
            content=f"[DỮ LIỆU GIẢ LẬP]\n\nTuần {index + 1}: {PHASES[index % len(PHASES)]}\n\n- [x] Đọc tài liệu\n- [x] Thực hành ví dụ\n- [ ] Ôn lại câu hỏi khó\n\nĐiều rút ra: chia bài tập nhỏ và kiểm tra kết quả mỗi ngày.",
            color=("sky", "mint", "lemon", "rose")[index % 4],
            pinned=index < 2,
            tags=["demo", "nhật-ký"],
            goal_id=goals[0].id,
        )
        if index == 9:
            note.lock_hash = passwords.hash(password)
    for index, state in enumerate(("active", "paused", "ended")):
        series = add(
            "task-series",
            first,
            title=f"Ôn tập định kỳ · {state}",
            frequency="weekly",
            weekdays=[1],
            start_date=first,
            end_date=last,
            state=state,
            timezone=ZONE.key,
            template={"title": "Ôn tập Backend", "goal_id": goals[0].id, "estimated_minutes": 30},
        )
        series.cursor = last
        for day in days:
            if day.weekday() != 0:
                continue
            occurrence = add(
                "tasks",
                day,
                title=f"Ôn tập tuần · {state} · {day:%d/%m}",
                goal_id=goals[0].id,
                due_date=day,
                status="done",
            )
            occurrence.series_id, occurrence.occurrence_date, occurrence.completed_at = (
                series.id,
                day,
                stamp(day, 20),
            )
            db.add(
                Activity(
                    user_id=user.id,
                    kind="task.completed",
                    entity_id=occurrence.id,
                    created_at=stamp(day, 20),
                )
            )
    db.flush()
    periods = [("weekly", day) for day in days if day.weekday() == 0]
    periods += [("monthly", day) for day in days if day.day == 1]
    periods += [("daily", day) for day in days[-7:]]
    for period, day in periods:
        review = add(
            "reviews",
            day,
            title=f"Nhìn lại {period} · {day:%d/%m}",
            period=period,
            period_date=day,
            reflection="[GIẢ LẬP] Nhìn lại tiến độ trong giai đoạn thử nghiệm.",
            went_well="Giữ nhịp học và thực hành đều đặn.",
            improve="Giảm khối lượng khi có việc phát sinh.",
            next_steps="Chia bài tập khó thành các bước nhỏ.",
            finalized=day < last - timedelta(days=7),
        )
        review.snapshot = review_snapshot(db, user.id, period, day)
        review.updated_at = stamp(
            min(
                last,
                day + timedelta(days=6 if period == "weekly" else 27 if period == "monthly" else 0),
            ),
            21,
        )
        review.created_at = review.updated_at
    db.add(Focus(user_id=user.id, goal_id=goals[0].id))
    for index in range(6):
        db.add(
            Notification(
                user_id=user.id,
                key=f"demo:{user.id}:{index}",
                message=f"[Giả lập] Nhìn lại tiến độ học tập lần {index + 1}",
                read=index < 3,
                created_at=stamp(last - timedelta(days=index)),
                details={"destination": "reviews"},
            )
        )
    # Lexical context is synthetic and ready for read tools; do not call paid providers.
    for kind in ("notes", "goals", "milestones", "tasks", "habits"):
        for row in rows[kind]:
            if row.archived_at or (kind == "notes" and row.lock_hash):
                continue
            content = f"{row.title}\n{row.content}"
            db.add(
                Document(
                    user_id=user.id,
                    source_kind=kind,
                    source_id=row.id,
                    source_version=row.version,
                    chunk=0,
                    text=content[:1200],
                    content_hash=hashlib.sha256(content.encode()).hexdigest(),
                )
            )
    db.add(AdminAction(actor_id=user.id, action="Provision synthetic demo account", subject=MARKER))
    db.flush()
    return {
        "email": email,
        "user_id": user.id,
        "synthetic": True,
        "history_first": str(first),
        "history_last": str(last),
        "timezone": ZONE.key,
        "counts": {kind: len(items) for kind, items in rows.items()},
        "note_password": "same as the demo login password",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument(
        "--as-of",
        type=date.fromisoformat,
        default=datetime.now(ZONE).date(),
        help="Exclusive end; default today in Vietnam",
    )
    parser.add_argument("--expect-database")
    parser.add_argument("--expect-schema")
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    if not args.execute:
        print(
            json.dumps(
                {
                    "plan_only": True,
                    "email": args.email,
                    "history_first": str(history_start(args.as_of)),
                    "history_last": str(args.as_of - timedelta(days=1)),
                    "features": [
                        "3 Areas",
                        "4 Goals",
                        "8 Milestones + prerequisite chain",
                        "dated Tasks/checklists/history/archive",
                        "3 Habits + check-in history",
                        "10 Notes (one password-protected)",
                        "3 TaskSeries",
                        "daily/weekly/monthly Reviews",
                        "plans/focus/notifications",
                        "lexical AI context; no provider calls",
                    ],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return
    password = os.environ.get("PLANNER_DEMO_PASSWORD", "")
    if not args.expect_database or not args.expect_schema or len(password) < 8:
        parser.error(
            "Execution requires explicit --expect-database/--expect-schema and private PLANNER_DEMO_PASSWORD (8+ characters)"
        )
    config = settings()
    if (
        make_url(config.database_url).database != args.expect_database
        or config.database_schema != args.expect_schema
    ):
        parser.error("Configured database/schema does not match the explicit target")
    with session_factory()() as db, db.begin():
        verify_target(db, args.expect_database, args.expect_schema)
        report = seed_account(db, args.email, password, args.as_of)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
