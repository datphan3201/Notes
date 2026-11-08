from fastapi import Depends, FastAPI, HTTPException, Request

from planner.config import settings
from planner.db import engine
from planner.jobs import process_one, schedule
from planner.observability import instrument

app = FastAPI(title="Planner private worker", docs_url=None, openapi_url=None)
instrument(app, engine())


def verify_delivery(request: Request):
    # Worker service also requires Cloud Run IAM; verify audience and caller in application.
    from google.auth.transport.requests import Request as GoogleRequest
    from google.oauth2.id_token import verify_oauth2_token

    config = settings()
    if not config.worker_audience or not config.worker_service_account:
        raise HTTPException(503, "Worker authentication is not configured")
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Worker identity required")
    try:
        claims = verify_oauth2_token(
            authorization[7:], GoogleRequest(), audience=config.worker_audience
        )
        if (
            claims.get("email") != config.worker_service_account
            or claims.get("email_verified") is not True
        ):
            raise ValueError("Unexpected caller")
    except (ValueError, TypeError):
        raise HTTPException(403, "Invalid worker identity") from None


@app.post("/internal/schedule", dependencies=[Depends(verify_delivery)])
def schedule_jobs():
    schedule()
    from planner.dispatch import dispatch

    return {"scheduled": True, "dispatched": dispatch()}


@app.post("/internal/drain", dependencies=[Depends(verify_delivery)])
def drain():
    return {"processed": process_one()}


@app.post("/internal/jobs/{job_id}", dependencies=[Depends(verify_delivery)])
def deliver_job(job_id: str):
    return {"processed": process_one(job_id=job_id)}
