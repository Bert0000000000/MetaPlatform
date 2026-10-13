"""Exercise realm migration commands and recovery without a shared Keycloak."""

from __future__ import annotations

import copy
import importlib.util
import io
import json
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path, PurePosixPath
from unittest.mock import patch

KIT = Path(__file__).resolve().parents[1]
COMPOSE = ["docker", "compose", "-f", "owned-compose.yml", "-p", "owned-ontology"]
KCADM = "/opt/keycloak/bin/kcadm.sh"
SESSION_DIRECTORY = str(PurePosixPath("/", "tmp", "mp11-auth.A1b2C3d4"))
ADMIN = {"id": "admin-role", "name": "PLATFORM_ADMIN", "composite": False}
USERNAME_MAPPER = {
    "name": "preferred_username",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-property-mapper",
    "consentRequired": False,
    "config": {
        "user.attribute": "username",
        "claim.name": "preferred_username",
        "jsonType.label": "String",
        "access.token.claim": "true",
        "id.token.claim": "true",
        "userinfo.token.claim": "true",
    },
}


def load(name):
    if name in sys.modules:
        return sys.modules[name]
    path = KIT / (name + ".py")
    if not path.is_file():
        raise AssertionError(f"Missing deployment implementation: {path.name}")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class KcadmFixture:
    """A strict CLI boundary with the documented Keycloak resource shapes."""

    def __init__(self):
        self.realm = {"realm": "metaplatform"}
        self.client = {
            "id": "backend-id",
            "clientId": "metaplatform-backend",
            "secret": "unchanged-client-secret",
        }
        self.role = copy.deepcopy(ADMIN)
        self.users = [{"id": "reader-id", "realmRoles": ["user"], "password": "unchanged"}]
        self.scopes = {
            sid: {"id": sid, "name": name, "protocol": "openid-connect"}
            for sid, name in (("profile-id", "profile"), ("roles-id", "roles"))
        }
        self.client_mappers = [
            {
                "id": "session-mapper",
                "name": "session",
                "protocol": "openid-connect",
                "protocolMapper": "oidc-usersessionmodel-note-mapper",
                "config": {
                    "user.session.note": "sid",
                    "claim.name": "sid",
                    "access.token.claim": "true",
                },
            }
        ]
        self.scope_mappers = {"profile-id": [], "roles-id": []}
        self.mappings = {sid: {"realmMappings": [], "clientMappings": {}} for sid in self.scopes}
        self.defaults = [
            {"id": "profile-id", "name": "profile"},
            {"id": "roles-id", "name": "roles"},
        ]
        self.optionals = []
        self.calls = []
        self.mutations = []
        self.opened = False
        self.closed = False
        self.fail_after = None
        self.fail_auth = False
        self.fail_cleanup = False
        self.bad_json_path = None
        self.hide_write_mapping = False

    def add_scope(self, name, *, roles=(), clients=None):
        sid = "read-id" if name == "platform.read" else "write-id"
        self.scopes[sid] = {
            "id": sid,
            "name": name,
            "description": "existing scope",
            "protocol": "openid-connect",
            "attributes": {
                "include.in.token.scope": "true",
                "display.on.consent.screen": "false",
            },
            "protocolMappers": [],
        }
        self.mappings[sid] = {
            "realmMappings": copy.deepcopy(list(roles)),
            "clientMappings": copy.deepcopy(clients or {}),
        }
        return sid

    def result(self, args, value=None, *, raw=None):
        return subprocess.CompletedProcess(args, 0, json.dumps(value) if raw is None else raw, "")

    def changed(self, args, event):
        self.mutations.append(event)
        if self.fail_after == len(self.mutations):
            self.fail_after = None
            raise subprocess.CalledProcessError(
                1, args, output="simulated-sensitive-output", stderr="simulated-sensitive-error"
            )

    def __call__(self, args, **kwargs):
        self.calls.append((list(args), kwargs.get("input")))
        assert list(args[: len(COMPOSE)]) == COMPOSE
        tail = list(args[len(COMPOSE) :])
        assert tail[:3] == ["exec", "-T", "keycloak"]
        tail = tail[3:]
        assert kwargs["capture_output"] and kwargs["text"] and kwargs["check"]
        if tail[:2] == ["sh", "-c"]:
            script = tail[2]
            if "mktemp -d /tmp/mp11-auth." in script:
                self.opened = True
                return self.result(args, raw=SESSION_DIRECTORY + "\n")
            if "config credentials" in script:
                assert "KC_CLI_PASSWORD" in script
                assert '"$KEYCLOAK_ADMIN_PASSWORD"' in script
                assert '"$KEYCLOAK_ADMIN"' in script
                assert "--password" not in script and "set -x" not in script
                assert "http://127.0.0.1:8080" in script
                assert tail[-1] == SESSION_DIRECTORY + "/kcadm.config"
                if self.fail_auth:
                    raise subprocess.CalledProcessError(1, args, stderr="simulated-sensitive-error")
                return self.result(args, raw="authenticated-private-output")
            if "rmdir" in script:
                assert tail[-1] == SESSION_DIRECTORY
                self.closed = True
                if self.fail_cleanup:
                    raise subprocess.CalledProcessError(1, args, stderr="simulated-sensitive-error")
                return self.result(args, raw="")
            raise AssertionError("Unexpected container shell command")
        assert tail[0] == KCADM
        verb, endpoint = tail[1:3]
        assert tail[tail.index("-r") + 1] == "metaplatform"
        assert tail[tail.index("--config") + 1] == SESSION_DIRECTORY + "/kcadm.config"
        if endpoint == self.bad_json_path:
            return self.result(args, raw="not-json simulated-sensitive-output")
        body = json.loads(kwargs["input"]) if kwargs.get("input") else None
        if verb == "get" and endpoint == "realms/metaplatform":
            if self.realm is None:
                raise subprocess.CalledProcessError(1, args)
            return self.result(args, self.realm)
        if verb == "get" and endpoint == "clients":
            assert "clientId=metaplatform-backend" in tail
            return self.result(
                args,
                []
                if self.client is None
                else [{"id": "backend-id", "clientId": "metaplatform-backend"}],
            )
        if verb == "get" and endpoint == "roles/PLATFORM_ADMIN":
            if self.role is None:
                raise subprocess.CalledProcessError(1, args)
            return self.result(args, self.role)
        if verb == "get" and endpoint == "client-scopes":
            return self.result(args, list(self.scopes.values()))
        if verb == "get" and endpoint == "clients/backend-id/default-client-scopes":
            return self.result(args, self.defaults)
        if verb == "get" and endpoint == "clients/backend-id/optional-client-scopes":
            return self.result(args, self.optionals)
        if endpoint == "clients/backend-id/protocol-mappers/models":
            if verb == "get":
                return self.result(args, self.client_mappers)
            if verb == "create":
                assert body == USERNAME_MAPPER
                self.client_mappers.append(dict(body, id="username-mapper"))
                self.changed(args, ("username-mapper", "preferred_username"))
                return self.result(args, raw="username-mapper\n")
        if verb == "create" and endpoint == "client-scopes":
            assert "-f" in tail and tail[tail.index("-f") + 1] == "-"
            assert body["name"] in ("platform.read", "platform.write")
            assert body["protocol"] == "openid-connect"
            assert body["attributes"]["include.in.token.scope"] == "true"
            assert not body.get("protocolMappers")
            sid = self.add_scope(body["name"])
            self.scopes[sid].update(body)
            self.changed(args, ("create", body["name"]))
            return self.result(args, raw=sid + "\n")
        if endpoint.startswith("client-scopes/"):
            parts = endpoint.split("/")
            sid = parts[1]
            assert sid in self.scopes
            if verb == "get" and parts[2:] == ["protocol-mappers", "models"]:
                return self.result(args, self.scope_mappers.get(sid, []))
            if verb == "get" and len(parts) == 2:
                return self.result(args, self.scopes[sid])
            if verb == "get" and parts[2:] == ["scope-mappings"]:
                mapping = copy.deepcopy(self.mappings[sid])
                if self.hide_write_mapping and sid == "write-id":
                    mapping["realmMappings"] = []
                return self.result(args, mapping)
            if verb == "create" and parts[2:] == ["scope-mappings", "realm"]:
                assert body == [{"id": "admin-role", "name": "PLATFORM_ADMIN"}]
                self.mappings[sid]["realmMappings"] = copy.deepcopy(body)
                self.changed(args, ("role-map", self.scopes[sid]["name"]))
                return self.result(args, raw="")
        if verb == "update" and endpoint.startswith("clients/backend-id/default-client-scopes/"):
            sid = endpoint.rsplit("/", 1)[1]
            assert body is None
            if sid == "write-id":
                assert self.mappings[sid] == {
                    "realmMappings": [{"id": "admin-role", "name": "PLATFORM_ADMIN"}],
                    "clientMappings": {},
                }, "An unrestricted write scope was linked"
            if not any(row["id"] == sid for row in self.defaults):
                self.defaults.append({"id": sid, "name": self.scopes[sid]["name"]})
            self.changed(args, ("default-link", self.scopes[sid]["name"]))
            return self.result(args, raw="")
        raise AssertionError(f"Unexpected CLI operation {verb} {endpoint}")


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.journal = Path(self.temporary.name) / "journal.jsonl"
        self.fixture = KcadmFixture()

    def migrate(self):
        return load("configure_auth").configure_auth(
            COMPOSE, cwd=Path(self.temporary.name), runner=self.fixture, journal=self.journal
        )

    def test_old_realm_gains_admin_restricted_scopes_without_overwriting_existing_state(self):
        original_client = copy.deepcopy(self.fixture.client)
        original_users = copy.deepcopy(self.fixture.users)
        original_session_mapper = copy.deepcopy(self.fixture.client_mappers[0])
        report = self.migrate()
        self.assertEqual(report["status"], "success")
        self.assertEqual(self.fixture.client, original_client)
        self.assertEqual(self.fixture.users, original_users)
        self.assertEqual(self.fixture.client_mappers[0], original_session_mapper)
        self.assertEqual(
            self.fixture.client_mappers[1], dict(USERNAME_MAPPER, id="username-mapper")
        )
        self.assertEqual(
            self.fixture.defaults,
            [
                {"id": "profile-id", "name": "profile"},
                {"id": "roles-id", "name": "roles"},
                {"id": "read-id", "name": "platform.read"},
                {"id": "write-id", "name": "platform.write"},
            ],
        )
        self.assertLess(
            self.fixture.mutations.index(("role-map", "platform.write")),
            self.fixture.mutations.index(("default-link", "platform.write")),
        )
        self.assertEqual(self.fixture.mappings["read-id"]["realmMappings"], [])
        self.assertTrue(self.fixture.closed)

    def test_rerun_keeps_resource_ids_and_performs_no_additional_mutations(self):
        self.migrate()
        before = copy.deepcopy((self.fixture.scopes, self.fixture.defaults, self.fixture.mutations))
        report = self.migrate()
        self.assertEqual(report["changes"], [])
        self.assertEqual(
            (self.fixture.scopes, self.fixture.defaults, self.fixture.mutations), before
        )

    def test_missing_existing_realm_client_or_role_fails_before_any_mutation(self):
        for missing in ("realm", "client", "role"):
            with self.subTest(missing=missing):
                self.fixture = KcadmFixture()
                setattr(self.fixture, missing, None)
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertEqual(self.fixture.mutations, [])
                self.assertTrue(self.fixture.closed)

    def test_conflicting_scopes_fail_before_changing_permissions_or_defaults(self):
        for conflict in (
            "write-role",
            "write-client",
            "write-protocol",
            "write-mapper",
            "read-role",
            "write-linked-empty",
            "write-optional-empty",
        ):
            with self.subTest(conflict=conflict):
                self.fixture = KcadmFixture()
                read = self.fixture.add_scope("platform.read")
                write = self.fixture.add_scope("platform.write", roles=[ADMIN])
                if conflict == "write-role":
                    self.fixture.mappings[write]["realmMappings"].append(
                        {"id": "user-role", "name": "user"}
                    )
                elif conflict == "write-client":
                    self.fixture.mappings[write]["clientMappings"] = {
                        "other-client": {
                            "id": "other",
                            "client": "other-client",
                            "mappings": [{"id": "other-role", "name": "user"}],
                        }
                    }
                elif conflict == "write-protocol":
                    self.fixture.scopes[write]["protocol"] = "saml"
                elif conflict == "write-mapper":
                    self.fixture.scopes[write]["protocolMappers"] = [
                        {"id": "unexpected-mapper", "name": "unexpected"}
                    ]
                elif conflict == "read-role":
                    self.fixture.mappings[read]["realmMappings"] = [ADMIN]
                else:
                    self.fixture.mappings[write]["realmMappings"] = []
                    links = (
                        self.fixture.optionals
                        if conflict == "write-optional-empty"
                        else self.fixture.defaults
                    )
                    links.append({"id": write, "name": "platform.write"})
                before = copy.deepcopy(
                    (self.fixture.scopes, self.fixture.mappings, self.fixture.defaults)
                )
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertEqual(self.fixture.mutations, [])
                self.assertEqual(
                    (self.fixture.scopes, self.fixture.mappings, self.fixture.defaults), before
                )

    def test_each_partial_mutation_can_be_recovered_without_duplicate_scopes_or_broad_write(self):
        for fail_after in range(1, 7):
            with self.subTest(fail_after=fail_after):
                self.fixture = KcadmFixture()
                self.fixture.fail_after = fail_after
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertTrue(self.fixture.closed)
                self.assertEqual(self.migrate()["status"], "success")
                self.assertEqual(
                    sorted(self.fixture.scopes), ["profile-id", "read-id", "roles-id", "write-id"]
                )
                self.assertEqual(len(self.fixture.defaults), 4)
                self.assertEqual(len(self.fixture.client_mappers), 2)

    def test_role_mapping_must_be_read_back_before_any_default_link(self):
        self.fixture.hide_write_mapping = True
        with self.assertRaises(load("configure_auth").AuthConfigurationError):
            self.migrate()
        self.assertFalse(any(action == "default-link" for action, _ in self.fixture.mutations))
        self.assertTrue(self.fixture.closed)

    def test_malformed_server_response_fails_closed_and_cleans_the_session(self):
        self.fixture.bad_json_path = "realms/metaplatform"
        with self.assertRaises(load("configure_auth").AuthConfigurationError):
            self.migrate()
        self.assertEqual(self.fixture.mutations, [])
        self.assertTrue(self.fixture.closed)

    def test_authentication_failure_does_not_leak_cli_output_and_still_cleans(self):
        self.fixture.fail_auth = True
        with self.assertRaises(load("configure_auth").AuthConfigurationError) as failure:
            self.migrate()
        self.assertTrue(self.fixture.closed)
        self.assertNotIn("simulated-sensitive", str(failure.exception))
        self.assertNotIn("simulated-sensitive", self.journal.read_text())

    def test_failure_journal_keeps_previous_metadata_and_never_cli_authentication_output(self):
        self.fixture.fail_after = 4
        with self.assertRaises(load("configure_auth").AuthConfigurationError):
            self.migrate()
        rows = [json.loads(row) for row in self.journal.read_text().splitlines()]
        self.assertEqual(rows[-1]["status"], "failed")
        self.assertEqual(rows[-1]["before"]["default_scope_ids"], ["profile-id", "roles-id"])
        self.assertTrue(rows[-1]["changes"])
        content = self.journal.read_text()
        for private in (
            "unchanged-client-secret",
            "authenticated-private-output",
            "simulated-sensitive",
        ):
            self.assertNotIn(private, content)

    def test_failed_session_cleanup_is_not_reported_as_a_successful_migration(self):
        self.fixture.fail_cleanup = True
        with self.assertRaises(load("configure_auth").AuthConfigurationError):
            self.migrate()
        self.assertEqual(json.loads(self.journal.read_text().splitlines()[-1])["status"], "failed")

    def test_ci_cli_uses_only_explicit_compose_configuration_and_prints_metadata(self):
        module = load("configure_auth")
        output = io.StringIO()
        with redirect_stdout(output):
            result = module.main(
                [
                    "--no-sudo",
                    "--compose-file",
                    "owned-compose.yml",
                    "--project",
                    "owned-ontology",
                    "--journal",
                    str(self.journal),
                ],
                runner=self.fixture,
            )
        self.assertEqual(result, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "success")
        self.assertNotIn("private/.env", repr(self.fixture.calls))
        self.assertNotIn("unchanged-client-secret", output.getvalue())

    def test_compatible_username_mapper_on_client_or_existing_profile_is_reused(self):
        for location in ("client", "profile"):
            with self.subTest(location=location):
                self.fixture = KcadmFixture()
                mapper = dict(USERNAME_MAPPER, id="existing-username")
                if location == "client":
                    self.fixture.client_mappers.append(mapper)
                else:
                    self.fixture.scope_mappers["profile-id"].append(mapper)
                before = copy.deepcopy(self.fixture.client_mappers)
                self.migrate()
                self.assertEqual(self.fixture.client_mappers, before)
                self.assertNotIn(("username-mapper", "preferred_username"), self.fixture.mutations)

    def test_restricted_profile_mapper_is_preserved_and_direct_username_added(self):
        for mapping in (
            {
                "realmMappings": [{"id": "profile-only", "name": "PROFILE_ONLY"}],
                "clientMappings": {},
            },
            {
                "realmMappings": [],
                "clientMappings": {"other-client": {"mappings": [{"id": "profile-only"}]}},
            },
        ):
            with self.subTest(mapping=mapping):
                self.fixture = KcadmFixture()
                self.fixture.scope_mappers["profile-id"].append(
                    dict(USERNAME_MAPPER, id="restricted-username")
                )
                self.fixture.mappings["profile-id"] = copy.deepcopy(mapping)
                before = copy.deepcopy(
                    (
                        self.fixture.scope_mappers,
                        self.fixture.mappings["profile-id"],
                        self.fixture.users,
                        self.fixture.client,
                    )
                )
                self.migrate()
                self.assertIn(("username-mapper", "preferred_username"), self.fixture.mutations)
                self.assertEqual(
                    (
                        self.fixture.scope_mappers,
                        self.fixture.mappings["profile-id"],
                        self.fixture.users,
                        self.fixture.client,
                    ),
                    before,
                )
                self.assertEqual(self.migrate()["changes"], [])

    def test_malformed_profile_scope_mapping_fails_before_any_mutation(self):
        for malformed in ("not-a-list", {}, "", False):
            with self.subTest(mapping=malformed):
                self.fixture = KcadmFixture()
                self.fixture.scope_mappers["profile-id"].append(
                    dict(USERNAME_MAPPER, id="restricted-username")
                )
                self.fixture.mappings["profile-id"] = {
                    "realmMappings": malformed,
                    "clientMappings": {},
                }
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertEqual(self.fixture.mutations, [])
                self.assertTrue(self.fixture.closed)

    def test_conflicting_username_claim_source_is_not_overwritten_or_duplicated(self):
        for location in ("client", "profile"):
            with self.subTest(location=location):
                self.fixture = KcadmFixture()
                mapper = copy.deepcopy(USERNAME_MAPPER)
                mapper["id"] = "conflicting-username"
                mapper["config"]["user.attribute"] = "email"
                if location == "client":
                    self.fixture.client_mappers.append(mapper)
                else:
                    self.fixture.scope_mappers["profile-id"].append(mapper)
                before = copy.deepcopy((self.fixture.client_mappers, self.fixture.scope_mappers))
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertEqual(self.fixture.mutations, [])
                self.assertEqual((self.fixture.client_mappers, self.fixture.scope_mappers), before)

    def test_unexpected_runner_error_is_sanitized_and_still_cleans_the_session(self):
        fixture = self.fixture

        def broken_runner(arguments, **kwargs):
            if "roles/PLATFORM_ADMIN" in arguments:
                raise RuntimeError("simulated-sensitive-error")
            return fixture(arguments, **kwargs)

        module = load("configure_auth")
        with self.assertRaises(module.AuthConfigurationError):
            module.configure_auth(COMPOSE, runner=broken_runner, journal=self.journal)
        self.assertTrue(self.fixture.closed)
        self.assertNotIn("simulated-sensitive", self.journal.read_text())

    def test_unrelated_roles_mapper_without_config_does_not_block_identity_upgrade(self):
        mapper = {
            "id": "audience-mapper",
            "name": "audience resolve",
            "protocol": "openid-connect",
            "protocolMapper": "oidc-audience-resolve-mapper",
            "config": None,
        }
        self.fixture.scope_mappers["roles-id"].append(mapper)
        try:
            report = self.migrate()
        except load("configure_auth").AuthConfigurationError:
            self.fail("Unrelated audience mapper must not block the existing roles scope")
        self.assertEqual(report["status"], "success")
        self.assertEqual(self.fixture.scope_mappers["roles-id"], [mapper])

    def test_wrong_mapping_container_types_fail_before_permission_changes(self):
        for field, value in (("realmMappings", False), ("clientMappings", [])):
            with self.subTest(field=field):
                self.fixture = KcadmFixture()
                sid = self.fixture.add_scope("platform.write")
                self.fixture.mappings[sid][field] = value
                with self.assertRaises(load("configure_auth").AuthConfigurationError):
                    self.migrate()
                self.assertEqual(self.fixture.mutations, [])


class BootstrapTests(unittest.TestCase):
    def test_auth_and_schema_upgrade_precede_database_seed_without_restarting_infrastructure(self):
        auth = load("configure_auth")
        bootstrap = load("bootstrap")
        events = []

        def upgrade(compose, **kwargs):
            events.append("auth")

        def run(arguments, **kwargs):
            self.assertIn("exec", arguments)
            service = arguments[arguments.index("exec") + 2]
            if service == "mate-app-hub":
                self.assertEqual(
                    arguments[-4:],
                    [
                        "python",
                        "/app/demo/run_service.py",
                        "python",
                        "/app/demo/configure_schema.py",
                    ],
                )
                events.append("schema")
            else:
                events.append(service)
            return subprocess.CompletedProcess(arguments, 0)

        with (
            patch.object(auth, "configure_auth", side_effect=upgrade),
            patch.object(bootstrap.subprocess, "run", side_effect=run),
        ):
            bootstrap.main()
        self.assertEqual(events, ["auth", "schema", "postgres", "mate-tech-ont"])

    def test_failed_auth_migration_prevents_schema_upgrade_and_database_changes(self):
        auth = load("configure_auth")
        bootstrap = load("bootstrap")
        with (
            patch.object(
                auth, "configure_auth", side_effect=auth.AuthConfigurationError("blocked")
            ),
            patch.object(bootstrap.subprocess, "run") as run,
        ):
            with self.assertRaises(auth.AuthConfigurationError):
                bootstrap.main()
        run.assert_not_called()


class VerifyAccessTests(unittest.TestCase):
    def claims(self):
        return {
            "scope": "openid profile roles platform.read platform.write",
            "preferred_username": "synthetic-admin",
            "sid": "synthetic-session",
            "azp": "metaplatform-backend",
        }

    def verify(self, claims):
        module = load("verify")
        self.assertTrue(
            hasattr(module, "verify_platform_access"), "Missing platform scope and read acceptance"
        )
        calls = []
        checks = []
        module.verify_platform_access(
            lambda method, path: calls.append((method, path)), claims, checks
        )
        return calls, checks

    def test_signed_admin_metadata_and_scopes_are_checked_before_read_only_provider_requests(self):
        calls, checks = self.verify(self.claims())
        self.assertEqual(calls, [("GET", "/api/v1/data/sources"), ("GET", "/api/v1/apphub/apps")])
        self.assertTrue(checks)
        self.assertNotIn("synthetic-admin", repr(checks))
        self.assertNotIn("synthetic-session", repr(checks))

    def test_missing_read_or_write_scope_fails_before_provider_requests(self):
        module = load("verify")
        self.assertTrue(
            hasattr(module, "verify_platform_access"), "Missing platform scope and read acceptance"
        )
        for scope in (
            "openid",
            "platform.read",
            "platform.write",
            ["platform.read", "platform.write"],
        ):
            with self.subTest(scope=scope):
                calls = []
                claims = dict(self.claims(), scope=scope)
                with self.assertRaises(RuntimeError):
                    module.verify_platform_access(
                        lambda *args, observed=calls: observed.append(args), claims, []
                    )
                self.assertEqual(calls, [])

    def test_missing_signed_username_session_or_client_identity_fails_without_dumping_claims(self):
        module = load("verify")
        self.assertTrue(
            hasattr(module, "verify_platform_access"), "Missing human metadata acceptance"
        )
        for missing in ("preferred_username", "sid", "azp"):
            with self.subTest(missing=missing):
                claims = self.claims()
                claims.pop(missing)
                calls = []
                with self.assertRaises(RuntimeError) as failure:
                    module.verify_platform_access(
                        lambda *args, observed=calls: observed.append(args), claims, []
                    )
                self.assertEqual(calls, [])
                self.assertNotIn("synthetic", str(failure.exception))


if __name__ == "__main__":
    unittest.main()
