#!/usr/bin/env python3
"""Create a private encrypted snapshot of the deployed Planner schema and bucket."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import uuid

import psycopg
from psycopg import sql

SERVICE = "srv-dbo21jp5efls73clvcp0"
ROOT = pathlib.Path(__file__).resolve().parents[2]


def configuration(cloud):
    values = {}
    for line in cloud.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value.strip().strip("\"'")
    request = urllib.request.Request(
        f"https://api.render.com/v1/services/{SERVICE}/env-vars?limit=100",
        headers={"Authorization": "Bearer " + values["RENDER_TOKEN"]},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = {row["envVar"]["key"]: row["envVar"]["value"] for row in json.load(response)}
    required = ["PLANNER_DATABASE_URL", "PLANNER_SUPABASE_URL", "PLANNER_SUPABASE_SERVICE_ROLE_KEY",
                "PLANNER_SUPABASE_STORAGE_BUCKET", "PLANNER_DATABASE_SCHEMA"]
    if any(not result.get(key) for key in required) or result["PLANNER_DATABASE_SCHEMA"] != "planner":
        raise ValueError("Unexpected deployed database configuration")
    url = urllib.parse.urlsplit(result["PLANNER_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://"))
    origin = urllib.parse.urlsplit(result["PLANNER_SUPABASE_URL"])
    ref = origin.hostname.split(".", 1)[0] if origin.hostname else ""
    if (not re.fullmatch(r"[a-z0-9]{20}", ref) or origin.scheme != "https"
            or origin.hostname != ref + ".supabase.co" or origin.path not in ("", "/")
            or not url.hostname or not url.hostname.endswith(".pooler.supabase.com")
            or url.username != "postgres." + ref or url.path != "/postgres"):
        raise ValueError("Unexpected deployed database identity")
    return result, url, ref


def secure_key(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path.parent, 0o700)
    if not path.exists():
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as file:
            file.write(os.urandom(32).hex())
    if path.stat().st_mode & 0o077:
        raise ValueError("Backup key permissions must be private")


def encrypt(source, destination, key):
    with destination.open("xb") as out:
        os.chmod(destination, 0o600)
        process = subprocess.run(
            ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-pass", f"file:{key}"],
            stdin=source, stdout=out, stderr=subprocess.PIPE, timeout=600,
        )
    if process.returncode:
        raise RuntimeError("Encryption failed")


def encrypt_bytes(content, destination, key):
    with destination.open("xb") as out:
        os.chmod(destination, 0o600)
        process = subprocess.run(
            ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-pass", f"file:{key}"],
            input=content, stdout=out, stderr=subprocess.PIPE, timeout=600,
        )
    if process.returncode:
        raise RuntimeError("Encryption failed")


def keep_versions(root):
    backups = sorted((p for p in root.glob("backup-*") if p.is_dir() and re.fullmatch(
        r"backup-\d{8}T\d{6}Z-[0-9a-f]{6}", p.name
    )), reverse=True)
    keep = set()
    days = set()
    weeks = set()
    for backup in backups:
        try:
            day = dt.datetime.strptime(backup.name[7:15], "%Y%m%d").date()
        except ValueError:
            continue
        if day not in days and len(days) < 7:
            keep.add(backup)
            days.add(day)
        week = day.isocalendar()[:2]
        if week not in weeks and len(weeks) < 4:
            keep.add(backup)
            weeks.add(week)
    for backup in backups:
        if backup not in keep:
            shutil.rmtree(backup)


def capture_objects(config, objects, attachments, destination, key):
    bucket = urllib.parse.quote(config["PLANNER_SUPABASE_STORAGE_BUCKET"], safe="")
    token = config["PLANNER_SUPABASE_SERVICE_ROLE_KEY"]
    captured = []
    for index, (name, expected_size) in enumerate(objects):
        path = urllib.parse.quote(name, safe="/")
        request = urllib.request.Request(
            config["PLANNER_SUPABASE_URL"] + "/storage/v1/object/authenticated/" + bucket + "/" + path,
            headers={"apikey": token, "Authorization": "Bearer " + token},
        )
        with urllib.request.urlopen(request, timeout=90) as response:
            content = response.read()
        if expected_size and len(content) != expected_size:
            raise RuntimeError("Private object size mismatch")
        digest = hashlib.sha256(content).hexdigest()
        if name in attachments and digest != attachments[name]:
            raise RuntimeError("Private object checksum mismatch")
        filename = f"object-{index:08d}.enc"
        encrypt_bytes(content, destination / filename, key)
        captured.append({"key": name, "file": filename, "sha256": digest, "size": len(content)})
    return captured


def backup(args):
    config, url, ref = configuration(args.cloud)
    if not args.key.exists() and args.output.exists() and any(args.output.glob("backup-*")):
        raise ValueError("Existing backups require their original encryption key")
    secure_key(args.key)
    args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(args.output, 0o700)
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    final = args.output / ("backup-" + stamp + "-" + uuid.uuid4().hex[:6])
    temp = final.with_name(final.name + ".partial")
    temp.mkdir(mode=0o700)
    try:
        conninfo = config["PLANNER_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
        with psycopg.connect(conninfo, options="-c timezone=UTC", connect_timeout=20) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
                    cur.execute("SELECT current_database(), pg_database_size(current_database()), pg_export_snapshot()")
                    database, size, snapshot = cur.fetchone()
                    if database != "postgres":
                        raise ValueError("Unexpected database")
                    cur.execute("SELECT count(*) FROM auth.users")
                    if cur.fetchone()[0]:
                        raise ValueError("Supabase Auth users require a separate migration-aware backup")
                    cur.execute("SELECT version_num FROM planner.alembic_version")
                    revision = cur.fetchone()[0]
                    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'planner' ORDER BY tablename")
                    tables, digests = {}, {}
                    for (name,) in cur.fetchall():
                        cur.execute(sql.SQL(
                            "SELECT count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text), '' "
                            "ORDER BY md5(row_to_json(t)::text)), '')) FROM planner.{} t"
                        ).format(sql.Identifier(name)))
                        tables[name], digests[name] = cur.fetchone()
                    cur.execute("SELECT name, COALESCE((metadata->>'size')::bigint, 0) FROM storage.objects WHERE bucket_id = %s ORDER BY name", (config["PLANNER_SUPABASE_STORAGE_BUCKET"],))
                    objects = cur.fetchall()
                    cur.execute("SELECT storage_key, checksum FROM planner.attachments")
                    attachments = dict(cur.fetchall())
                    cur.execute("SELECT storage_key FROM planner.account_files")
                    referenced = set(attachments) | {row[0] for row in cur.fetchall()}
                    if not referenced.issubset({row[0] for row in objects}):
                        raise RuntimeError("Referenced private objects are missing")
                    needed = 2 * (size + sum(max(0, size) for _, size in objects)) + 64 * 1024 * 1024
                    if shutil.disk_usage(args.output).free < needed:
                        raise RuntimeError("Insufficient disk space")
                    credentials = "\n".join([url.hostname, str(url.port or 5432), urllib.parse.unquote(url.username), "postgres", urllib.parse.unquote(url.password), snapshot]) + "\n"
                    if any("\n" in value or "\r" in value for value in [urllib.parse.unquote(url.username), urllib.parse.unquote(url.password)]):
                        raise ValueError("Unsupported database credential format")
                    command = "read PGHOST; read PGPORT; read PGUSER; read PGDATABASE; read PGPASSWORD; read SNAPSHOT; export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD PGSSLMODE=require; exec pg_dump -Fc --schema=planner --no-owner --no-acl --snapshot=\"$SNAPSHOT\""
                    dump = subprocess.Popen(["docker", "run", "--rm", "-i", "--network", "host", "pgvector/pgvector:pg17", "sh", "-c", command], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                    dump.stdin.write(credentials.encode())
                    dump.stdin.close()
                    try:
                        encrypt(dump.stdout, temp / "database.dump.enc", args.key)
                    finally:
                        dump.stdout.close()
                    dump.stderr.read()
                    if dump.wait(timeout=60):
                        raise RuntimeError("Database export failed")
                    encrypted_dump = temp / "database.dump.enc"
                    decoded = subprocess.Popen(
                        ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
                         "-pass", f"file:{args.key}", "-in", str(encrypted_dump)],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    )
                    try:
                        check = subprocess.run(
                            ["docker", "run", "--rm", "-i", "pgvector/pgvector:pg17", "sh", "-c",
                             "pg_restore --list >/dev/null; result=$?; cat >/dev/null; exit $result"],
                            stdin=decoded.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                            timeout=600,
                        )
                    finally:
                        decoded.stdout.close()
                    decoded.stderr.read()
                    if decoded.wait(timeout=60) or check.returncode:
                        raise RuntimeError("Encrypted database archive verification failed")
                    with encrypted_dump.open("rb") as file:
                        dump_digest = hashlib.file_digest(file, "sha256").hexdigest()
                    manifest = {"project": ref, "schema": "planner", "created_at": stamp,
                                "revision": revision, "table_counts": tables,
                                "table_digests": digests,
                                "bucket": config["PLANNER_SUPABASE_STORAGE_BUCKET"],
                                "encrypted_database_sha256": dump_digest, "objects": []}
                    manifest["objects"] = capture_objects(config, objects, attachments, temp, args.key)
                    encrypt_bytes(json.dumps(manifest).encode(), temp / "manifest.json.enc", args.key)
        temp.rename(final)
        keep_versions(args.output)
        print(f"Backup completed: {final.name}; {len(objects)} private objects")
        return final
    except BaseException:
        shutil.rmtree(temp, ignore_errors=True)
        raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cloud", type=pathlib.Path, default=ROOT / ".cloud")
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path.home() / ".local/share/planner-backups/automated")
    parser.add_argument("--key", type=pathlib.Path, default=pathlib.Path.home() / ".config/planner-backup/archive.key")
    args = parser.parse_args()
    try:
        args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (args.output / ".backup.lock").open("a") as lock:
            os.chmod(args.output / ".backup.lock", 0o600)
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            backup(args)
    except Exception as exc:
        print(f"Backup failed: {type(exc).__name__}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
