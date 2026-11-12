#!/usr/bin/env python3
"""Restore an encrypted backup only into an ephemeral planner_test container."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import time
import uuid


def decrypt(path, key):
    result = subprocess.run(
        ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
         "-pass", f"file:{key}", "-in", str(path)], capture_output=True, timeout=600,
    )
    if result.returncode:
        raise RuntimeError("Backup decryption failed")
    return result.stdout


def run(command, **kwargs):
    return subprocess.run(command, capture_output=True, timeout=600, **kwargs)


def restore(directory, key):
    started = time.monotonic()
    manifest = json.loads(decrypt(directory / "manifest.json.enc", key))
    if manifest.get("schema") != "planner":
        raise ValueError("Unexpected schema in backup")
    archive = directory / "database.dump.enc"
    with archive.open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    if digest != manifest["encrypted_database_sha256"]:
        raise ValueError("Backup checksum does not match manifest")
    if manifest.get("encrypted_recovery_config_sha256"):
        recovery = directory / "recovery-config.json.enc"
        if hashlib.sha256(recovery.read_bytes()).hexdigest() != manifest["encrypted_recovery_config_sha256"]:
            raise ValueError("Recovery configuration checksum differs")
        if not isinstance(json.loads(decrypt(recovery, key)), dict):
            raise ValueError("Invalid recovery configuration")
    name = "planner-restore-test-" + uuid.uuid4().hex[:8]
    create = run([
        "docker", "run", "--rm", "-d", "--name", name,
        "--tmpfs", "/var/lib/postgresql/data", "--tmpfs", "/tmp",
        "-e", "POSTGRES_USER=planner_test", "-e", "POSTGRES_PASSWORD=isolated-test-only",
        "-e", "POSTGRES_DB=planner_test", "pgvector/pgvector:pg17",
    ])
    if create.returncode:
        raise RuntimeError("Isolated database could not start")
    try:
        for _ in range(60):
            if run(["docker", "exec", name, "pg_isready", "-U", "planner_test", "-d", "planner_test"]).returncode == 0:
                break
            time.sleep(1)
        else:
            raise RuntimeError("Isolated database did not become ready")
        check = run(["docker", "exec", name, "psql", "-U", "planner_test", "-d", "planner_test", "-Atc",
                     "select current_database(); create schema extensions; create extension vector with schema extensions;"])
        if check.returncode or not check.stdout.startswith(b"planner_test\n"):
            raise RuntimeError("Isolated database guard failed")
        source = subprocess.Popen(
            ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
             "-pass", f"file:{key}", "-in", str(archive)], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        try:
            result = subprocess.run(
                ["docker", "exec", "-i", name, "pg_restore", "--no-owner", "--no-acl",
                 "--exit-on-error", "-U", "planner_test", "-d", "planner_test"],
                stdin=source.stdout, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600,
            )
        finally:
            source.stdout.close()
        source.stderr.read()
        source.stderr.close()
        if source.wait(timeout=60) or result.returncode:
            raise RuntimeError("Database restore failed")
        for table, expected in manifest["table_counts"].items():
            if not re.fullmatch(r"[a-z_][a-z0-9_]*", table):
                raise ValueError("Unexpected table name in manifest")
            query = ("SET timezone='UTC'; SELECT count(*), "
                     "md5(coalesce(string_agg(md5(row_to_json(t)::text), '' "
                     "ORDER BY md5(row_to_json(t)::text)), '')) "
                     f'FROM planner."{table}" t')
            result = run(["docker", "exec", name, "psql", "-U", "planner_test", "-d", "planner_test", "-Atc", query])
            if result.returncode:
                raise RuntimeError("A restored table could not be verified")
            count, digest = result.stdout.decode().strip().splitlines()[-1].split("|")
            if int(count) != expected or (manifest.get("table_digests") and digest != manifest["table_digests"][table]):
                raise RuntimeError("A restored table count or digest differs")
        for index, entry in enumerate(manifest["objects"]):
            filename = entry["file"]
            if filename != f"object-{index:08d}.enc":
                raise ValueError("Unexpected object filename in manifest")
            content = decrypt(directory / filename, key)
            if hashlib.sha256(content).hexdigest() != entry["sha256"] or len(content) != entry["size"]:
                raise RuntimeError("Private object checksum differs")
            target = f"/tmp/planner-object-{index:08d}"
            result = subprocess.run(["docker", "exec", "-i", name, "sh", "-c", f"cat > {target}"],
                                    input=content, capture_output=True, timeout=120)
            if result.returncode:
                raise RuntimeError("Private object restore failed")
            result = run(["docker", "exec", name, "sha256sum", target])
            if result.returncode or result.stdout.decode().split()[0] != entry["sha256"]:
                raise RuntimeError("Restored private object checksum differs")
        return len(manifest["table_counts"]), len(manifest["objects"]), time.monotonic() - started
    finally:
        run(["docker", "stop", "-t", "0", name])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=pathlib.Path)
    parser.add_argument("--key", type=pathlib.Path, default=pathlib.Path.home() / ".config/planner-backup/archive.key")
    args = parser.parse_args()
    try:
        tables, objects, seconds = restore(args.backup, args.key)
        print(f"Isolated restore passed: {tables} tables, {objects} private objects, {seconds:.1f} seconds")
    except Exception as exc:
        print(f"Isolated restore failed: {type(exc).__name__}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
