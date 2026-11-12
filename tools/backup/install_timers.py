#!/usr/bin/env python3
"""Install user-scoped free local backup, restore, cleanup and monitoring timers."""
import pathlib
import subprocess


def main():
    root = pathlib.Path(__file__).resolve().parents[2]
    units = pathlib.Path.home() / ".config/systemd/user"
    units.mkdir(parents=True, exist_ok=True)
    tasks = {
        "planner-backup": ("planner_backup.py", "*-*-* 03:10:00 Asia/Ho_Chi_Minh"),
        "planner-restore-drill": ("restore_latest.py", "*-*-01 04:00:00 Asia/Ho_Chi_Minh"),
        "planner-job-cleanup": ("cleanup_when_stable.py", "*-*-* 00,04,08,12,16,20:30:00 Asia/Ho_Chi_Minh"),
        "planner-monitor": ("monitor.py", "*-*-* *:00,15,30,45:00"),
    }
    # systemd quoted arguments escape backslashes, quotes and specifier percent signs.
    def quote(value):
        return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%") + '"'
    for name, (script, calendar) in tasks.items():
        (units / (name + ".service")).write_text(
            f"[Unit]\nDescription=Local Planner {name}\nAfter=network-online.target\nWants=network-online.target\n\n"
            f"[Service]\nType=oneshot\nWorkingDirectory={str(root).replace('%', '%%')}\n"
            f"ExecStart={quote(root / 'apps/api/.venv/bin/python')} {quote(root / 'tools/backup' / script)}\n"
            "UMask=0077\nTimeoutStartSec=1800\n")
        (units / (name + ".timer")).write_text(
            f"[Unit]\nDescription=Local Planner {name} schedule\n\n[Timer]\nOnCalendar={calendar}\n"
            f"Persistent=true\nUnit={name}.service\n\n[Install]\nWantedBy=timers.target\n")
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", *[name + ".timer" for name in tasks]], check=True)


if __name__ == "__main__":
    main()
