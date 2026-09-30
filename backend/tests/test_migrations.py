"""Isolated migration tests; never import the configured application engine.

Run from backend: python -m unittest discover -s tests -p test_migrations.py -v
"""
from datetime import datetime
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.orm import configure_mappers
from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import mysql

from app.database.base import Base, TenantOwned
from app.database.migrations import (
    OwnershipMappingError, SchemaMismatchError, _tables, _unique_object,
    check_schema, main, migrate,
)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.engine = create_engine("sqlite:///" + str(Path(self.temp.name) / "isolated.sqlite"))
        event.listen(self.engine, "connect", self._enable_fks)

    @staticmethod
    def _enable_fks(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")

    def tearDown(self):
        self.engine.dispose()
        self.temp.cleanup()

    def legacy(self):
        # Deliberately incomplete pre-migration schema, with real parent edges.
        with self.engine.begin() as conn:
            conn.exec_driver_sql("CREATE TABLE organizations (id INTEGER PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255))")
            conn.exec_driver_sql("INSERT INTO organizations VALUES (7, 'A', 'a'), (8, 'B', 'b')")
            conn.exec_driver_sql("CREATE TABLE websites (id INTEGER PRIMARY KEY, url VARCHAR(255), created_at DATETIME, updated_at DATETIME)")
            conn.exec_driver_sql("INSERT INTO websites VALUES (1, 'https://one.invalid', '2020-01-02 05:30:00.000000', '2020-01-03 05:30:00.000000'), (2, 'https://two.invalid', NULL, NULL)")
            conn.exec_driver_sql("CREATE TABLE integrations (id INTEGER PRIMARY KEY, website_id INTEGER REFERENCES websites(id))")
            conn.exec_driver_sql("INSERT INTO integrations VALUES (3, 1)")
            conn.exec_driver_sql("CREATE TABLE events (id INTEGER PRIMARY KEY, website_id INTEGER REFERENCES websites(id), integration_id INTEGER REFERENCES integrations(id))")
            conn.exec_driver_sql("INSERT INTO events VALUES (4, 1, 3)")
            conn.exec_driver_sql("CREATE TABLE logs (id INTEGER PRIMARY KEY, message VARCHAR(255))")
            conn.exec_driver_sql("INSERT INTO logs VALUES (5, 'unknown historical tenant')")
            conn.exec_driver_sql("CREATE TABLE alerts (id INTEGER PRIMARY KEY, website_id INTEGER REFERENCES websites(id), event_id INTEGER REFERENCES events(id))")
            conn.exec_driver_sql("INSERT INTO alerts VALUES (6, 1, 4)")
            conn.exec_driver_sql("CREATE TABLE incidents (id INTEGER PRIMARY KEY, alert_id INTEGER REFERENCES alerts(id))")
            conn.exec_driver_sql("INSERT INTO incidents VALUES (10, 6)")
            conn.exec_driver_sql("CREATE TABLE incident_notes (id INTEGER PRIMARY KEY, incident_id INTEGER REFERENCES incidents(id))")
            conn.exec_driver_sql("INSERT INTO incident_notes VALUES (11, 10)")
            conn.exec_driver_sql("CREATE TABLE scans (id INTEGER PRIMARY KEY, website_id INTEGER REFERENCES websites(id))")
            conn.exec_driver_sql("INSERT INTO scans VALUES (12, 1)")
            conn.exec_driver_sql("CREATE TABLE scan_results (id INTEGER PRIMARY KEY, target VARCHAR(255))")
            conn.exec_driver_sql("INSERT INTO scan_results VALUES (13, 'https://one.invalid')")
            conn.exec_driver_sql("CREATE TABLE settings (id INTEGER PRIMARY KEY)")
            conn.exec_driver_sql("INSERT INTO settings VALUES (14)")
            conn.exec_driver_sql("CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, organization_id INTEGER, user_id INTEGER)")
            conn.exec_driver_sql("INSERT INTO audit_logs VALUES (15, NULL, 999)")

    def owner(self, table, row_id):
        table = Base.metadata.tables[table]
        with self.engine.connect() as conn:
            return conn.execute(select(table.c.organization_id).where(table.c.id == row_id)).scalar_one()

    def test_check_empty_is_read_only(self):
        with self.assertRaises(SchemaMismatchError):
            check_schema(self.engine)
        self.assertEqual(inspect(self.engine).get_table_names(), [])

    def test_fresh_and_repeatable(self):
        first = migrate(self.engine)
        check_schema(self.engine)
        second = migrate(self.engine)
        self.assertEqual(first["version"], 1)
        self.assertEqual(second["added_columns"], [])
        self.assertEqual(second["ownership_assignments"], 0)
        self.assertEqual(first["legacy_constraints"], [])
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT count(*) FROM sentinel_schema_versions")).scalar_one(), 1)

    def test_legacy_unowned_quarantined_without_guesses(self):
        self.legacy()
        report = migrate(self.engine)
        check_schema(self.engine)
        for table, row_id in [("websites", 1), ("integrations", 3), ("events", 4),
                              ("logs", 5), ("scan_results", 13)]:
            self.assertIsNone(self.owner(table, row_id))
        self.assertEqual(report["ownership_assignments"], 0)
        self.assertEqual(report["quarantined"]["scan_results"], 1)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT user_id FROM audit_logs WHERE id=15")).scalar_one(), 999)
            self.assertEqual(conn.execute(text("SELECT truncated, version FROM scans")).one(), (0, 0))

    def test_explicit_mapping_and_parent_inference_preserve_times(self):
        self.legacy()
        report = migrate(self.engine, {"website": {"1": 7}, "settings": {"14": 8}})
        for table, row_id in [("websites", 1), ("integrations", 3), ("events", 4),
                              ("alerts", 6), ("incidents", 10), ("incident_notes", 11), ("scans", 12)]:
            self.assertEqual(self.owner(table, row_id), 7)
        self.assertEqual(self.owner("settings", 14), 8)
        self.assertIsNone(self.owner("websites", 2))
        self.assertIsNone(self.owner("logs", 5))
        self.assertIsNone(self.owner("scan_results", 13))
        self.assertEqual(report["ownership_assignments"], 8)
        with self.engine.connect() as conn:
            self.assertEqual(conn.execute(text("SELECT created_at, updated_at FROM websites WHERE id=1")).one(),
                             ("2020-01-02 05:30:00.000000", "2020-01-03 05:30:00.000000"))
        repeated = migrate(self.engine, {"website": {"1": 7}})
        self.assertEqual(repeated["ownership_assignments"], 0)
        self.assertEqual(repeated["added_columns"], [])

    def test_mapping_can_be_applied_after_initial_migration(self):
        self.legacy()
        migrate(self.engine)
        migrate(self.engine, {"log": {"5": 8}, "incident": {"10": 7}})
        self.assertEqual(self.owner("logs", 5), 8)
        self.assertEqual(self.owner("incident_notes", 11), 7)
        self.assertIsNone(self.owner("websites", 1))  # Never infer backwards.

    def test_invalid_mapping_rejected_before_ddl(self):
        self.legacy()
        for mapping in [{"website": {"1": 999}}, {"website": {"999": 7}},
                        {"event": {"4": 7}}, {"website; DROP TABLE logs": {}},
                        {"website": {"1 OR 1=1": 7}}, {"website": {"1": True}},
                        {"website": {"01": 7, "1": 7}}]:
            with self.subTest(mapping=mapping), self.assertRaises(OwnershipMappingError):
                migrate(self.engine, mapping)
            self.assertNotIn("organization_id", {col["name"] for col in inspect(self.engine).get_columns("websites")})

    def test_contradictory_mapping_rejected_before_ddl(self):
        self.legacy()
        with self.assertRaises(OwnershipMappingError):
            migrate(self.engine, {"website": {"1": 7}, "alert": {"6": 8}})
        self.assertNotIn("organization_id", {col["name"] for col in inspect(self.engine).get_columns("websites")})

    def test_existing_owner_cannot_be_remapped(self):
        self.legacy()
        migrate(self.engine, {"website": {"1": 7}})
        with self.assertRaises(OwnershipMappingError):
            migrate(self.engine, {"website": {"1": 8}})
        self.assertEqual(self.owner("websites", 1), 7)

    def test_ambiguous_parent_chain_rejected(self):
        self.legacy()
        with self.engine.begin() as conn:
            conn.exec_driver_sql("UPDATE events SET website_id=2 WHERE id=4")
        with self.assertRaises(OwnershipMappingError):
            migrate(self.engine, {"website": {"1": 7, "2": 8}})

    def test_unresolved_parent_blocks_inference(self):
        self.legacy()
        with self.engine.begin() as conn:
            conn.exec_driver_sql("UPDATE events SET website_id=2 WHERE id=4")
        migrate(self.engine, {"website": {"1": 7}})
        self.assertEqual(self.owner("integrations", 3), 7)
        self.assertIsNone(self.owner("events", 4))
        self.assertIsNone(self.owner("alerts", 6))

    def test_missing_column_guard_with_version_present(self):
        self.legacy()
        with self.engine.begin() as conn:
            conn.exec_driver_sql("CREATE TABLE sentinel_schema_versions (version INTEGER PRIMARY KEY, applied_at DATETIME)")
            conn.exec_driver_sql("INSERT INTO sentinel_schema_versions VALUES (1, CURRENT_TIMESTAMP)")
        with self.assertRaisesRegex(SchemaMismatchError, "missing column"):
            check_schema(self.engine)
        migrate(self.engine)
        check_schema(self.engine)

    def test_newer_version_refused(self):
        migrate(self.engine)
        with self.engine.begin() as conn:
            conn.exec_driver_sql("INSERT INTO sentinel_schema_versions VALUES (2, CURRENT_TIMESTAMP)")
        with self.assertRaises(SchemaMismatchError):
            migrate(self.engine)
        with self.assertRaises(SchemaMismatchError):
            check_schema(self.engine)

    def test_security_history_survives_parent_deletes(self):
        migrate(self.engine)
        tables = Base.metadata.tables
        with self.engine.begin() as conn:
            conn.execute(tables["organizations"].insert().values(id=7, name="A", slug="a"))
            conn.execute(tables["websites"].insert().values(id=1, organization_id=7))
            conn.execute(tables["integrations"].insert().values(id=3, website_id=1, organization_id=7, api_key_hash="x", api_secret_hash="y"))
            conn.execute(tables["events"].insert().values(id=4, website_id=1, integration_id=3, organization_id=7, event_type="x", source="x", title="x"))
            conn.execute(tables["logs"].insert().values(id=5, website_id=1, organization_id=7))
            conn.execute(tables["alerts"].insert().values(id=6, website_id=1, event_id=4, log_id=5, organization_id=7))
            conn.execute(tables["incidents"].insert().values(id=10, website_id=1, alert_id=6, organization_id=7))
            conn.execute(tables["websites"].delete().where(tables["websites"].c.id == 1))
            self.assertEqual(conn.execute(select(tables["alerts"].c.website_id, tables["alerts"].c.event_id)).one(), (None, None))
            self.assertIsNone(conn.execute(select(tables["logs"].c.website_id)).scalar_one())
            conn.execute(tables["logs"].delete())
            self.assertIsNone(conn.execute(select(tables["alerts"].c.log_id)).scalar_one())
            conn.execute(tables["alerts"].delete())
            self.assertEqual(conn.execute(select(tables["incidents"].c.website_id, tables["incidents"].c.alert_id, tables["incidents"].c.organization_id)).one(), (None, None, 7))

    def test_models_map_and_compile_for_mysql_without_connection(self):
        tables = _tables()
        configure_mappers()
        for table in tables:
            self.assertIn("CREATE TABLE", str(CreateTable(table).compile(dialect=mysql.dialect())))
        from app.models.settings import Settings
        from app.models.user import User
        from app.models.event import Event
        self.assertIsInstance(Settings.organization_id.property.columns[0].type, type(Event.organization_id.property.columns[0].type))
        self.assertTrue(issubclass(Settings, TenantOwned))
        self.assertFalse(issubclass(User, TenantOwned))
        self.assertEqual(Settings.__table__.c.api_key.default.arg, "")
        now = datetime.utcnow()
        created = Event.__table__.c.created_at.default.arg(None)
        self.assertLess(abs((created - now).total_seconds()), 2)

    def test_cli_requires_external_backup_before_engine_creation(self):
        with patch("app.database.migrations.create_engine") as factory:
            with self.assertRaises(SystemExit):
                main(["--database-url", "sqlite:///:memory:"])
            factory.assert_not_called()

    def test_duplicate_json_keys_rejected(self):
        with self.assertRaises(OwnershipMappingError):
            json.loads('{"website":{"1":7,"1":8}}', object_pairs_hook=_unique_object)


if __name__ == "__main__":
    unittest.main()
