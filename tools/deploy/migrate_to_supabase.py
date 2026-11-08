#!/usr/bin/env python3
"""Sync local planner_dev data into Supabase planner schema atomically.

Local database is read-only. Writes to Supabase occur in a single transaction.
"""

import os
import sys
import psycopg

LOCAL_DEFAULT = "postgresql://planner:planner-local-only@127.0.0.1:5433/planner_dev"
CLOUD_DEFAULT = ""

TABLES_IN_ORDER = [
    "users",
    "areas",
    "goals",
    "milestones",
    "milestone_dependencies",
    "notes",
    "tasks",
    "task_series",
    "task_selections",
    "habits",
    "habit_days",
    "reviews",
    "activities",
    "documents",
    "import_receipts",
    "legacy_records",
    "ai_runs",
    "auth_tokens",
    "notifications",
    "rate_buckets",
    "jobs",
    "login_sessions",
    "system_settings",
    "admin_actions",
    "note_shares",
    "note_unlocks",
    "account_files",
    "attachments",
    "focus_goals",
    "reports",
]


def main():
    local_url = os.environ.get("PLANNER_LOCAL_DATABASE_URL", LOCAL_DEFAULT)
    cloud_url = os.environ.get("PLANNER_DATABASE_URL", CLOUD_DEFAULT)

    if not cloud_url:
        sys.exit("Error: PLANNER_DATABASE_URL environment variable is required.")

    print("Connecting to local database (read-only)...")
    src_conn = psycopg.connect(local_url)
    src_conn.read_only = True

    print("Connecting to Supabase database...")
    dst_conn = psycopg.connect(cloud_url)

    try:
        with src_conn.cursor() as src_cur, dst_conn.cursor() as dst_cur:
            # Check destination schema
            dst_cur.execute("SELECT version_num FROM planner.alembic_version")
            rev = dst_cur.fetchone()[0]
            print(f"Supabase schema 'planner' confirmed at Alembic revision: {rev}")

            # Check if destination already has users
            dst_cur.execute("SELECT count(*) FROM planner.users")
            existing_users = dst_cur.fetchone()[0]
            if existing_users > 0:
                print(f"WARNING: Destination planner.users already has {existing_users} rows.")

            print("\nStarting atomic binary transfer across all tables...")
            reconciliation = {}

            for table in TABLES_IN_ORDER:
                src_cur.execute(f"SELECT count(*) FROM public.{table}")
                src_count = src_cur.fetchone()[0]

                if src_count == 0:
                    continue

                print(f"  • Transferring {table}: {src_count} rows...", end="", flush=True)

                copy_src_sql = f"COPY (SELECT * FROM public.{table}) TO STDOUT (FORMAT binary)"
                copy_dst_sql = f"COPY planner.{table} FROM STDIN (FORMAT binary)"

                with src_cur.copy(copy_src_sql) as reader:
                    with dst_cur.copy(copy_dst_sql) as writer:
                        for chunk in reader:
                            writer.write(chunk)

                # Verify count in destination
                dst_cur.execute(f"SELECT count(*) FROM planner.{table}")
                dst_count = dst_cur.fetchone()[0]

                if dst_count != src_count:
                    raise RuntimeError(
                        f"Count mismatch for {table}: source has {src_count}, dest has {dst_count}!"
                    )

                reconciliation[table] = dst_count
                print(" OK")

            # Commit the transaction
            print("\nAll tables matched 100%! Committing transaction on Supabase...")
            dst_conn.commit()
            print("Transaction COMMITTED successfully!\n")

            print("=" * 60)
            print("RECONCILIATION SUMMARY (Local -> Supabase):")
            print("=" * 60)
            for tbl, cnt in reconciliation.items():
                print(f"  {tbl:<25}: {cnt} rows")
            print("=" * 60)
            print("Total entities transferred successfully.")

    except Exception as exc:
        dst_conn.rollback()
        print(f"\nERROR during transfer: {exc}")
        print("Destination transaction rolled back cleanly. No changes were made.")
        sys.exit(1)
    finally:
        src_conn.close()
        dst_conn.close()


if __name__ == "__main__":
    main()
