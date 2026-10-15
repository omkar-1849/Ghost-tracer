"""CLI utility for provisioning administrative organizations and users.

Used when REGISTRATION_MODE=closed to bootstrap initial platform access without
relying on public registration endpoints. Never logs or prints cleartext credentials.
"""

import argparse
import getpass
import os
import re
import sys

from app.database.database import SessionLocal
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.utils.security import hash_password


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return cleaned or "default-org"


def bootstrap_admin(
    email: str,
    password: str,
    org_name: str,
    full_name: str = "Administrator",
    role: str = "owner",
) -> tuple[int, int]:
    """Provision an organization and administrative user. Returns (org_id, user_id)."""
    email_clean = email.strip().lower()
    if "@" not in email_clean or len(email_clean) < 5:
        raise ValueError("Invalid email format")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    db = SessionLocal()
    db.info["system_scope"] = True
    try:
        # Check existing user
        existing_user = db.query(User).filter(User.email == email_clean).first()
        if existing_user:
            raise ValueError(f"User with email '{email_clean}' already exists (ID: {existing_user.id})")

        # Find or create organization
        org_slug = slugify(org_name)
        org = db.query(Organization).filter(
            (Organization.slug == org_slug) | (Organization.name == org_name)
        ).first()

        if not org:
            org = Organization(name=org_name, slug=org_slug)
            db.add(org)
            db.flush()

        # Create user
        pwd_hash = hash_password(password)
        user = User(
            email=email_clean,
            password_hash=pwd_hash,
            full_name=full_name,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()

        # Create membership
        member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=role.lower(),
        )
        db.add(member)
        db.commit()

        return org.id, user.id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Bootstrap initial Sentinel administrator and organization.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--org", default="Primary Security Team", help="Organization name")
    parser.add_argument("--name", default="Administrator", help="Full name of administrator")
    parser.add_argument("--role", default="owner", choices=["owner", "admin"], help="Role within organization")
    parser.add_argument(
        "--password",
        default=os.environ.get("SENTINEL_ADMIN_PASSWORD"),
        help="Password (defaults to SENTINEL_ADMIN_PASSWORD environment variable or interactive prompt)",
    )

    args = parser.parse_args()

    password = args.password
    if not password:
        password = getpass.getpass("Enter administrator password: ")
        confirm = getpass.getpass("Confirm administrator password: ")
        if password != confirm:
            print("Error: Passwords do not match", file=sys.stderr)
            sys.exit(1)

    try:
        org_id, user_id = bootstrap_admin(
            email=args.email,
            password=password,
            org_name=args.org,
            full_name=args.name,
            role=args.role,
        )
        print(f"Successfully bootstrapped admin user (ID: {user_id}) for organization '{args.org}' (ID: {org_id})")
    except Exception as exc:
        print(f"Failed to bootstrap administrator: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
