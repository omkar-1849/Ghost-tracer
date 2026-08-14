import re

from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.schemas.organization_schema import MemberResponse
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.models.user import User
from app.services.audit_log_service import create_audit_log


ALLOWED_ROLES = {
    "owner",
    "admin",
    "analyst",
    "viewer",
}


def generate_slug(name: str) -> str:
    slug = name.lower().strip()

    slug = re.sub(
        r"[^a-z0-9]+",
        "-",
        slug,
    )

    slug = slug.strip("-")

    return slug


def create_organization(
    db: Session,
    user: User,
    name: str,
) -> Organization:

    slug = generate_slug(name)

    existing = (
        db.query(Organization)
        .filter(Organization.slug == slug)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="An organization with this name already exists.",
        )

    organization = Organization(
        name=name.strip(),
        slug=slug,
    )

    db.add(organization)
    db.flush()

    membership = OrganizationMember(
        organization_id=organization.id,
        user_id=user.id,
        role="owner",
    )

    db.add(membership)

    db.commit()
    db.refresh(organization)

    return organization


def get_user_organization(
    db: Session,
    user: User,
) -> Organization:

    membership = (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user.id
        )
        .first()
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="User does not belong to an organization.",
        )

    organization = (
        db.query(Organization)
        .filter(
            Organization.id == membership.organization_id
        )
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    return organization


def get_members(
    db: Session,
    organization_id: int,
) -> list[MemberResponse]:

    results = (
        db.query(
            OrganizationMember,
            User,
        )
        .join(
            User,
            User.id == OrganizationMember.user_id,
        )
        .filter(
            OrganizationMember.organization_id
            == organization_id
        )
        .order_by(
            OrganizationMember.created_at.asc()
        )
        .all()
    )

    return [
        {
            "id": membership.id,
            "user_id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": membership.role,
            "created_at": membership.created_at,
        }
        for membership, user in results
    ]


def get_membership(
    db: Session,
    user_id: int,
    organization_id: int,
) -> OrganizationMember | None:

    return (
        db.query(OrganizationMember)
        .filter(
            OrganizationMember.user_id == user_id,
            OrganizationMember.organization_id
            == organization_id,
        )
        .first()
    )


def require_role(
    db: Session,
    user: User,
    organization_id: int,
    allowed_roles: set[str],
) -> OrganizationMember:

    membership = get_membership(
        db,
        user.id,
        organization_id,
    )

    if not membership:
        raise HTTPException(
            status_code=403,
            detail="You are not a member of this organization.",
        )

    if membership.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )

    return membership


def add_member(
    db: Session,
    organization_id: int,
    email: str,
    role: str,
) -> MemberResponse:

    role = role.lower().strip()

    if role not in ALLOWED_ROLES - {"owner"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid role.",
        )

    user = (
        db.query(User)
        .filter(
            User.email == email.lower().strip()
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found.",
        )

    existing = get_membership(
        db,
        user.id,
        organization_id,
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="User is already a member of this organization.",
        )

    membership = OrganizationMember(
        organization_id=organization_id,
        user_id=user.id,
        role=role,
    )

    db.add(membership)
    db.commit()
    db.refresh(membership)

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user.id,
        action="ADD_ORGANIZATION_MEMBER",
        resource_type="ORGANIZATION_MEMBER",
        resource_id=str(membership.id),
        description=f"User {user.email} added as member with role '{role}'.",
    )

    return {
        "id": membership.id,
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": membership.role,
        "created_at": membership.created_at,
    }


def update_member_role(
    db: Session,
    organization_id: int,
    user_id: int,
    role: str,
) -> OrganizationMember:

    role = role.lower().strip()

    if role not in ALLOWED_ROLES - {"owner"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid role.",
        )

    membership = get_membership(
        db,
        user_id,
        organization_id,
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Organization member not found.",
        )

    if membership.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="The organization owner role cannot be changed.",
        )

    old_role = membership.role
    membership.role = role

    db.commit()
    db.refresh(membership)

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="CHANGE_MEMBER_ROLE",
        resource_type="ORGANIZATION_MEMBER",
        resource_id=str(membership.id),
        description=f"Member role changed from '{old_role}' to '{role}'.",
    )

    return membership


def remove_member(
    db: Session,
    organization_id: int,
    user_id: int,
) -> None:

    membership = get_membership(
        db,
        user_id,
        organization_id,
    )

    if not membership:
        raise HTTPException(
            status_code=404,
            detail="Organization member not found.",
        )

    if membership.role == "owner":
        raise HTTPException(
            status_code=400,
            detail="The organization owner cannot be removed.",
        )

    membership_id = membership.id
    target_email = None

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user:
        target_email = user.email

    db.delete(membership)
    db.commit()

    create_audit_log(
        db=db,
        organization_id=organization_id,
        user_id=user_id,
        action="REMOVE_ORGANIZATION_MEMBER",
        resource_type="ORGANIZATION_MEMBER",
        resource_id=str(membership_id),
        description=f"Member {target_email or ('user ' + str(user_id))} removed from organization.",
    )
