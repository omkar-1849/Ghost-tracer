from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.utils.authorization import TenantContext, get_tenant_context, require_roles, scoped_get

from app.services.dashboard_service import (
    get_dashboard_stats,
    get_top_attacking_ips,
    get_threat_activity,
    get_threat_distribution,
    get_top_targeted_urls,
    get_security_score,
    get_attack_types,
    get_live_attack_feed
)


router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"]
)


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_dashboard_stats(db, ctx.organization_id)

@router.get("/top-attacking-ips")
def top_attacking_ips(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_top_attacking_ips(db, ctx.organization_id)

@router.get("/threat-activity")
def threat_activity(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_threat_activity(db, ctx.organization_id)

@router.get("/threat-distribution")
def threat_distribution(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_threat_distribution(db, ctx.organization_id)

@router.get("/top-targeted-urls")
def top_targeted_urls(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_top_targeted_urls(db, ctx.organization_id)

@router.get("/security-score")
def security_score(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_security_score(db, ctx.organization_id)

@router.get("/attack-types")
def attack_types(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_attack_types(db, ctx.organization_id)

@router.get("/live-feed")
def live_feed(db: Session = Depends(get_db), ctx: TenantContext = Depends(get_tenant_context)):
    return get_live_attack_feed(db, ctx.organization_id)