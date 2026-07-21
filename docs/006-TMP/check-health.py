import socket
import urllib.request
import urllib.error
import json

SERVICES = [
    ("TECH-IAM", 8101),
    ("TECH-ONT", 8201),
    ("TECH-RULE", 8501),
    ("TECH-MSG", 8601),
    ("TECH-EA", 8106),
    ("TECH-OBS", 8301),
    ("TECH-LLMGW", 8401),
    ("TECH-DATA", 8701),
    ("TECH-WFE", 8801),
    ("TECH-ACTION", 8104),
    ("TECH-RAG", 8901),
    ("TECH-AGENT", 8511),
    ("TECH-A2A", 8502),
    ("TECH-MCP", 8105),
    ("TECH-GW", 8000),
]

FRONTENDS = [
    ("APP-DASHBOARD", 9202),
    ("APP-ONTSTUDIO", 9101),
    ("APP-APPHUB", 9201),
    ("APP-SUPERAI", 9301),
    ("APP-DW", 9401),
    ("APP-ARCH", 9206),
    ("APP-MCPHUB", 9501),
]


def check_port(name, port):
    try:
        with socket.create_connection(("localhost", port), timeout=2):
            return "UP"
    except Exception as e:
        return f"DOWN ({e})"


def check_gateway():
    try:
        req = urllib.request.Request(
            "http://localhost:8000/api/v1/iam/auth/login",
            data=json.dumps({"username": "admin", "password": "Meta@12345", "tenantId": "default"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("code") == 0
    except Exception as e:
        return False


def main():
    print("Backend services:")
    for name, port in SERVICES:
        status = check_port(name, port)
        print(f"  {name:15} port {port}: {status}")

    print("\nFrontend services:")
    for name, port in FRONTENDS:
        status = check_port(name, port)
        print(f"  {name:15} port {port}: {status}")

    print("\nGateway login route:", "OK" if check_gateway() else "FAIL")


if __name__ == "__main__":
    main()
