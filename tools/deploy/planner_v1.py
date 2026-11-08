#!/usr/bin/env python3
"""Prepare Funnel/Vercel commands; execute only with the explicit --execute flag."""

import argparse
import json
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]


def https_origin(value):
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
        or "*" in value
        or value.strip() != value
    ):
        raise argparse.ArgumentTypeError("Use an exact HTTPS origin without paths or credentials")
    return value


def command_for(args):
    if args.route == "funnel":
        env = {"PLANNER_PRIMARY_WEB_ORIGIN": args.vercel_origin} if args.vercel_origin else {}
        return ["bash", str(ROOT / "tools/dev/planner-v1.sh"), "--funnel"], env
    if args.backend == args.origin:
        raise ValueError("Frontend and backend origins must differ; a self-proxy would loop")
    return [
        "vercel",
        "deploy",
        "--prod",
        "--cwd",
        str(ROOT / "apps/web"),
        "--build-env",
        "API_ORIGIN=" + args.backend,
        "--env",
        "API_ORIGIN=" + args.backend,
    ], {}


def check(origin):
    for path in ("/login", "/api/v1/health"):
        with urlopen(origin + path, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError(f"{path}: HTTP {response.status}")
            if path.endswith("health") and json.load(response).get("status") != "ready":
                raise RuntimeError("API did not report ready")
            print(f"PASS {origin}{path}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    routes = parser.add_subparsers(dest="route", required=True)
    funnel = routes.add_parser("funnel", help="Watched local runtime exposed through Tailscale")
    funnel.add_argument(
        "--vercel-origin",
        type=https_origin,
        help="Stable Vercel/custom origin; also becomes the email-link origin",
    )
    vercel = routes.add_parser("vercel", help="Next.js on Vercel with a public HTTPS backend")
    vercel.add_argument("--backend", type=https_origin, required=True)
    vercel.add_argument(
        "--origin",
        type=https_origin,
        required=True,
        help="Stable frontend origin, also supplied to the Funnel launcher",
    )
    for route in (funnel, vercel):
        route.add_argument("--execute", action="store_true", help="Run the printed command")
    probe = routes.add_parser("check", help="Read-only frontend and forwarded API readiness")
    probe.add_argument("--url", type=https_origin, required=True)
    args = parser.parse_args(argv)
    if args.route == "check":
        check(args.url)
        return
    try:
        command, values = command_for(args)
    except ValueError as error:
        parser.error(str(error))
    if args.route == "vercel":
        print("Backend must run with this primary frontend origin: " + args.origin)
        if urlsplit(args.backend).hostname.endswith(".ts.net"):
            print(
                "Use: "
                + shlex.join(
                    [
                        "python3",
                        str(ROOT / "tools/deploy/planner_v1.py"),
                        "funnel",
                        "--vercel-origin",
                        args.origin,
                        "--execute",
                    ]
                )
            )
        else:
            print("Set PLANNER_WEB_ORIGIN to the frontend origin on the backend service.")
            print("Render/Supabase setup: docs/migration/render-vercel-supabase.md")
        print("Only the configured stable origin is trusted; arbitrary preview URLs are not.")
    print(shlex.join(["env", *[f"{key}={value}" for key, value in values.items()], *command]))
    if args.execute:
        if not shutil.which(command[0]):
            parser.error(f"Install {command[0]} first; no command was executed")
        subprocess.run(command, cwd=ROOT, env={**os.environ, **values}, check=True)
    else:
        print("Plan only. No server, deployment, credentials or data were changed.")


if __name__ == "__main__":
    main()
