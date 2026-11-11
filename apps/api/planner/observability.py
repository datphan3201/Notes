import json
import logging
import os
from datetime import UTC, datetime


class JsonFormatter(logging.Formatter):
    def format(self, record):
        result = {
            "time": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for field in ("trace_id", "route", "status", "latency_ms", "job_id", "error_code", "user_agent",
                      "reminder_mismatches", "series_mismatches", "batch_limited"):
            if hasattr(record, field):
                result[field] = getattr(record, field)
        return json.dumps(result)


def configure_logging():
    logger = logging.getLogger("planner")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def instrument(app, engine):
    """Opt-in OTLP export; never attach prompts, content, cookies or SQL bindings."""
    configure_logging()
    from planner.config import settings

    if settings().environment == "testing":
        return
    if not os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT"):
        return
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(
        resource=Resource.create(
            {"service.name": os.environ.get("OTEL_SERVICE_NAME", "planner-api")}
        )
    )
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health,ready")
    SQLAlchemyInstrumentor().instrument(engine=engine)
