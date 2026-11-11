import base64
import hashlib
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PLANNER_",
        env_file=(".env", "apps/api/.env", str(Path(__file__).resolve().parents[1] / ".env")),
        extra="ignore",
        hide_input_in_errors=True,
    )
    environment: Literal["development", "testing", "production"] = "development"
    database_url: str = "postgresql+psycopg://planner:planner-local-only@127.0.0.1:5433/planner_dev"
    database_schema: str = "public"
    web_origin: str = "http://localhost:3000"
    development_origins: list[str] = []
    pool_size: int = 5
    pool_overflow: int = 2
    session_days: int = 14
    storage_root: Path = Path(".private")
    storage_bucket: str = ""
    supabase_url: str = ""
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_storage_bucket: str = ""
    max_upload_bytes: int = 10 * 1024 * 1024
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: SecretStr = SecretStr("")
    ai_model: str = ""
    embedding_model: str = ""
    embedding_dimensions: int = 1536
    ai_daily_runs: int = 30
    ai_daily_tokens: int = 500_000
    ai_input_usd_per_million: float = 0
    ai_output_usd_per_million: float = 0
    worker_audience: str = ""
    worker_service_account: str = ""
    worker_mode: Literal["cloud_tasks", "poll"] = "cloud_tasks"
    scheduler_mode: Literal["legacy", "compare", "due"] = "legacy"
    run_worker: bool = False
    migrate_on_start: bool = False
    encryption_key: SecretStr = SecretStr("")
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = "Planner <onboarding@resend.dev>"
    resend_api_key: SecretStr = SecretStr("")
    brevo_api_key: SecretStr = SecretStr("")
    max_user_storage_bytes: int = 100 * 1024 * 1024
    cloud_tasks_queue: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                return "postgresql+psycopg://" + v[len("postgres://") :]
            if v.startswith("postgresql://"):
                return "postgresql+psycopg://" + v[len("postgresql://") :]
        return v

    @field_validator("web_origin", mode="before")
    @classmethod
    def normalize_web_origin(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            parsed = urlsplit(v)
            if parsed.scheme in ("http", "https") and parsed.path == "/":
                return v.rstrip("/")
        return v

    @field_validator("development_origins", mode="before")
    @classmethod
    def normalize_development_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = (
                [item.strip() for item in v.split(",") if item.strip()]
                if not v.strip().startswith("[")
                else v
            )
        if isinstance(v, list):
            cleaned = []
            for item in v:
                if isinstance(item, str):
                    item = item.strip()
                    parsed = urlsplit(item)
                    if parsed.scheme in ("http", "https") and parsed.path == "/":
                        item = item.rstrip("/")
                    cleaned.append(item)
                else:
                    cleaned.append(item)
            return cleaned
        return v

    @field_validator("supabase_url", mode="before")
    @classmethod
    def normalize_supabase_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            parsed = urlsplit(v)
            if parsed.scheme in ("http", "https") and parsed.path == "/":
                return v.rstrip("/")
        return v

    @field_validator("encryption_key", mode="before")
    @classmethod
    def normalize_encryption_key(cls, v: Any) -> Any:
        if not v:
            return SecretStr("")
        raw = v.get_secret_value() if isinstance(v, SecretStr) else str(v)
        raw = raw.strip()
        if not raw:
            return SecretStr("")
        try:
            Fernet(raw.encode("ascii"))
            return SecretStr(raw)
        except Exception:
            pass
        urlsafe = raw.replace("+", "-").replace("/", "_")
        try:
            Fernet(urlsafe.encode("ascii"))
            return SecretStr(urlsafe)
        except Exception:
            pass
        if len(raw) >= 32:
            derived = base64.urlsafe_b64encode(hashlib.sha256(raw.encode("utf-8")).digest()).decode("ascii")
            return SecretStr(derived)
        raise ValueError(
            "PLANNER_ENCRYPTION_KEY must be a valid 32-byte urlsafe base64 Fernet key or a random secret of at least 32 characters"
        )

    @model_validator(mode="after")
    def production_settings(self):
        errors: list[str] = []
        for origin in [self.web_origin, *self.development_origins]:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
                or "*" in origin
                or origin.strip() != origin
            ):
                raise ValueError(
                    "Web origins must be exact HTTP(S) origins without paths or wildcards"
                )
        if not self.database_url.startswith("postgresql"):
            raise ValueError("PostgreSQL is required")
        if (
            not re.fullmatch(r"[a-z][a-z0-9_]{0,62}", self.database_schema)
            or self.database_schema.startswith("pg_")
            or self.database_schema in ("auth", "storage", "extensions", "information_schema")
        ):
            raise ValueError("Use a dedicated application database schema")
        supabase = (
            self.supabase_url,
            self.supabase_storage_bucket,
            self.supabase_service_role_key.get_secret_value(),
        )
        if any(supabase):
            parsed = urlsplit(self.supabase_url)
            missing = []
            if not self.supabase_url:
                missing.append("PLANNER_SUPABASE_URL")
            if not self.supabase_storage_bucket:
                missing.append("PLANNER_SUPABASE_STORAGE_BUCKET")
            if not self.supabase_service_role_key.get_secret_value():
                missing.append("PLANNER_SUPABASE_SERVICE_ROLE_KEY")
            supabase_valid = (
                not missing
                and parsed.scheme == "https"
                and bool(parsed.hostname)
                and parsed.netloc == parsed.hostname
                and not parsed.path
                and not parsed.query
                and not parsed.fragment
            )
            if not supabase_valid:
                detail = f" (missing: {', '.join(missing)})" if missing else ""
                err = f"Supabase storage requires an exact HTTPS origin, bucket and server-only service role key{detail}"
                if self.environment == "production":
                    errors.append(err)
                else:
                    raise ValueError(err)
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", self.supabase_storage_bucket)
                or self.storage_bucket
            ):
                err = "Use one storage provider and a valid Supabase bucket name"
                if self.environment == "production":
                    errors.append(err)
                else:
                    raise ValueError(err)
        if self.run_worker and self.worker_mode != "poll":
            raise ValueError("A colocated worker requires polling delivery")
        if self.worker_mode == "poll" and self.cloud_tasks_queue:
            raise ValueError("Polling workers do not use Cloud Tasks")
        if self.embedding_dimensions != 1536:
            raise ValueError("Changing vector dimensions requires a schema/index migration")
        if self.environment == "production":
            if self.development_origins:
                errors.append("Development origins must be empty in production")
            if not self.web_origin.startswith("https://") or not (
                self.storage_bucket or self.supabase_storage_bucket
            ):
                errors.append("Production requires HTTPS and private object storage")
            if self.supabase_storage_bucket and self.database_schema == "public":
                errors.append("Supabase production requires a non-exposed application schema")
            if self.worker_mode == "cloud_tasks" and (
                not self.worker_audience or not self.worker_service_account
            ):
                errors.append("Production requires authenticated worker delivery")
            if (
                not self.encryption_key.get_secret_value()
                or not (self.smtp_host or self.resend_api_key.get_secret_value() or self.brevo_api_key.get_secret_value())
                or not self.smtp_from
            ):
                missing_sec = []
                if not self.encryption_key.get_secret_value():
                    missing_sec.append("PLANNER_ENCRYPTION_KEY")
                if not (self.smtp_host or self.resend_api_key.get_secret_value() or self.brevo_api_key.get_secret_value()):
                    missing_sec.append("PLANNER_BREVO_API_KEY (or PLANNER_RESEND_API_KEY / PLANNER_SMTP_HOST)")
                if not self.smtp_from:
                    missing_sec.append("PLANNER_SMTP_FROM")
                errors.append(
                    f"Production requires an encryption key and account email delivery (missing: {', '.join(missing_sec)})"
                )
            if errors:
                raise ValueError(
                    f"Production configuration incomplete ({len(errors)} error{'s' if len(errors) > 1 else ''}):\n"
                    + "\n".join(f"  • {e}" for e in errors)
                )
        return self


@lru_cache
def settings() -> Settings:
    return Settings()
