from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.organization import Organization
from app.models.organization_member import OrganizationMember
from app.schemas.organization_schema import MemberCreate, MemberResponse, OrganizationCreate, OrganizationResponse, OrganizationUpdate, RoleUpdate
from app.services import organization_service as service
from app.utils.security import get_current_user
from app.utils.authorization import TenantContext, get_tenant_context, require_roles

router = APIRouter(prefix="/organization", tags=["Organization"])


@router.post("", response_model=OrganizationResponse, status_code=201)
def create(data: OrganizationCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    return service.create_organization(db, user, data.name)


@router.get("/list")
def list_organizations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (db.query(Organization, OrganizationMember.role)
            .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
            .filter(OrganizationMember.user_id == user.id).all())
    return [{"id": org.id, "name": org.name, "current_user_role": role} for org, role in rows]


@router.get("", response_model=OrganizationResponse)
def get_organization(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return service.get_user_organization(db, ctx.user, ctx.organization_id)


@router.put("", response_model=OrganizationResponse)
def update_organization(data: OrganizationUpdate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    organization = service.get_user_organization(db, ctx.user, ctx.organization_id)
    organization.name = data.name.strip()
    db.flush()
    return organization


@router.get("/members", response_model=list[MemberResponse])
def list_members(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return service.get_members(db, ctx.organization_id)


@router.post("/members", response_model=MemberResponse, status_code=201)
def create_member(data: MemberCreate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    return service.add_member(db, ctx.organization_id, data.email, data.role, actor_id=ctx.user.id)


@router.put("/members/{user_id}/role")
def change_member_role(user_id: int, data: RoleUpdate, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    membership = service.update_member_role(db, ctx.organization_id, user_id, data.role, actor_id=ctx.user.id)
    return {"message": "Member role updated successfully.", "role": membership.role}


@router.delete("/members/{user_id}")
def delete_member(user_id: int, db: Session = Depends(get_db), ctx: TenantContext = Depends(require_roles("owner", "admin"))):
    service.remove_member(db, ctx.organization_id, user_id, actor_id=ctx.user.id)
    return {"message": "Member removed successfully."}
