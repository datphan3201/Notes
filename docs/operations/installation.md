# Installation

[Operations](README.md) · [Development commands](../migration/development.md)

Use Node 22, Python 3.12, uv, Docker with Compose, and a Linux-compatible shell for the development launcher. CI pins uv 0.12.0 and uses npm with `apps/web/package-lock.json`; Python installs use `apps/api/uv.lock`. A second pnpm lockfile exists but CI/launcher do not use it; choose npm for the documented reproducible path.

From the repository root:

```bash
bash tools/dev/planner-v1.sh
```

The launcher starts the persistent Compose `db`, checks configured/actual `planner_dev`, syncs locked packages, preserves/creates private API `.env` and encryption key, migrates forward, then starts web/API/worker watching. It requires free ports 3000/8001 and a writable ignored log directory. Stop with Ctrl+C; the database volume remains.

For separate terminals, environment setup, email/AI and Funnel, use the [development guide](../migration/development.md). Copy only `.env.example` into a private ignored `.env`; do not reuse production credentials for local testing. Open the browser at `http://localhost:3000` consistently. Backend defaults to port 8001; PostgreSQL development/test host ports are 5433/5434.

Do not install/run the retired PHP/JS stack from old instructions. A production install is a separate deployment with HTTPS, private object storage, email, stable encryption key and reviewed schema/pool settings; see [cloud operations](cloud.md).
