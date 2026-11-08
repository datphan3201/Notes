import hashlib
from pathlib import Path, PurePosixPath
from urllib.parse import quote

import httpx
from fastapi import HTTPException, UploadFile

from planner.config import settings


def supabase_request(method: str, key: str, **kwargs):
    config = settings()
    if (
        not key
        or "\\" in key
        or PurePosixPath(key).is_absolute()
        or ".." in PurePosixPath(key).parts
    ):
        raise HTTPException(404, "File not found")
    bucket = quote(config.supabase_storage_bucket, safe="")
    path = f"object/{bucket}" if method == "DELETE" else f"object/{bucket}/{quote(key, safe='/')}"
    if method == "GET":
        path = f"object/authenticated/{bucket}/{quote(key, safe='/')}"
    token = config.supabase_service_role_key.get_secret_value()
    try:
        with httpx.Client(
            base_url=config.supabase_url + "/storage/v1/",
            headers={"apikey": token, "Authorization": "Bearer " + token},
            timeout=60,
        ) as client:
            response = client.request(method, path, **kwargs)
    except httpx.RequestError:
        raise HTTPException(502, "Private storage is temporarily unavailable") from None
    if response.is_success:
        return response
    try:
        error = response.json()
    except ValueError:
        error = {}
    if method == "GET" and (
        error.get("code") == "NoSuchKey"
        or error.get("message") == "Object not found"
        or response.status_code == 404
        and error.get("code") != "NoSuchBucket"
    ):
        raise HTTPException(404, "File not found")
    if method == "POST" and (
        response.status_code == 409
        or error.get("code") in ("KeyAlreadyExists", "ResourceAlreadyExists")
    ):
        raise HTTPException(409, "A file with this key already exists")
    raise HTTPException(502, "Private storage request failed")


def storage_path(key: str) -> Path:
    root = settings().storage_root.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or path == root:
        raise HTTPException(404, "File not found")
    return path


def upload(file: UploadFile, key: str):
    data = file.file.read(settings().max_upload_bytes + 1)
    if not data or len(data) > settings().max_upload_bytes:
        raise HTTPException(413, "File is empty or exceeds the upload limit")
    if settings().supabase_storage_bucket:
        supabase_request(
            "POST",
            key,
            content=data,
            headers={"Content-Type": "application/octet-stream", "x-upsert": "false"},
        )
    elif settings().storage_bucket:
        from google.cloud import storage

        blob = storage.Client().bucket(settings().storage_bucket).blob(key)
        blob.upload_from_string(
            data, content_type="application/octet-stream", if_generation_match=0
        )
    else:
        path = storage_path(key)
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with path.open("xb") as handle:
            handle.write(data)
        path.chmod(0o600)
    return len(data), hashlib.sha256(data).hexdigest()


def read(key: str) -> bytes:
    if settings().supabase_storage_bucket:
        return supabase_request("GET", key).content
    if settings().storage_bucket:
        from google.cloud import storage

        return storage.Client().bucket(settings().storage_bucket).blob(key).download_as_bytes()
    path = storage_path(key)
    if not path.is_file():
        raise HTTPException(404, "File not found")
    return path.read_bytes()


def remove(key: str):
    if settings().supabase_storage_bucket:
        supabase_request("DELETE", key, json={"prefixes": [key]})
    elif settings().storage_bucket:
        from google.api_core.exceptions import NotFound
        from google.cloud import storage

        try:
            storage.Client().bucket(settings().storage_bucket).blob(key).delete()
        except NotFound:
            pass
    else:
        storage_path(key).unlink(missing_ok=True)
