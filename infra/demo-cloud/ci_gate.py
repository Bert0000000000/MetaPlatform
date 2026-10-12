"""Wait for successful CI on the exact, current main commit; never trust PR runs."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request

REQUIRED = {
    "CI",
    "Python Backend CI",
    "ga-acceptance",
    "ontology-loop",
    "OpenAPI Contract CI",
    "Tencent Demo CI",
}


def evaluate(runs: list[dict], revision: str, repository: str) -> tuple[str, list[str]]:
    latest = {}
    for run in runs:
        if (
            run.get("head_sha") != revision
            or run.get("head_branch") != "main"
            or run.get("event") != "push"
            or run.get("head_repository", {}).get("full_name") != repository
        ):
            continue
        if run["name"] == "Tencent Demo Deploy":
            continue
        old = latest.get(run["name"])
        order = (run["id"], run.get("run_attempt", 1))
        if old is None or order > (old["id"], old.get("run_attempt", 1)):
            latest[run["name"]] = run
    failed = [
        name
        for name, run in latest.items()
        if run["status"] == "completed" and run["conclusion"] != "success"
    ]
    if failed:
        return "failed", sorted(failed)
    waiting = REQUIRED - latest.keys()
    waiting |= {name for name, run in latest.items() if run["status"] != "completed"}
    return ("waiting", sorted(waiting)) if waiting else ("ready", sorted(latest))


def github(repository: str, endpoint: str):
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/{endpoint}",
        headers={
            "Authorization": "Bearer " + os.environ["GH_TOKEN"],
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def current_main(repository: str) -> str:
    return github(repository, "git/ref/heads/main")["object"]["sha"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--timeout", type=int, default=3600)
    args = parser.parse_args()
    repository = os.environ["GITHUB_REPOSITORY"]
    if not re.fullmatch(r"[0-9a-f]{40}", args.revision):
        parser.error("A full commit SHA is required")
    deadline = time.monotonic() + args.timeout
    last = None
    while time.monotonic() < deadline:
        if current_main(repository) != args.revision:
            print("main advanced; the superseded release will not deploy.")
            if output := os.environ.get("GITHUB_OUTPUT"):
                with open(output, "a", encoding="utf-8") as stream:
                    stream.write("deploy=false\n")
            return
        runs = []
        page = 1
        while True:
            data = github(
                repository, f"actions/runs?head_sha={args.revision}&per_page=100&page={page}"
            )
            runs.extend(data["workflow_runs"])
            if len(data["workflow_runs"]) < 100:
                break
            page += 1
        status, names = evaluate(runs, args.revision, repository)
        if (status, names) != last:
            print(status + ": " + ", ".join(names), flush=True)
            last = status, names
        if status == "failed":
            raise SystemExit("CI did not pass; deployment blocked.")
        if status == "ready":
            if output := os.environ.get("GITHUB_OUTPUT"):
                with open(output, "a", encoding="utf-8") as stream:
                    stream.write("deploy=true\n")
            return
        time.sleep(30)
    raise SystemExit("CI results missing or still pending; deployment blocked.")


if __name__ == "__main__":
    main()
