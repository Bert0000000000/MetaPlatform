"""Owned local candidate lifecycle. Secrets stay in ACL-protected ignored inputs."""

from __future__ import annotations

import json
import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[3]
PRIVATE = ROOT / ".tmp" / "codex-mp11-candidate"
MANIFEST = PRIVATE / "resources.json"
PORTS = {"keycloak": 55520, "redis": 55521, "api": 55522, "auth": 55523, "web": 9368}
PG_NAME = "codex-mp11-relationship-pg"
PG_ID = "d259c84a755a19ea18a1b089bb9cd83351dd6974dbd364555ab9740f3647bafa"
DB = "codex_mp11_candidate_20261012"
IAM_DB = "codex_mp11_candidate_iam_20261012"
PYTHON = ROOT / "mate-platform-backend/.venv/Scripts/python.exe"


def command(args):
    result = subprocess.run(
        args,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=ROOT,
        timeout=20,
    )
    if result.returncode:
        raise RuntimeError("command failed: " + Path(str(args[0])).name)
    return result.stdout.strip()


def save(path, data):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def state():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def free(port):
    with socket.socket() as s:
        s.bind(("127.0.0.1", port))


def pg_dsn(database):
    if not database.startswith("codex_mp11_"):
        raise RuntimeError("unowned database")
    data = json.loads(command(["docker", "inspect", PG_NAME]))[0]
    bindings = data["NetworkSettings"]["Ports"]["5432/tcp"]
    if (
        data["Id"] != PG_ID
        or bindings != [{"HostIp": "127.0.0.1", "HostPort": "55497"}]
        or not data["State"]["Running"]
    ):
        raise RuntimeError("dedicated PG identity mismatch")
    config = dict(entry.split("=", 1) for entry in data["Config"]["Env"])
    if config["POSTGRES_DB"] != "codex_mp11_relationship":
        raise RuntimeError("wrong bootstrap DB")
    return (
        "postgresql://"
        + quote(config["POSTGRES_USER"], safe="")
        + ":"
        + quote(config["POSTGRES_PASSWORD"], safe="")
        + "@127.0.0.1:55497/"
        + database
    )


def active_database():
    path = PRIVATE / "active-database.json"
    database = json.loads(path.read_text())["database"] if path.exists() else DB
    if database not in {
        DB,
        "codex_mp11_candidate_fresh_20261012",
        "codex_mp11_candidate_upgrade_20261012",
    }:
        raise RuntimeError("unsafe active candidate database")
    if database not in state()["databases"]:
        raise RuntimeError("active database lacks ownership manifest")
    return database


def environment():
    creds = json.loads((PRIVATE / "credentials.json").read_text())
    env = os.environ.copy()
    paths = [
        str(p / "src")
        for p in (ROOT / "mate-platform-backend/packages").iterdir()
        if (p / "src").exists()
    ]
    paths.append(str(ROOT / "mate-platform-backend/services/auth-service/src"))
    env.update(
        PYTHONPATH=os.pathsep.join(paths),
        PYTHONUTF8="1",
        PYTHONDONTWRITEBYTECODE="1",
        KEYCLOAK_URL="http://127.0.0.1:55520",
        KEYCLOAK_INTERNAL_URL="http://127.0.0.1:55520",
        KEYCLOAK_REALM="codex-mp11",
        KEYCLOAK_AUDIENCE="metaplatform-backend",
        KEYCLOAK_CLIENT_ID="mp11-web",
        KEYCLOAK_CLIENT_SECRET=creds["web_secret"],
        SERVICE_CLIENT_ID="mp11-service",
        SERVICE_CLIENT_SECRET=creds["service_secret"],
        TECH_ONT_CLIENT_ID="mp11-service",
        TECH_ONT_TOKEN=creds["service_secret"],
        TECH_ONT_SWITCH_SCOPE="",
        INSECURE_SKIP_SIGNATURE="false",
        LEGACY_LOGIN_COMPAT="false",
        REDIS_URL="redis://127.0.0.1:55521/0",
        MATE_DB_URL=pg_dsn(active_database()),
        ONT_SOURCE_DSN=pg_dsn(active_database()),
        ONT_APPROVAL_TTL_SECONDS="60",
        IAM_DATABASE_URL=pg_dsn(IAM_DB).replace("postgresql://", "postgresql+asyncpg://"),
        TECH_ONT_URL="http://127.0.0.1:55522",
        ONTOLOGY_URL="http://127.0.0.1:55522",
        APPHUB_URL="http://127.0.0.1:55522",
        MP11_CANDIDATE_DIR=str(PRIVATE),
        VITE_BACKEND_PORT="55522",
        NO_PROXY="127.0.0.1,localhost",
        no_proxy="127.0.0.1,localhost",
        NO_COLOR="1",
    )
    env.pop("FORCE_COLOR", None)
    for name in ("MATE_DB_URL", "IAM_DATABASE_URL"):
        parsed = urlparse(env[name])
        if (
            parsed.hostname != "127.0.0.1"
            or parsed.port != 55497
            or not parsed.path.startswith("/codex_mp11_")
        ):
            raise RuntimeError("unsafe effective DB")
    for name in ("TECH_ONT_URL", "ONTOLOGY_URL", "APPHUB_URL"):
        if env[name] != "http://127.0.0.1:55522":
            raise RuntimeError("unsafe effective service target")
    return env


def ensure_database(database):
    allowed = {
        f"codex_mp11_candidate_{kind}_20261012" for kind in ("source", "fresh", "upgrade", "tests")
    }
    if database not in allowed:
        raise RuntimeError("unapproved validation database")
    import psycopg2
    from psycopg2 import sql

    manifest = state()
    conn = psycopg2.connect(pg_dsn("codex_mp11_relationship"))
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (database,))
            exists = bool(cur.fetchone())
            if exists and database not in manifest["databases"]:
                raise RuntimeError("existing database has no ownership record")
            if not exists:
                if database not in manifest["databases"]:
                    manifest["databases"].append(database)
                save(MANIFEST, manifest)
                cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    finally:
        conn.close()
    return pg_dsn(database)


def setup():
    if MANIFEST.exists():
        raise RuntimeError("candidate exists; use start/status, never replace")
    for port in PORTS.values():
        free(port)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    # Restrict inherited Windows access before any credential file is written.
    account = os.environ["USERDOMAIN"] + "\\" + os.environ["USERNAME"]
    command(
        [
            "icacls",
            str(PRIVATE),
            "/inheritance:r",
            "/grant:r",
            account + ":(OI)(CI)F",
            "SYSTEM:(OI)(CI)F",
        ]
    )
    manifest = {
        "owner": "codex-mp11-candidate",
        "ports": PORTS,
        "databases": [DB, IAM_DB],
        "containers": {},
        "processes": {},
        "phase": "planned",
    }
    save(MANIFEST, manifest)
    creds = {
        key: secrets.token_urlsafe(36)
        for key in (
            "admin_password",
            "web_secret",
            "service_secret",
            "writer_password",
            "readonly_password",
            "neighbor_password",
        )
    }
    save(PRIVATE / "credentials.json", creds)
    scopes = []
    for name in ("platform.read", "ont.read", "platform.write", "ont.write"):
        scopes.append(
            {
                "name": name,
                "protocol": "openid-connect",
                "attributes": {"include.in.token.scope": "true"},
                "protocolMappers": [],
            }
        )
    mapper = lambda name, kind, config: {
        "name": name,
        "protocol": "openid-connect",
        "protocolMapper": kind,
        "config": config,
    }
    common = [
        mapper(
            "audience",
            "oidc-audience-mapper",
            {"included.custom.audience": "metaplatform-backend", "access.token.claim": "true"},
        ),
        mapper(
            "tenant",
            "oidc-usermodel-attribute-mapper",
            {
                "user.attribute": "tenant_id",
                "claim.name": "tenant_id",
                "jsonType.label": "String",
                "access.token.claim": "true",
                "id.token.claim": "true",
            },
        ),
        mapper(
            "username",
            "oidc-usermodel-property-mapper",
            {
                "user.attribute": "username",
                "claim.name": "preferred_username",
                "jsonType.label": "String",
                "access.token.claim": "true",
            },
        ),
        mapper("subject", "oidc-sub-mapper", {"access.token.claim": "true"}),
    ]
    clients = []
    for name, kind in [("mp11-web", "web"), ("mp11-service", "service")]:
        clients.append(
            {
                "clientId": name,
                "secret": creds[kind + "_secret"],
                "protocol": "openid-connect",
                "publicClient": False,
                "enabled": True,
                "directAccessGrantsEnabled": kind == "web",
                "serviceAccountsEnabled": kind == "service",
                "standardFlowEnabled": False,
                "fullScopeAllowed": False,
                "defaultClientScopes": ["profile", "email"] + [s["name"] for s in scopes],
                "protocolMappers": common,
            }
        )
    users = []
    for name, tenant, role in [
        ("writer", "mp11-candidate", "writer"),
        ("readonly", "mp11-candidate", "reader"),
        ("neighbor", "mp11-neighbor", "writer"),
    ]:
        users.append(
            {
                "username": name,
                "enabled": True,
                "emailVerified": True,
                "firstName": name,
                "lastName": "Candidate",
                "email": name + "@example.invalid",
                "attributes": {"tenant_id": [tenant]},
                "realmRoles": [role],
                "credentials": [
                    {"type": "password", "value": creds[name + "_password"], "temporary": False}
                ],
            }
        )
    users.append(
        {
            "username": "service-account-mp11-service",
            "enabled": True,
            "serviceAccountClientId": "mp11-service",
            "attributes": {"tenant_id": ["mp11-candidate"]},
            "realmRoles": ["writer"],
        }
    )
    realm = {
        "realm": "codex-mp11",
        "enabled": True,
        "sslRequired": "none",
        "registrationAllowed": False,
        "roles": {"realm": [{"name": "reader"}, {"name": "writer"}]},
        "users": users,
        "clients": clients,
        "clientScopes": scopes,
        "scopeMappings": [
            {"clientScope": name, "roles": ["writer"]} for name in ("platform.write", "ont.write")
        ],
    }
    save(PRIVATE / "codex-mp11-realm.json", realm)
    (PRIVATE / "keycloak.env").write_text(
        "KEYCLOAK_ADMIN=mp11-admin\nKEYCLOAK_ADMIN_PASSWORD=" + creds["admin_password"] + "\n",
        encoding="utf-8",
    )
    import psycopg2

    conn = psycopg2.connect(pg_dsn("codex_mp11_relationship"))
    conn.autocommit = True
    with conn.cursor() as cur:
        for database in (DB, IAM_DB):
            cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (database,))
            if cur.fetchone():
                raise RuntimeError("owned database already exists; refusing replacement")
            from psycopg2 import sql

            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    conn.close()
    for kind, image, port, args in [
        ("redis", "redis:7-alpine", 55521, ["redis-server", "--appendonly", "yes"]),
        (
            "keycloak",
            "quay.io/keycloak/keycloak:25.0",
            55520,
            ["start-dev", "--import-realm", "--hostname=http://127.0.0.1:55520"],
        ),
    ]:
        name = "codex-mp11-candidate-" + kind
        command(["docker", "image", "inspect", image])
        free(port)
        extra = (
            [
                "--env-file",
                str(PRIVATE / "keycloak.env"),
                "--mount",
                "type=bind,source="
                + str(PRIVATE / "codex-mp11-realm.json")
                + ",target=/opt/keycloak/data/import/codex-mp11-realm.json,readonly",
            ]
            if kind == "keycloak"
            else []
        )
        cid = command(
            [
                "docker",
                "create",
                "--pull",
                "never",
                "--name",
                name,
                "--label",
                "codex.owner=mp11-candidate",
                "-p",
                f"127.0.0.1:{port}:" + ("8080" if kind == "keycloak" else "6379"),
                *extra,
                image,
                *args,
            ]
        )
        manifest["containers"][kind] = {"id": cid, "name": name, "image": image, "port": port}
        save(MANIFEST, manifest)  # durable identity before starting
        command(["docker", "start", cid])
    manifest["phase"] = "dependencies-started"
    save(MANIFEST, manifest)
    print("Owned candidate dependencies started; private input path:", PRIVATE)


def start(role):
    if role not in ("api", "auth", "web"):
        raise RuntimeError("invalid role")
    manifest = state()
    free(PORTS[role])
    env = environment()
    import httpx
    import redis

    discovery = httpx.get(
        "http://127.0.0.1:55520/realms/codex-mp11/.well-known/openid-configuration",
        timeout=5,
        trust_env=False,
    )
    if discovery.status_code != 200:
        raise RuntimeError("owned issuer not ready")
    if not redis.Redis(
        host="127.0.0.1", port=55521, socket_connect_timeout=3, socket_timeout=3
    ).ping():
        raise RuntimeError("owned Redis not ready")
    if role == "web":
        executable = command(["where.exe", "node"]).splitlines()[0]
        arguments = [
            str(ROOT / "metaplatform-frontend/node_modules/vite/bin/vite.js"),
            "--config",
            str(ROOT / "scripts/acceptance/mp11/vite.config.ts"),
        ]
    else:
        executable = str(PYTHON)
        arguments = [str(ROOT / "scripts/acceptance/mp11/candidate.py"), role]

    # Arguments have no secrets; env is inherited, never serialized to logs.
    def psquote(value):
        return "'" + str(value).replace("'", "''") + "'"

    argline = " ".join('"' + arg + '"' for arg in arguments)
    script = (
        "$p=Start-Process -FilePath "
        + psquote(executable)
        + " -ArgumentList "
        + psquote(argline)
        + " -WorkingDirectory "
        + psquote(ROOT)
        + " -WindowStyle Hidden -RedirectStandardOutput "
        + psquote(PRIVATE / (role + ".out.log"))
        + " -RedirectStandardError "
        + psquote(PRIVATE / (role + ".err.log"))
        + " -PassThru; Get-CimInstance Win32_Process -Filter ('ProcessId='+$p.Id) | Select-Object ProcessId,ExecutablePath,CommandLine,@{Name='CreationTicks';Expression={$_.CreationDate.ToUniversalTime().Ticks}} | ConvertTo-Json -Compress"
    )
    identity_file = PRIVATE / (role + ".identity.json")
    script += " | Set-Content -Encoding utf8 " + psquote(identity_file)
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-Command", script],
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=20,
    )
    if result.returncode:
        raise RuntimeError("hidden launch failed")
    identity = json.loads(identity_file.read_text(encoding="utf-8-sig"))
    manifest["processes"][role] = identity
    manifest.get("listeners", {}).pop(role, None)
    save(MANIFEST, manifest)
    for attempt in range(30):
        try:
            record_listener(role)
            break
        except RuntimeError:
            if attempt == 29:
                raise
            time.sleep(1)
    print("Started owned", role, "PID", identity["ProcessId"], "port", PORTS[role])


def record_listener(role):
    """Bind a listener to its recorded launcher ancestry, never to a port alone."""
    manifest = state()
    launcher = manifest["processes"][role]
    script = (
        "$all=@(Get-CimInstance Win32_Process); $port="
        + str(PORTS[role])
        + "; $listener=(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess; if(!$listener){exit 1}; $chain=@(); $current=$listener; for($i=0;$i -lt 8;$i++){ $p=$all | Where-Object ProcessId -eq $current | Select-Object -First 1; if(!$p){break}; $chain += $p | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine,@{Name='CreationTicks';Expression={$_.CreationDate.ToUniversalTime().Ticks}}; $current=$p.ParentProcessId }; ConvertTo-Json -InputObject @($chain) -Compress"
    )
    chain = json.loads(command(["powershell.exe", "-NoProfile", "-Command", script]))
    found = next((p for p in chain if p["ProcessId"] == launcher["ProcessId"]), None)
    if not found or any(
        found[k] != launcher[k] for k in ("ExecutablePath", "CommandLine", "CreationTicks")
    ):
        raise RuntimeError("listener ancestry mismatch")
    owned = chain[: chain.index(found) + 1]
    for identity in owned:
        if str(ROOT / "scripts/acceptance/mp11").lower() not in identity["CommandLine"].lower():
            raise RuntimeError("unexpected child command")
    manifest.setdefault("listeners", {})[role] = owned
    save(MANIFEST, manifest)
    return owned


def inspect_dependency(role):
    if role not in ("redis", "keycloak"):
        raise RuntimeError("not an owned dependency")
    manifest = state()
    expected = manifest["containers"][role]
    actual = json.loads(command(["docker", "inspect", expected["id"]]))[0]
    inner = "6379/tcp" if role == "redis" else "8080/tcp"
    bindings = {inner: [{"HostIp": "127.0.0.1", "HostPort": str(PORTS[role])}]}
    if (
        actual["Id"] != expected["id"]
        or actual["Name"] != "/" + expected["name"]
        or actual["Config"]["Labels"].get("codex.owner") != "mp11-candidate"
        or actual["Config"]["Image"] != expected["image"]
        or actual["HostConfig"]["PortBindings"] != bindings
    ):
        raise RuntimeError("container identity/image/binding mismatch")
    image_id = json.loads(command(["docker", "image", "inspect", expected["image"]]))[0]["Id"]
    if actual["Image"] != expected.get("image_id", image_id):
        raise RuntimeError("container image digest mismatch")
    expected["image_id"] = actual["Image"]
    save(MANIFEST, manifest)
    return actual


def start_dependency(role):
    actual = inspect_dependency(role)
    if not actual["State"]["Running"]:
        free(PORTS[role])
        command(["docker", "start", actual["Id"]])
    print("Exact owned dependency available", role)


def validate_config(path):
    config = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    for role, port in PORTS.items():
        scheme = "redis" if role == "redis" else "http"
        suffix = "/0" if role == "redis" else ""
        if config.get(role) != f"{scheme}://127.0.0.1:{port}" + suffix:
            raise RuntimeError("configuration differs from approved loopback target: " + role)
    if config.get("database_name") != DB or config.get("iam_database_name") != IAM_DB:
        raise RuntimeError("configuration database ownership mismatch")
    if config.get("signature_verification") != "required":
        raise RuntimeError("signature verification required")
    print("Explicit owned target configuration validated")


def stop(role):
    """Stop only the exact recorded process or container; retain all data."""
    manifest = state()
    if role in manifest["processes"]:
        expected = manifest["processes"][role]
        identities = manifest.get("listeners", {}).get(role) or record_listener(role)
        # Validate the recorded executable, creation time, command line and PID
        # before Stop-Process. Do not infer ownership from a port/name alone.
        raw = json.dumps(identities).replace("'", "''")
        script = (
            "$records=ConvertFrom-Json '"
            + raw
            + "'; foreach($expected in $records){ $actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$expected.ProcessId); if(!$actual){continue}; if($actual.ProcessId -ne $expected.ProcessId -or $actual.ExecutablePath -ne $expected.ExecutablePath -or $actual.CommandLine -ne $expected.CommandLine -or $actual.CreationDate.ToUniversalTime().Ticks -ne [long]$expected.CreationTicks){throw 'process identity mismatch'} }; foreach($expected in $records){ $actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+$expected.ProcessId); if(!$actual){continue}; if($actual.ProcessId -ne $expected.ProcessId -or $actual.ExecutablePath -ne $expected.ExecutablePath -or $actual.CommandLine -ne $expected.CommandLine -or $actual.CreationDate.ToUniversalTime().Ticks -ne [long]$expected.CreationTicks){throw 'process identity mismatch'}; Stop-Process -Id $actual.ProcessId -ErrorAction Stop }"
        )
        command(["powershell.exe", "-NoProfile", "-Command", script])
        manifest["processes"].pop(role)
        manifest.get("listeners", {}).pop(role, None)
        save(MANIFEST, manifest)
    elif role in manifest["containers"]:
        actual = inspect_dependency(role)
        expected = manifest["containers"][role]
        command(["docker", "stop", expected["id"]])
    else:
        raise RuntimeError("no owned resource record")
    print("Stopped exact owned resource", role, "data retained")


if __name__ == "__main__":
    try:
        if sys.argv[1] == "setup":
            setup()
        elif sys.argv[1] == "start":
            start_dependency(sys.argv[2]) if sys.argv[2] in ("redis", "keycloak") else start(
                sys.argv[2]
            )
        elif sys.argv[1] == "validate-config":
            validate_config(sys.argv[2])
        elif sys.argv[1] == "stop":
            stop(sys.argv[2])
        elif sys.argv[1] == "status":
            print(json.dumps(state(), indent=2))
        else:
            raise RuntimeError("unsupported lifecycle operation")
    except Exception as exc:
        print(
            "Candidate operation failed:",
            type(exc).__name__,
            str(exc)
            if isinstance(exc, RuntimeError)
            else "see safe diagnostic; credentials suppressed",
        )
        sys.exit(1)
