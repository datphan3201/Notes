"""Grant/revoke roles only from an authenticated server operator's console."""

import argparse

from sqlalchemy import select

from planner.db import session_factory
from planner.models import AdminAction, User


def main():
    parser = argparse.ArgumentParser(
        description="Set a Planner account role; never exposed over HTTP"
    )
    parser.add_argument("email")
    parser.add_argument("role", choices=("user", "admin"))
    args = parser.parse_args()
    with session_factory()() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()).with_for_update())
        if user is None:
            parser.error("Account does not exist")
        if user.locked_at:
            parser.error("Unlock this account before changing its role")
        user.role = args.role
        db.add(
            AdminAction(actor_id=user.id, action="Server console role change", subject=args.role)
        )
        db.commit()
    print("Account role updated and audited")


if __name__ == "__main__":
    main()
