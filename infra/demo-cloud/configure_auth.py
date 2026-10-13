"""Add MP11 scopes to the existing realm using its container's administrator."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
REALM = "metaplatform"
CLIENT = "metaplatform-backend"
ROLE = "PLATFORM_ADMIN"
READ = "platform.read"
WRITE = "platform.write"
KCADM = "/opt/keycloak/bin/kcadm.sh"
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


class AuthConfigurationError(RuntimeError):
    def __init__(self, message, report=None):
        super().__init__(message)
        self.report = report


def require(condition, message):
    if not condition:
        raise AuthConfigurationError(message)


def resource_id(value):
    require(
        isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9._-]{1,128}", value),
        "Invalid resource ID",
    )
    return value


class Kcadm:
    """Own a single private CLI session; never export credentials to the host."""

    def __init__(self, compose, cwd, runner):
        self.compose = list(compose)
        self.cwd = cwd
        self.runner = runner
        self.directory = None

    def run(self, *arguments, body=None):
        try:
            result = self.runner(
                [*self.compose, "exec", "-T", "keycloak", *arguments],
                input=None if body is None else json.dumps(body),
                cwd=self.cwd,
                text=True,
                capture_output=True,
                check=True,
                timeout=60,
            )
        except (OSError, subprocess.SubprocessError):
            raise AuthConfigurationError("Keycloak CLI command failed") from None
        require(result.returncode == 0, "Keycloak CLI command failed")
        return result.stdout.strip()

    def open(self):
        directory = self.run(
            "sh", "-c", "set +x; set -eu; umask 077; mktemp -d /tmp/mp11-auth.XXXXXXXX"
        )
        parts = PurePosixPath(directory).parts
        require(
            len(parts) == 3
            and parts[:2] == ("/", "tmp")
            and re.fullmatch(r"mp11-auth\.[A-Za-z0-9]{8,64}", parts[2]),
            "Invalid CLI session directory",
        )
        self.directory = directory
        self.run(
            "sh",
            "-c",
            'set +x; set -eu; umask 077; : "${KEYCLOAK_ADMIN:?}" "${KEYCLOAK_ADMIN_PASSWORD:?}"; '
            'export KC_CLI_PASSWORD="$KEYCLOAK_ADMIN_PASSWORD"; '
            "exec /opt/keycloak/bin/kcadm.sh config credentials --server http://127.0.0.1:8080 "
            '--realm master --user "$KEYCLOAK_ADMIN" --config "$1"',
            "--",
            directory + "/kcadm.config",
        )

    def close(self):
        if self.directory:
            self.run(
                "sh",
                "-c",
                'set +x; set -eu; rm -f -- "$1/kcadm.config"; rmdir -- "$1"',
                "--",
                self.directory,
            )
            self.directory = None

    def request(self, verb, endpoint, *, body=None, query=None, fields=None, created_id=False):
        arguments = [
            KCADM,
            verb,
            endpoint,
            "-r",
            REALM,
            "--config",
            self.directory + "/kcadm.config",
        ]
        if query:
            arguments += ["-q", query]
        if fields:
            arguments += ["--fields", fields]
        if body is not None:
            arguments += ["-f", "-"]
        if created_id:
            arguments.append("-i")
        raw = self.run(*arguments, body=body)
        if created_id:
            return resource_id(raw)
        if verb != "get":
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            raise AuthConfigurationError("Invalid Keycloak JSON response") from None


def rows(value):
    require(
        isinstance(value, list) and all(isinstance(row, dict) for row in value),
        "Invalid resource list",
    )
    return value


def scope_mapping(api, sid):
    value = api.request("get", f"client-scopes/{sid}/scope-mappings")
    require(
        isinstance(value, dict) and set(value) <= {"realmMappings", "clientMappings"},
        "Invalid scope mappings",
    )
    realm_value = value.get("realmMappings")
    realm = rows([] if realm_value is None else realm_value)
    client_value = value.get("clientMappings")
    clients = {} if client_value is None else client_value
    require(isinstance(clients, dict) and not clients, "Unexpected client role scope mapping")
    mapped = [(resource_id(role.get("id")), role.get("name")) for role in realm]
    require(all(isinstance(name, str) for _, name in mapped), "Invalid role scope mapping")
    return mapped


def compatible_username_mapper(mapper):
    if (
        mapper.get("protocol") != "openid-connect"
        or mapper.get("protocolMapper") != "oidc-usermodel-property-mapper"
    ):
        return False
    config = mapper.get("config")
    return isinstance(config, dict) and all(
        config.get(key) == value for key, value in USERNAME_MAPPER["config"].items()
    )


def username_mappers(api, cid, defaults):
    direct = rows(api.request("get", f"clients/{cid}/protocol-mappers/models"))
    candidates = [(mapper, True) for mapper in direct]
    for scope in defaults:
        sid = resource_id(scope.get("id"))
        mappers = rows(api.request("get", f"client-scopes/{sid}/protocol-mappers/models"))
        unrestricted = True
        if any(
            mapper.get("config", {}).get("claim.name") == "preferred_username"
            for mapper in mappers
            if isinstance(mapper.get("config"), dict)
        ):
            mapping = api.request("get", f"client-scopes/{sid}/scope-mappings")
            require(
                isinstance(mapping, dict) and set(mapping) <= {"realmMappings", "clientMappings"},
                "Invalid username scope mappings",
            )
            realm_value = mapping.get("realmMappings")
            realm_mapping = rows([] if realm_value is None else realm_value)
            client_mapping = mapping.get("clientMappings")
            client_mapping = {} if client_mapping is None else client_mapping
            require(isinstance(client_mapping, dict), "Invalid username client mappings")
            unrestricted = not realm_mapping and not client_mapping
        candidates += [(mapper, unrestricted) for mapper in mappers]
    matching = []
    for mapper, unrestricted in candidates:
        config = mapper.get("config")
        if config is None:
            continue
        require(isinstance(config, dict), "Invalid protocol mapper configuration")
        if config.get("claim.name") == "preferred_username":
            require(compatible_username_mapper(mapper), "Conflicting username claim mapper")
            if unrestricted:
                matching.append(mapper)
    if not matching:
        require(
            not any(mapper.get("name") == USERNAME_MAPPER["name"] for mapper in direct),
            "Username mapper name is occupied",
        )
    return matching


def validate_scope(api, scope):
    sid = resource_id(scope.get("id"))
    representation = api.request("get", f"client-scopes/{sid}")
    require(isinstance(representation, dict), "Invalid client scope representation")
    require(
        representation.get("id") == sid and representation.get("name") == scope["name"],
        "Client scope identity changed",
    )
    require(representation.get("protocol") == "openid-connect", "Conflicting client scope protocol")
    attributes = representation.get("attributes")
    require(
        isinstance(attributes, dict) and attributes.get("include.in.token.scope") == "true",
        "Client scope is absent from token scope",
    )
    require(not representation.get("protocolMappers"), "Unexpected platform scope protocol mapper")
    return scope_mapping(api, sid)


def migrate(api, report, record):
    report["stage"] = "prerequisites"
    realm = api.request("get", f"realms/{REALM}", fields="realm")
    require(isinstance(realm, dict) and realm.get("realm") == REALM, "Existing realm is required")
    clients = rows(api.request("get", "clients", query=f"clientId={CLIENT}", fields="id,clientId"))
    require(
        len(clients) == 1 and clients[0].get("clientId") == CLIENT,
        "Existing backend client is required",
    )
    cid = resource_id(clients[0].get("id"))
    role = api.request("get", f"roles/{ROLE}", fields="id,name")
    require(
        isinstance(role, dict) and role.get("name") == ROLE,
        "Existing administrator role is required",
    )
    rid = resource_id(role.get("id"))
    defaults = rows(api.request("get", f"clients/{cid}/default-client-scopes"))
    default_ids = [resource_id(scope.get("id")) for scope in defaults]
    optionals = rows(api.request("get", f"clients/{cid}/optional-client-scopes"))
    optional_ids = [resource_id(scope.get("id")) for scope in optionals]
    report["before"] = {
        "client_id": cid,
        "default_scope_ids": default_ids,
        "optional_scope_ids": optional_ids,
        "scope_ids": {},
        "write_role_ids": [],
    }
    all_scopes = rows(api.request("get", "client-scopes", fields="id,name"))
    scopes = {}
    for name in (READ, WRITE):
        matches = [scope for scope in all_scopes if scope.get("name") == name]
        require(len(matches) <= 1, "Ambiguous platform client scope")
        scopes[name] = matches[0] if matches else None
        report["before"]["scope_ids"][name] = resource_id(matches[0].get("id")) if matches else None
    report["stage"] = "preflight"
    matching_username = username_mappers(api, cid, defaults)
    for name, scope in scopes.items():
        if scope:
            mapped = validate_scope(api, scope)
            if name == READ:
                require(not mapped, "Read scope has a role restriction")
            else:
                report["before"]["write_role_ids"] = [mapped_id for mapped_id, _ in mapped]
                require(mapped in ([], [(rid, ROLE)]), "Conflicting write scope role mapping")
                require(
                    mapped or scope["id"] not in default_ids + optional_ids,
                    "Existing linked write scope is unrestricted",
                )
    record()

    def change(action, name, endpoint, *, verb, body=None, created_id=False, sid=None):
        report["stage"] = action
        event = {"action": action, "name": name, "resource_id": sid, "outcome": "attempted"}
        report["changes"].append(event)
        record()
        result = api.request(verb, endpoint, body=body, created_id=created_id)
        event.update(outcome="applied", resource_id=result if created_id else sid)
        record()
        return result

    for name in (READ, WRITE):
        if scopes[name] is None:
            sid = change(
                "create_scope",
                name,
                "client-scopes",
                verb="create",
                created_id=True,
                body={
                    "name": name,
                    "protocol": "openid-connect",
                    "attributes": {
                        "include.in.token.scope": "true",
                        "display.on.consent.screen": "false",
                    },
                },
            )
            scopes[name] = {"id": sid, "name": name}
    write_id = scopes[WRITE]["id"]
    if not scope_mapping(api, write_id):
        change(
            "restrict_write",
            WRITE,
            f"client-scopes/{write_id}/scope-mappings/realm",
            verb="create",
            body=[{"id": rid, "name": ROLE}],
            sid=write_id,
        )
    report["stage"] = "verify_write_restriction"
    require(
        validate_scope(api, scopes[WRITE]) == [(rid, ROLE)],
        "Administrator write restriction was not retained",
    )
    require(not validate_scope(api, scopes[READ]), "Read scope has a role restriction")
    if not matching_username:
        change(
            "create_username_mapper",
            "preferred_username",
            f"clients/{cid}/protocol-mappers/models",
            verb="create",
            body=USERNAME_MAPPER,
            created_id=True,
        )
    report["stage"] = "verify_username"
    require(username_mappers(api, cid, defaults), "Username mapper was not retained")
    for name in (READ, WRITE):
        sid = scopes[name]["id"]
        if sid not in default_ids:
            # Always recheck the restriction immediately before linking write.
            if name == WRITE:
                require(
                    scope_mapping(api, sid) == [(rid, ROLE)],
                    "Administrator write restriction changed",
                )
            change(
                "link_default",
                name,
                f"clients/{cid}/default-client-scopes/{sid}",
                verb="update",
                sid=sid,
            )
    report["stage"] = "verify_defaults"
    actual = rows(api.request("get", f"clients/{cid}/default-client-scopes"))
    actual_ids = {resource_id(scope.get("id")) for scope in actual}
    require(
        set(default_ids) | {scopes[READ]["id"], write_id} <= actual_ids,
        "Default client scopes were not preserved",
    )
    require(username_mappers(api, cid, actual), "Effective username mapper is missing")
    require(scope_mapping(api, write_id) == [(rid, ROLE)], "Final write restriction changed")


def configure_auth(compose, *, cwd=ROOT, runner=subprocess.run, journal=None):
    journal = (
        Path(journal) if journal is not None else HERE / "artifacts/auth-scope-migration.jsonl"
    )
    report = {
        "migration": "mp11-platform-scopes-v1",
        "realm": REALM,
        "client": CLIENT,
        "status": "running",
        "stage": "session",
        "before": {},
        "changes": [],
    }

    def record():
        journal.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(journal, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(descriptor, "a", encoding="utf-8") as stream:
            stream.write(
                json.dumps(dict(report, recorded_at=datetime.now(UTC).isoformat()), sort_keys=True)
                + "\n"
            )

    api = Kcadm(compose, cwd, runner)
    failure = None
    try:
        record()
        api.open()
        migrate(api, report, record)
    except Exception as error:
        failure = error
    finally:
        try:
            api.close()
        except Exception as error:
            report["stage"] = "cleanup"
            failure = error
        report["status"] = "failed" if failure else "success"
        if failure:
            report["error_type"] = type(failure).__name__
        try:
            record()
        except OSError as error:
            report.update(status="failed", stage="journal", error_type=type(error).__name__)
            failure = error
    if failure:
        raise AuthConfigurationError("Existing realm scope migration failed", report) from None
    return report


def main(argv=None, *, runner=subprocess.run):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--compose-file",
        action="append",
        help="Repeat for the existing stack's explicit Compose files",
    )
    parser.add_argument(
        "--project", help="Existing Compose project; otherwise use Compose's configured project"
    )
    parser.add_argument("--env-file", help="Optional existing Compose environment file")
    parser.add_argument(
        "--no-sudo", action="store_true", help="CI runner already has Docker permission"
    )
    parser.add_argument(
        "--journal", type=Path, default=HERE / "artifacts/auth-scope-migration.jsonl"
    )
    args = parser.parse_args(argv)
    compose = ([] if args.no_sudo else ["sudo", "-n"]) + ["docker", "compose"]
    for filename in args.compose_file or ["docker-compose.yml", "infra/demo-cloud/compose.yml"]:
        compose += ["-f", filename]
    if args.project:
        compose += ["-p", args.project]
    env_file = args.env_file or (None if args.compose_file else "infra/demo-cloud/private/.env")
    if env_file:
        compose += ["--env-file", env_file]
    try:
        report = configure_auth(compose, runner=runner, journal=args.journal)
    except AuthConfigurationError as error:
        print(json.dumps(error.report, sort_keys=True))
        return 1
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
