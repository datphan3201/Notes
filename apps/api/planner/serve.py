"""Container entry point; the free Render trial colocates the durable polling worker."""

import os
import signal
import subprocess
import sys
import threading
import time

from planner.config import settings


def supervise(commands, worker_retry_delay=1.0):
    stopped = threading.Event()
    previous = {}
    for sig in (signal.SIGINT, signal.SIGTERM):
        previous[sig] = signal.signal(sig, lambda *_: stopped.set())
    children = []
    worker_failures = 0
    worker_started = time.monotonic()
    next_worker_start = 0.0
    worker_abandoned = False
    try:
        for command in commands:
            children.append(subprocess.Popen(command, start_new_session=True))
        while not stopped.wait(0.2):
            if children[0].poll() is not None:
                return 1
            if len(children) > 1 and children[1].poll() is not None and not worker_abandoned:
                if not next_worker_start:
                    if time.monotonic() - worker_started >= 300:
                        worker_failures = 0
                    worker_failures += 1
                    if worker_failures > 3:
                        print("Planner worker stopped after repeated failures", file=sys.stderr)
                        worker_abandoned = True
                        continue
                    next_worker_start = time.monotonic() + worker_retry_delay * 2 ** (worker_failures - 1)
                if time.monotonic() >= next_worker_start:
                    children[1] = subprocess.Popen(commands[1], start_new_session=True)
                    worker_started = time.monotonic()
                    next_worker_start = 0.0
        return 0
    finally:
        for child in children:
            if child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
        for child in children:
            try:
                child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(child.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                child.wait()
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def main():
    try:
        config = settings()
    except Exception as exc:
        print(
            f"\n{'='*70}\nPLANNER CONFIGURATION ERROR ON STARTUP:\n{exc}\n{'='*70}\n",
            file=sys.stderr,
        )
        raise
    if config.migrate_on_start:
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    commands = [
        [
            sys.executable,
            "-m",
            "uvicorn",
            "planner.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.environ.get("PORT", "8080"),
            "--proxy-headers",
            "--timeout-graceful-shutdown",
            "10",
        ]
    ]
    if config.run_worker:
        commands.append([sys.executable, "-m", "planner.jobs"])
    return supervise(commands)


if __name__ == "__main__":
    raise SystemExit(main())
