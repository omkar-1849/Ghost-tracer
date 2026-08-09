from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.schemas.organization_schema import (
    MemberCreate,
    MemberResponse,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationUpdate,
    RoleUpdate,
)
from app.services.organization_service import (
    add_member,
    create_organization,
    get_members,
    get_user_organization,
    remove_member,
    require_role,
    update_member_role,
)
from app.utils.security import get_current_user


router = APIRouter(
    prefix="/organization",
    tags=["Organization"],
)


@router.post(
    "",
    response_model=OrganizationResponse,
    status_code=201,
)
def create(
    data: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_organization(
        db,
        current_user,
        data.name,
    )


@router.get(
    "",
    response_model=OrganizationResponse,
)
def get_organization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_user_organization(
        db,
        current_user,
    )


@router.put(
    "",
    response_model=OrganizationResponse,
)
def update_organization(
    data: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization = get_user_organization(
        db,
        current_user,
    )

    require_role(
        db,
        current_user,
        organization.id,
        {"owner", "admin"},
    )

    organization.name = data.name.strip()

    db.commit()
    db.refresh(organization)

    return organization


@router.get(
    "/members",
    response_model=list[MemberResponse],
)
def list_members(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization = get_user_organization(
        db,
        current_user,
    )

    require_role(
        db,
        current_user,
        organization.id,
        {"owner", "admin", "analyst", "viewer"},
    )

    return get_members(
        db,
        organization.id,
    )


@router.post(
    "/members",
    response_model=MemberResponse,
    status_code=201,
)
def create_member(
    data: MemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization = get_user_organization(
        db,
        current_user,
    )

    require_role(
        db,
        current_user,
        organization.id,
        {"owner", "admin"},
    )

    return add_member(
        db,
        organization.id,
        data.email,
        data.role,
    )


@router.put(
    "/members/{user_id}/role",
)
def change_member_role(
    user_id: int,
    data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization = get_user_organization(
        db,
        current_user,
    )

    require_role(
        db,
        current_user,
        organization.id,
        {"owner", "admin"},
    )

    membership = update_member_role(
        db,
        organization.id,
        user_id,
        data.role,
    )

    return {
        "message": "Member role updated successfully.",
        "role": membership.role,
    }


@router.delete(
    "/members/{user_id}",
)
def delete_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    organization = get_user_organization(
        db,
        current_user,
    )

    require_role(
        db,
        current_user,
        organization.id,
        {"owner", "admin"},
    )

    remove_member(
        db,
        organization.id,
        user_id,
    )

    return {
        "message": "Member removed successfully.",
    }