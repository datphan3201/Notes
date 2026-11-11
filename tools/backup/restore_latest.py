#!/usr/bin/env python3
"""Rehearse the latest local backup in a disposable planner_test container."""
import fcntl
import pathlib
import re

from restore_test import restore


def main():
    root = pathlib.Path.home() / ".local/share/planner-backups/automated"
    key = pathlib.Path.home() / ".config/planner-backup/archive.key"
    try:
        with (root / ".backup.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_SH)
            backups = sorted(p for p in root.iterdir() if p.is_dir() and re.fullmatch(
                r"backup-\d{8}T\d{6}Z-[0-9a-f]{6}", p.name
            ))
            if not backups:
                raise ValueError("No complete backup is available")
            tables, objects, seconds = restore(backups[-1], key)
        print(f"Restore rehearsal passed: {tables} tables, {objects} objects, {seconds:.1f} seconds")
    except Exception as exc:
        print(f"Restore rehearsal failed: {type(exc).__name__}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
