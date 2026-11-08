"""Container entry point; the free Render trial colocates the durable polling worker."""

import os
import signal
import subprocess
import sys
import threading

from planner.config import settings


def supervise(commands):
    stopped = threading.Event()
    previous = {}
    for sig in (signal.SIGINT, signal.SIGTERM):
        previous[sig] = signal.signal(sig, lambda *_: stopped.set())
    children = []
    try:
        for command in commands:
            children.append(subprocess.Popen(command, start_new_session=True))
        while not stopped.wait(0.2):
            if any(child.poll() is not None for child in children):
                return 1
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
    config = settings()
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
