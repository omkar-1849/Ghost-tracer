"""Explicit, additive schema migration. Importing this module never connects to a DB.

Callers of migrate() are responsible for an external, verified backup and for
stopping writers. The CLI requires an explicit backup acknowledgement.
"""
from __future__ import annotations

import argparse
from datetime import datetime
from importlib import import_module
import json
import os
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, MetaData, Table, create_engine,
    inspect, select, update,
)
from sqlalchemy.schema import AddConstraint

from app.database.base import Base

SCHEMA_VERSION = 1
MODEL_MODULES = (
    "user", "organization", "organization_member", "session", "password_reset_token",
    "website", "integration", "event", "log", "alert", "incident", "scan",
    "settings", "response_action", "incident_evidence", "incident_note",
    "incident_timeline", "scan_result", "audit_log",
)
ROOTS = {
    "website": "websites", "log": "logs", "alert": "alerts",
    "incident": "incidents", "settings": "settings",
}
TENANT_TABLES = (
    "websites", "integrations", "events", "logs", "alerts", "incidents", "scans",
    "settings", "response_actions", "incident_evidence", "incident_notes",
    "incident_timeline", "scan_results",
)
_version_metadata = MetaData()
_versions = Table(
    "sentinel_schema_versions", _version_metadata,
    Column("version", Integer, primary_key=True),
    Column("applied_at", DateTime, nullable=False),
)


class SchemaMismatchError(RuntimeError):
    """The database is not ready for this application; run explicit migration."""


class OwnershipMappingError(ValueError):
    """An operator mapping is malformed, unresolved, or contradicts a parent."""


def _tables():
    # Explicit model allowlist; never import database.py, main.py, or scanners.
    for module in MODEL_MODULES:
        import_module(f"app.models.{module}")
    names = set(TENANT_TABLES) | {
        "users", "organizations", "organization_members", "sessions",
        "password_reset_tokens", "audit_logs",
    }
    return [table for table in Base.metadata.sorted_tables if table.name in names]


def _positive_id(value):
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise OwnershipMappingError("IDs must be positive integers")
    if isinstance(value, str) and (not value.isascii() or not value.isdigit()):
        raise OwnershipMappingError("IDs must be positive integers")
    value = int(value)
    if value < 1:
        raise OwnershipMappingError("IDs must be positive integers")
    return value


def _normalize_mapping(mapping):
    if mapping is None:
        return {}
    if not isinstance(mapping, dict):
        raise OwnershipMappingError("Mapping must be a JSON object")
    normalized = {}
    for root, entries in mapping.items():
        if root not in ROOTS or not isinstance(entries, dict):
            raise OwnershipMappingError(f"Unknown root {root!r}; expected one of: {', '.join(sorted(ROOTS))}")
        normalized[ROOTS[root]] = {}
        for row_id, org_id in entries.items():
            row_id, org_id = _positive_id(row_id), _positive_id(org_id)
            if row_id in normalized[ROOTS[root]]:
                raise OwnershipMappingError("Duplicate normalized row ID")
            normalized[ROOTS[root]][row_id] = org_id
    return normalized


def _ownership_plan(conn, tables, mapping):
    """Validate against existing data BEFORE DDL; use only declared FK edges.

    No URL, IP, display-name, assignee, user, or organization-1 guesses. Multiple
    parent links must all resolve to the same known tenant before inference.
    """
    inspector = inspect(conn)
    existing = set(inspector.get_table_names())
    by_name = {table.name: table for table in tables}
    orgs = set()
    if "organizations" in existing:
        orgs = set(conn.execute(select(by_name["organizations"].c.id)).scalars())
    rows, edges, original = {}, {}, {}
    for name in TENANT_TABLES:
        table = by_name[name]
        links = [
            (fk.parent.name, fk.column.table.name)
            for fk in table.foreign_keys if fk.column.table.name in TENANT_TABLES
        ]
        edges[name] = links
        rows[name] = {}
        if name not in existing:
            continue
        available = {col["name"] for col in inspector.get_columns(name)}
        wanted = {"id", "organization_id"} | {col for col, _ in links}
        columns = [table.c[col] for col in sorted(wanted & available)]
        if "id" not in available:
            raise SchemaMismatchError(f"Existing table {name} has no id; manual review required")
        for row in conn.execute(select(*columns)).mappings():
            data = dict(row)
            data.setdefault("organization_id", None)
            for col, _ in links:
                data.setdefault(col, None)
            if data["organization_id"] is not None and data["organization_id"] not in orgs:
                raise OwnershipMappingError(f"{name} id={data['id']} references an unknown organization")
            rows[name][data["id"]] = data
            original[(name, data["id"])] = data["organization_id"]
    for name, entries in mapping.items():
        for row_id, org_id in entries.items():
            if org_id not in orgs:
                raise OwnershipMappingError(f"Unknown organization id={org_id}")
            if row_id not in rows[name]:
                raise OwnershipMappingError(f"Unknown {name} id={row_id}")
            current = rows[name][row_id]["organization_id"]
            if current is not None and current != org_id:
                raise OwnershipMappingError(f"Mapping contradicts existing {name} id={row_id}")
            rows[name][row_id]["organization_id"] = org_id
    changed = True
    while changed:
        changed = False
        for name, entries in rows.items():
            for row_id, row in entries.items():
                parent_orgs = []
                unresolved = False
                for column, parent in edges[name]:
                    if row[column] is None:
                        continue
                    parent_row = rows[parent].get(row[column])
                    if parent_row is None or parent_row["organization_id"] is None:
                        unresolved = True
                    else:
                        parent_orgs.append(parent_row["organization_id"])
                known = set(parent_orgs)
                if row["organization_id"] is not None:
                    known.add(row["organization_id"])
                if len(known) > 1:
                    raise OwnershipMappingError(f"Contradictory tenant links on {name} id={row_id}")
                if row["organization_id"] is None and parent_orgs and not unresolved:
                    row["organization_id"] = parent_orgs[0]
                    changed = True
    assignments = [
        (name, row_id, row["organization_id"])
        for name, entries in rows.items() for row_id, row in entries.items()
        if original[(name, row_id)] is None and row["organization_id"] is not None
    ]
    quarantined = {
        name: sum(row["organization_id"] is None for row in entries.values())
        for name, entries in rows.items()
    }
    return assignments, quarantined


def _safe_default(column):
    # Only known scalar numeric/boolean defaults are backfilled. In particular,
    # never fabricate historical timestamps, secrets, users, or tenant IDs.
    if column.name == "organization_id" or column.foreign_keys:
        return None
    if isinstance(column.type, (Integer, Boolean)):
        if column.default is not None and column.default.is_scalar:
            value = column.default.arg
            if isinstance(value, (bool, int)):
                return str(int(value))
    return None


def _add_column(conn, table, column):
    if column.primary_key:
        raise SchemaMismatchError(f"Cannot add primary key {table.name}.{column.name} additively")
    quote = conn.dialect.identifier_preparer.quote
    # All identifiers originate in the explicit model allowlist, not operator JSON.
    definition = f"{quote(column.name)} {column.type.compile(dialect=conn.dialect)}"
    default = _safe_default(column)
    if default is not None:
        definition += f" DEFAULT {default}"
        if not column.nullable:
            definition += " NOT NULL"
    else:
        definition += " NULL"
    if conn.dialect.name == "sqlite":
        for fk in column.foreign_keys:
            definition += (
                f" REFERENCES {quote(fk.column.table.name)} ({quote(fk.column.name)})"
            )
            if fk.ondelete:
                # ondelete is fixed by trusted model metadata.
                definition += f" ON DELETE {fk.ondelete}"
    conn.exec_driver_sql(f"ALTER TABLE {quote(table.name)} ADD COLUMN {definition}")
    if conn.dialect.name == "mysql":
        for fk in column.foreign_keys:
            conn.execute(AddConstraint(fk.constraint))


def _schema_problems(conn, tables, require_version=True):
    inspector = inspect(conn)
    existing = set(inspector.get_table_names())
    problems = []
    for table in tables:
        if table.name not in existing:
            problems.append(f"missing table {table.name}")
            continue
        actual = {col["name"]: col for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name not in actual:
                problems.append(f"missing column {table.name}.{column.name}")
                continue
            kind = actual[column.name]["type"]
            # SQLite reflects JSON/Boolean as their declared types. MySQL may
            # represent JSON as LONGTEXT on MariaDB (MariaDB is not supported).
            if kind._type_affinity is not column.type._type_affinity:
                if not (conn.dialect.name == "mysql" and isinstance(column.type, Boolean)
                        and isinstance(kind, Integer)):
                    problems.append(f"incompatible type {table.name}.{column.name}")
            expected_length = getattr(column.type, "length", None)
            actual_length = getattr(kind, "length", None)
            if expected_length and actual_length and actual_length < expected_length:
                problems.append(f"short column {table.name}.{column.name}")
        indexes = {index["name"] for index in inspector.get_indexes(table.name)}
        for index in table.indexes:
            if index.name not in indexes:
                problems.append(f"missing index {index.name}")
    if require_version:
        if _versions.name not in existing:
            problems.append("migration version table missing")
        else:
            versions = set(conn.execute(select(_versions.c.version)).scalars())
            if SCHEMA_VERSION not in versions:
                problems.append(f"migration version {SCHEMA_VERSION} not applied")
            if any(version > SCHEMA_VERSION for version in versions):
                problems.append("database schema is newer than this application")
    return problems


def check_schema(engine):
    """Read-only readiness guard. Return None or raise SchemaMismatchError.

    Call before request sessions/startup. Never creates tables, alters data, or
    imports the application's configured engine. A nullable legacy owner is
    intentionally schema-compatible but must be denied by authorization.
    """
    with engine.connect() as conn:
        problems = _schema_problems(conn, _tables())
    if problems:
        raise SchemaMismatchError(
            "Database requires operator migration (python -m app.database.migrations): "
            + "; ".join(problems)
        )


def _legacy_constraint_notes(conn, tables):
    inspector = inspect(conn)
    notes = []
    for table in tables:
        actual_columns = {col["name"]: col for col in inspector.get_columns(table.name)}
        actual_fks = inspector.get_foreign_keys(table.name)
        for col in table.columns:
            if col.nullable != actual_columns[col.name]["nullable"] and not col.primary_key:
                notes.append(f"{table.name}.{col.name}: legacy nullability retained")
        for fk in table.foreign_keys:
            found = any(
                info["constrained_columns"] == [fk.parent.name]
                and info["referred_table"] == fk.column.table.name
                and info["referred_columns"] == [fk.column.name]
                and (info.get("options", {}).get("ondelete") or "NO ACTION").upper()
                    == (fk.ondelete or "NO ACTION").upper()
                for info in actual_fks
            )
            if not found:
                notes.append(f"{table.name}.{fk.parent.name}: legacy FK/delete policy requires manual review")
    return notes


def migrate(engine, ownership_mapping=None):
    """Apply repeatable additive changes to the explicitly provided engine.

    Prerequisite: operator verified an external backup and stopped all writers.
    Does NOT make a backup. SQLite and MySQL only; MySQL DDL can auto-commit.
    Returns version, added_columns, ownership_assignments, quarantined, and
    legacy_constraints. Existing types/constraints/timestamps are never rewritten.
    """
    if engine.dialect.name not in {"sqlite", "mysql"}:
        raise ValueError("Only SQLite and MySQL migrations are supported")
    mapping = _normalize_mapping(ownership_mapping)
    tables = _tables()
    with engine.begin() as conn:
        inspector = inspect(conn)
        existing = set(inspector.get_table_names())
        if _versions.name in existing:
            versions = set(conn.execute(select(_versions.c.version)).scalars())
            if any(version > SCHEMA_VERSION for version in versions):
                raise SchemaMismatchError("Refusing migration of a newer schema")
        assignments, quarantined = _ownership_plan(conn, tables, mapping)
        # Validate missing primary keys before making any changes.
        for table in tables:
            if table.name in existing:
                names = {col["name"] for col in inspector.get_columns(table.name)}
                if any(col.primary_key and col.name not in names for col in table.columns):
                    raise SchemaMismatchError(f"Manual primary-key repair required: {table.name}")
        # Explicit migration only. create_all adds missing tables; never recreates.
        Base.metadata.create_all(conn, tables=tables, checkfirst=True)
        added = []
        for table in tables:
            names = {col["name"] for col in inspect(conn).get_columns(table.name)}
            for column in table.columns:
                if column.name not in names:
                    _add_column(conn, table, column)
                    added.append(f"{table.name}.{column.name}")
            names = {index["name"] for index in inspect(conn).get_indexes(table.name)}
            for index in sorted(table.indexes, key=lambda item: item.name):
                if index.name not in names:
                    index.create(conn)
        problems = _schema_problems(conn, tables, require_version=False)
        if problems:
            raise SchemaMismatchError("Manual schema review required: " + "; ".join(problems))
        by_name = {table.name: table for table in tables}
        for name, row_id, org_id in assignments:
            table = by_name[name]
            # Core update invokes Python onupdate defaults unless overridden;
            # explicitly preserve every historical onupdate timestamp.
            values = {"organization_id": org_id}
            values.update({col.name: col for col in table.columns if col.onupdate is not None})
            conn.execute(update(table).where(
                table.c.id == row_id, table.c.organization_id.is_(None)
            ).values(**values))
        _versions.create(conn, checkfirst=True)
        if conn.execute(select(_versions.c.version).where(
            _versions.c.version == SCHEMA_VERSION
        )).first() is None:
            conn.execute(_versions.insert().values(version=SCHEMA_VERSION, applied_at=datetime.utcnow()))
        notes = _legacy_constraint_notes(conn, tables)
    return {
        "version": SCHEMA_VERSION, "added_columns": added,
        "ownership_assignments": len(assignments), "quarantined": quarantined,
        "legacy_constraints": notes,
    }


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise OwnershipMappingError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def main(argv=None):
    from app.config.runtime import _load_dotenv_if_present
    _load_dotenv_if_present()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--ownership-map", type=Path)
    parser.add_argument("--backup-confirmed", action="store_true",
                        help="I verified an external backup and stopped writers; this tool creates NO backup")
    args = parser.parse_args(argv)
    if not args.backup_confirmed:
        parser.error("An operator-verified external backup is required; pass --backup-confirmed")
    if not args.database_url:
        parser.error("Provide --database-url or DATABASE_URL (no hardcoded/live default)")
    mapping = None
    if args.ownership_map:
        mapping = json.loads(args.ownership_map.read_text(encoding="utf-8"), object_pairs_hook=_unique_object)
    engine = create_engine(args.database_url)
    try:
        report = migrate(engine, mapping)
        check_schema(engine)
        print(json.dumps(report, indent=2))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
