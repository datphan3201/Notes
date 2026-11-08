from datetime import date
from typing import Literal
from zoneinfo import ZoneInfoNotFoundError

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from planner.timezones import zone as ZoneInfo


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Register(Strict):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    locale: Literal["vi", "en"] = "vi"
    password_confirmation: str | None = Field(default=None, max_length=128)

    @field_validator("name")
    @classmethod
    def display_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter your display name")
        return value

    @model_validator(mode="after")
    def confirmed_password(self):
        if self.password_confirmation is not None and self.password_confirmation != self.password:
            raise ValueError("Passwords do not match")
        return self


class Login(Strict):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


def timezone_name(value: str):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("Use an IANA timezone") from None
    from planner.timezones import canonical_name

    name = canonical_name(value)
    return "UTC" if name == "Etc/UTC" else name


class WorkspacePreferences(Strict):
    history_retention_days: int | None = Field(default=None, ge=1, le=3650)
    tags: list[str] = Field(default_factory=list, max_length=200)
    accent: str = Field(default="", pattern=r"^(|#[0-9a-fA-F]{6})$")
    background_id: str | None = None
    show_reminders: bool = True
    show_shares: bool = True
    visual_theme: Literal["mountain", "forest", "ocean", "pisces", "stars"] = "mountain"
    show_background: bool = True
    show_illustrations: bool = True
    show_quote: bool = True
    custom_quote: str = Field(default="", max_length=500)
    background_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    notes_view: Literal["grid", "list"] = "grid"
    notifications_enabled: bool = True
    email_notifications: bool = True
    history_completed_hours: int = Field(default=24, ge=1, le=8760)
    history_overdue_days: int = Field(default=3, ge=1, le=365)


class Preferences(Strict):
    name: str = Field(min_length=1, max_length=120)
    timezone: str
    locale: Literal["vi", "en"]
    theme: Literal["light", "dark"]
    preferences: WorkspacePreferences | None = None
    _timezone = field_validator("timezone")(timezone_name)


class Content(Strict):
    title: str = Field(min_length=1, max_length=300)
    content: str = Field(default="", max_length=100_000)
    importance: int = Field(default=3, ge=1, le=5)


class Presentation(Content):
    icon: str = Field(default="", max_length=40)
    accent: str = Field(default="", pattern=r"^(|#[0-9a-fA-F]{6})$")
    tags: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("icon")
    @classmethod
    def catalogue_icon(cls, value):
        if value not in (
            "",
            "target",
            "flag",
            "star",
            "heart",
            "book",
            "graduation",
            "code",
            "terminal",
            "briefcase",
            "chart",
            "money",
            "wallet",
            "cart",
            "home",
            "dumbbell",
            "activity",
            "bike",
            "apple",
            "droplet",
            "moon",
            "sun",
            "leaf",
            "globe",
            "plane",
            "music",
            "camera",
            "palette",
            "lightbulb",
            "chat",
            "users",
            "rocket",
            "trophy",
            "mountain",
            "compass",
            "clock",
            "pen",
            "flask",
            "shield",
            "language",
        ):
            raise ValueError("Choose an icon from the catalogue")
        return value

    @field_validator("tags")
    @classmethod
    def valid_tags(cls, values):
        if any(not value.strip() or len(value) > 60 for value in values):
            raise ValueError("Tags must contain 1 to 60 characters")
        return list(dict.fromkeys(values))


class AreaInput(Presentation):
    pass


class Dates(Presentation):
    start_date: date | None = None
    due_date: date | None = None

    @model_validator(mode="after")
    def date_order(self):
        if self.start_date and self.due_date and self.start_date > self.due_date:
            raise ValueError("Start date must not be after due date")
        return self


class GoalInput(Dates):
    strategy: str = Field(default="", max_length=100_000)
    related: list[str] = Field(default_factory=list, max_length=100)
    area_id: str | None = None
    parent_goal_id: str | None = None
    status: Literal["active", "todo", "doing", "blocked", "completed"] = "active"
    expected_result: str = Field(default="", max_length=10000)
    completion_criteria: str = Field(default="", max_length=10000)

    @model_validator(mode="after")
    def parent(self):
        if bool(self.area_id) == bool(self.parent_goal_id):
            raise ValueError("Choose one Area or parent Goal")
        return self


class MilestoneInput(Dates):
    related: list[str] = Field(default_factory=list, max_length=100)
    weekly_for: date | None = None
    weekly: bool = False
    goal_id: str
    status: Literal["todo", "doing", "done"] = "todo"
    completion_criteria: str = Field(default="", max_length=10000)


class ChecklistItem(Strict):
    text: str = Field(min_length=1, max_length=500)
    checked: bool = False


class TaskInput(Dates):
    pinned: bool = False
    reminder_mode: Literal[
        "none", "custom", "start", "before15", "before60", "due", "dayBefore"
    ] = "none"
    related: list[str] = Field(default_factory=list, max_length=100)
    goal_id: str | None = None
    milestone_id: str | None = None
    status: Literal["todo", "doing", "blocked", "done"] = "todo"
    scheduled_at: AwareDatetime | None = None
    scheduled_end: AwareDatetime | None = None
    reminder_at: AwareDatetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=100)
    working_note: str = Field(default="", max_length=100_000)
    expected_result: str = Field(default="", max_length=10000)
    completion_criteria: str = Field(default="", max_length=10000)

    @model_validator(mode="after")
    def parent(self):
        if self.goal_id and self.milestone_id:
            raise ValueError("Choose at most one primary parent")
        if self.scheduled_end and (
            not self.scheduled_at or self.scheduled_end <= self.scheduled_at
        ):
            raise ValueError("Scheduled end must be after scheduled start")
        return self


class TaskCapture(TaskInput):
    plan_for: Literal["none", "daily", "weekly"] = "none"


class NoteInput(Content):
    color: str = Field(
        default="neutral", pattern=r"^(neutral|lemon|mint|sky|rose|#[0-9a-fA-F]{6})$"
    )
    background_id: str | None = None
    pinned: bool = False
    tags: list[str] = Field(default_factory=list, max_length=30)
    goal_id: str | None = None
    task_id: str | None = None

    @model_validator(mode="after")
    def parent(self):
        if self.goal_id and self.task_id:
            raise ValueError("Choose one Note link")
        if any(not t.strip() or len(t) > 60 for t in self.tags):
            raise ValueError("Invalid tag")
        return self


class HabitInput(Presentation):
    primary_goal_id: str | None = None
    timezone: str = "Asia/Ho_Chi_Minh"
    frequency: Literal["daily", "weekly"] = "daily"
    target: int = Field(default=1, ge=1, le=7)
    _timezone = field_validator("timezone")(timezone_name)

    @model_validator(mode="after")
    def daily_target(self):
        if self.frequency == "daily" and self.target != 1:
            raise ValueError("Daily Habits have one completion day")
        return self


class ReviewInput(Content):
    reflection: str = Field(default="", max_length=100_000)
    went_well: str = Field(default="", max_length=100_000)
    improve: str = Field(default="", max_length=100_000)
    next_steps: str = Field(default="", max_length=100_000)
    finalized: bool = False
    period: Literal["daily", "weekly", "monthly"] = "daily"
    period_date: date

    @model_validator(mode="after")
    def canonical_period(self):
        if self.period == "weekly" and self.period_date.weekday() != 0:
            raise ValueError("Weekly reviews begin on Monday")
        if self.period == "monthly" and self.period_date.day != 1:
            raise ValueError("Monthly reviews begin on day 1")
        return self


class SeriesInput(Presentation):
    archive_future: bool = False
    template: TaskInput | None = None
    frequency: Literal["daily", "weekly", "monthly", "yearly"]
    interval_count: int = Field(default=1, ge=1, le=52)
    weekdays: list[int] = Field(default_factory=list, max_length=7)
    start_date: date
    end_date: date | None = None
    timezone: str = "Asia/Ho_Chi_Minh"
    state: Literal["active", "paused", "ended"] = "active"
    _timezone = field_validator("timezone")(timezone_name)

    @model_validator(mode="after")
    def recurrence(self):
        if self.frequency == "weekly":
            if not self.weekdays or any(day < 1 or day > 7 for day in self.weekdays):
                raise ValueError("Weekly recurrence needs weekdays 1–7")
        elif self.weekdays:
            raise ValueError("Only weekly recurrence accepts weekdays")
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date precedes start date")
        return self


class Mutation(Strict):
    acknowledgements: list[Literal["unchecked", "unfinished", "reopen_parents"]] = Field(
        default_factory=list
    )
    version: int = Field(ge=1)
    fields: dict


class Archive(Strict):
    version: int = Field(ge=1)
    archived: bool = True
    include_contents: bool = False


class NotePassword(Strict):
    current_password: str = Field(default="", max_length=128)
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class Unlock(Strict):
    password: str = Field(min_length=1, max_length=128)


class Share(Strict):
    email: EmailStr
    can_edit: bool = False


class Checkin(Strict):
    day: date
    state: Literal["done", "rest", "clear"]


class Prerequisites(Strict):
    version: int = Field(ge=1)
    ids: list[str] = Field(max_length=100)


class ConversationTurn(Strict):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class Ask(Strict):
    prompt: str = Field(min_length=1, max_length=4000)
    history: list[ConversationTurn] = Field(default_factory=list, max_length=12)


class NotificationRead(Strict):
    id: str | None = Field(default=None, min_length=1, max_length=36)


class Operation(Strict):
    kind: Literal["notes", "goals", "milestones", "tasks", "habits"]
    action: Literal["create", "update", "archive", "prerequisites", "checkin", "delete"]
    ref: str | None = Field(default=None, pattern=r"^c[1-9][0-9]*$")
    id: str | None = None
    version: int | None = Field(default=None, ge=1)
    fields: dict = Field(default_factory=dict)
    acknowledgements: list[Literal["unchecked", "unfinished", "reopen_parents"]] = Field(
        default_factory=list
    )

    @model_validator(mode="after")
    def supported_action(self):
        if self.action == "prerequisites" and self.kind != "milestones":
            raise ValueError("Only Milestones have prerequisites")
        if self.action == "checkin" and self.kind != "habits":
            raise ValueError("Only Habits have check-ins")
        if self.action == "delete" and self.kind != "notes":
            raise ValueError("Planning items are archived, not permanently deleted by AI")
        if self.ref and self.action != "create":
            raise ValueError("Only creates declare local references")
        return self


class Proposal(Strict):
    operations: list[Operation] = Field(min_length=1, max_length=50)


class Approve(Strict):
    proposal_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    acknowledgements: list[Literal["unchecked", "unfinished", "reopen_parents"]] = Field(
        default_factory=list
    )


class SelectTask(Strict):
    day: date
    period: Literal["daily", "weekly"] = "daily"
    selected: bool = True


class SelectFocus(Strict):
    goal_id: str | None = None
