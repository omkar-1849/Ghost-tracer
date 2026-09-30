from sqlalchemy import create_engine, event, inspect
from sqlalchemy.orm import Session, sessionmaker, with_loader_criteria

from app.config.runtime import get_runtime_config
from app.database.base import TenantOwned

config = get_runtime_config()
DATABASE_URL = config.database_url
engine_options = {"pool_pre_ping": True, "hide_parameters": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_options)


class TenantSession(Session):
    pass


@event.listens_for(TenantSession, "do_orm_execute")
def scope_queries(state):
    if state.session.info.get("system_scope"):
        return
    organization_id = state.session.info.get("organization_id", -1)
    if state.is_select:
        state.statement = state.statement.options(
            with_loader_criteria(
                TenantOwned, lambda model: model.organization_id == organization_id,
                include_aliases=True,
            )
        )
        from app.models.audit_log import AuditLog
        state.statement = state.statement.options(
            with_loader_criteria(AuditLog, AuditLog.organization_id == organization_id, include_aliases=True)
        )
    elif state.is_update or state.is_delete:
        for mapper in state.all_mappers:
            model = mapper.class_
            if issubclass(model, TenantOwned):
                state.statement = state.statement.where(model.organization_id == organization_id)


@event.listens_for(TenantSession, "before_flush")
def enforce_tenant_writes(db, _flush_context, _instances):
    if db.info.get("system_scope"):
        return
    organization_id = db.info.get("organization_id")
    objects = set(db.new) | set(db.dirty) | set(db.deleted)
    for obj in objects:
        if not isinstance(obj, TenantOwned):
            continue
        if organization_id is None:
            raise ValueError("Tenant context is required for resource writes.")
        state = inspect(obj)
        if obj in db.new and obj.organization_id is None:
            obj.organization_id = organization_id
        if obj.organization_id != organization_id:
            raise ValueError("Cross-tenant resource write denied.")
        history = state.attrs.organization_id.history
        if obj not in db.new and history.has_changes():
            raise ValueError("Resource ownership cannot be changed through application writes.")
        for field, model_name in (("website_id", "Website"), ("integration_id", "Integration"),
                                  ("incident_id", "Incident"), ("alert_id", "Alert"),
                                  ("event_id", "Event"), ("log_id", "Log")):
            parent_id = getattr(obj, field, None)
            if parent_id is None:
                continue
            from app.database.base import Base
            parent_model = next((m.class_ for m in Base.registry.mappers if m.class_.__name__ == model_name), None)
            if parent_model is None:
                raise ValueError("Resource parent model is unavailable.")
            parent = db.query(parent_model).filter(parent_model.id == parent_id).first()
            if parent is None or parent.organization_id != organization_id:
                raise ValueError("Resource parent does not belong to this tenant.")
            if field == "integration_id" and getattr(obj, "website_id", None) != parent.website_id:
                raise ValueError("Integration and website do not match.")


SessionLocal = sessionmaker(bind=engine, class_=TenantSession, autoflush=False, expire_on_commit=False)


@event.listens_for(engine, "connect")
def sqlite_foreign_keys(connection, _record):
    if engine.dialect.name == "sqlite":
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
