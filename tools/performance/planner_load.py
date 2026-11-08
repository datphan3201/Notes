"""Read-only authenticated workload. Run with apps/api's uv environment."""
import argparse
import asyncio
import json
import math
import os
import time
from collections import Counter

import httpx


async def benchmark(args):
    async with httpx.AsyncClient(base_url=args.base_url, timeout=30) as client:
        login = await client.post("/api/v1/auth/login", headers={"origin": args.origin}, json={
            "email": os.environ["PLANNER_LOAD_EMAIL"], "password": os.environ["PLANNER_LOAD_PASSWORD"]})
        login.raise_for_status()
        if login.json().get("requires_2fa"):
            raise RuntimeError("Use an isolated synthetic account without MFA for this workload")
        semaphore = asyncio.Semaphore(args.concurrency)
        timings, statuses = [], Counter()

        async def read():
            async with semaphore:
                started = time.perf_counter()
                try:
                    response = await client.get("/api/v1/" + args.resource + "?size=30")
                    statuses[str(response.status_code)] += 1
                except httpx.HTTPError:
                    statuses["network_error"] += 1
                timings.append((time.perf_counter() - started) * 1000)

        started = time.perf_counter()
        await asyncio.gather(*(read() for _ in range(args.requests)))
        elapsed = time.perf_counter() - started
        timings.sort()
        percentile = lambda fraction: round(timings[min(len(timings) - 1, math.ceil(fraction * len(timings)) - 1)], 2)
        result = {"base_url": args.base_url, "resource": args.resource, "requests": args.requests,
                  "concurrency": args.concurrency, "statuses": dict(statuses), "elapsed_s": round(elapsed, 3),
                  "requests_per_second": round(args.requests / elapsed, 2),
                  "p50_ms": percentile(.5), "p95_ms": percentile(.95), "p99_ms": percentile(.99),
                  "scope": "Local/read-only synthetic workload; not a production capacity claim"}
        print(json.dumps(result, indent=2))
        return 0 if statuses.get("200", 0) == args.requests else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8001")
    parser.add_argument("--origin", default="http://localhost:3000")
    parser.add_argument("--resource", choices=["tasks", "notes", "goals", "dashboard"], default="tasks")
    parser.add_argument("--requests", type=int, default=1000)
    parser.add_argument("--concurrency", type=int, default=100)
    arguments = parser.parse_args()
    if not 1 <= arguments.requests <= 10000 or not 1 <= arguments.concurrency <= 500:
        parser.error("Use 1–10000 requests and 1–500 concurrent requests")
    raise SystemExit(asyncio.run(benchmark(arguments)))
