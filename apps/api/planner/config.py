import re
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PLANNER_", env_file=".env", extra="ignore", hide_input_in_errors=True
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
    run_worker: bool = False
    migrate_on_start: bool = False
    encryption_key: SecretStr = SecretStr("")
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = ""
    resend_api_key: SecretStr = SecretStr("")
    max_user_storage_bytes: int = 100 * 1024 * 1024
    cloud_tasks_queue: str = ""

    @model_validator(mode="after")
    def production_settings(self):
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
            if (
                not all(supabase)
                or parsed.scheme != "https"
                or not parsed.hostname
                or parsed.netloc != parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError(
                    "Supabase storage requires an exact HTTPS origin, bucket and server-only service role key"
                )
            if (
                not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", self.supabase_storage_bucket)
                or self.storage_bucket
            ):
                raise ValueError("Use one storage provider and a valid Supabase bucket name")
        if self.run_worker and self.worker_mode != "poll":
            raise ValueError("A colocated worker requires polling delivery")
        if self.worker_mode == "poll" and self.cloud_tasks_queue:
            raise ValueError("Polling workers do not use Cloud Tasks")
        if self.embedding_dimensions != 1536:
            raise ValueError("Changing vector dimensions requires a schema/index migration")
        if self.environment == "production":
            if self.development_origins:
                raise ValueError("Development origins must be empty in production")
            if not self.web_origin.startswith("https://") or not (
                self.storage_bucket or self.supabase_storage_bucket
            ):
                raise ValueError("Production requires HTTPS and private object storage")
            if self.supabase_storage_bucket and self.database_schema == "public":
                raise ValueError("Supabase production requires a non-exposed application schema")
            if self.worker_mode == "cloud_tasks" and (
                not self.worker_audience or not self.worker_service_account
            ):
                raise ValueError("Production requires authenticated worker delivery")
            if (
                not self.encryption_key.get_secret_value()
                or not (self.smtp_host or self.resend_api_key.get_secret_value())
                or not self.smtp_from
            ):
                raise ValueError("Production requires an encryption key and account email delivery")
        return self


@lru_cache
def settings() -> Settings:
    return Settings()
