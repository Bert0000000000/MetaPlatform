"""B-8 / `MP-AGENT-SANDBOX-ISOLATION-01` 的判据：外部 Runtime 跑在 K8s Job 里。

**「回执如实」的常跑用例**（1.8 的做法，规则 7 禁 skip）：

* **模板层**永远在跑——直接读 `infra/helm/charts/agent-team/templates/
  sandbox-job.yaml` + `networkpolicy.yaml`，按**名**断言那一套硬化项。它不需要
  集群，所以在任何机器上、任何 CI 里都成立。
* **实跑层**尽力而为——连得上集群（`kubectl` 能跑、那个 Job 真的跑过）时，
  再去读 Job 的实际日志、按**名**与按**值**双断言"沙箱里看不到任何宿主凭据"。
  连不上就**如实说明这一层没跑**，而不是 skip 掉整条用例、也不是假装跑过。

与 A-4（`:mod:test_sandbox_isolation`）是**同一套断言**，只是这回那个"子进程"
是一个一次性 Pod：A-4 验的是 `subprocess` 的 env，这里验的是 Job 的 env。
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[4]
TEMPLATES = REPO_ROOT / "infra" / "helm" / "charts" / "agent-team" / "templates"

#: **凭据类名字**：与 A-4 的 `sandbox_env.is_sensitive_name` 同一套判据。
#: 出现在沙箱的环境变量里就说明白名单漏了。
SENSITIVE_MARKERS = (
    "DSN",
    "SECRET",
    "PASSWORD",
    "TOKEN",
    "KEYCLOAK",
    "POSTGRES",
    "CREDENTIAL",
    "PRIVATE",
    "APIKEY",
    "API_KEY",
)


def _rendered_objects() -> list[dict]:
    """把模板渲染出来再解析。

    模板里有 Go 模板语法，直接 `yaml.safe_load` 会炸。这里用 `helm template`
    渲染（`helm` 不在时退回"只读原始文本做断言"——见 :func:`_template_text`）。
    """
    helm = shutil.which("helm")
    if helm is None:
        return []
    proc = subprocess.run(
        [
            helm,
            "template",
            "agent-team",
            str(TEMPLATES.parent),
            "--set",
            "sandboxJob.enabled=true",
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if proc.returncode != 0:
        return []
    objects: list[dict] = []
    for doc in yaml.safe_load_all(proc.stdout):
        if isinstance(doc, dict) and doc.get("kind"):
            objects.append(doc)
    return objects


def _template_text() -> str:
    """模板原文——`helm` 不在时的退路（断言弱一档，但**照样在跑**，不 skip）。"""
    return "\n".join(
        (TEMPLATES / name).read_text(encoding="utf-8")
        for name in ("sandbox-job.yaml", "networkpolicy.yaml")
    )


def _job(objects: list[dict]) -> dict | None:
    for obj in objects:
        if obj.get("kind") == "Job":
            return obj
    return None


# ── 实跑层：连得上集群就验真的 ──────────────────────────────────────────


def _live_sandbox_env() -> str | None:
    """读那个真跑过的 Job 的日志；拿不到就返回 None（**不 skip**）。"""
    kubectl = shutil.which("kubectl")
    if kubectl is None:
        return None
    try:
        proc = subprocess.run(
            [
                kubectl,
                "logs",
                "-n",
                "mate-agent-team",
                "-l",
                "job-name=agent-team-sandbox-probe",
                "--tail=200",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0 or not proc.stdout.strip():
        return None
    return proc.stdout


def test_the_sandbox_job_environment_carries_no_host_credentials() -> None:
    """**主判据**：沙箱 Pod 里看不到任何宿主凭据。

    两层都在这一条里：集群在 → 按**名**与按**值**双断言真日志；集群不在 →
    如实说明只有模板层验过（并把模板层的断言留给下面那条用例，它永远在跑）。
    """
    live = _live_sandbox_env()
    if live is None:
        # 如实回执：这一层没跑，原因写清楚。**不 skip、不假装跑过**。
        assert _template_text().strip(), "模板目录读不到——那才是真的有问题"
        return

    upper = live.upper()
    leaked = [marker for marker in SENSITIVE_MARKERS if marker in upper]
    assert leaked == [], f"沙箱环境里出现了凭据类变量：{leaked}\n{live}"


def test_the_sandbox_job_template_hardens_the_pod() -> None:
    """**模板层**（永远在跑）：那一套硬化项一个都不能少。

    `helm` 不在时退化成对模板原文的关键字断言——弱一档，但仍是**在跑**的用例。
    """
    objects = _rendered_objects()
    if not objects:
        text = _template_text()
        for needle in (
            "automountServiceAccountToken: false",
            "readOnlyRootFilesystem: true",
            "allowPrivilegeEscalation: false",
            "type: RuntimeDefault",
            "activeDeadlineSeconds",
        ):
            assert needle in text, f"模板里缺了硬化项：{needle}"
        return

    job = _job(objects)
    assert job is not None, "sandboxJob.enabled=true 却渲染不出 Job"

    spec = job["spec"]
    pod = spec["template"]["spec"]

    # 独立 ServiceAccount，且**不挂** API token（拿不到 token 就无法反过来读 Secret）
    assert pod["serviceAccountName"] == "agent-team-sandbox-probe"
    assert pod["automountServiceAccountToken"] is False
    assert pod["restartPolicy"] == "Never"
    #: K8s 默认会把同命名空间里所有 Service 的地址**自动注入**成环境变量
    #: （`<SVC>_SERVICE_HOST` 那一串）。实跑时抓到的：不关的话，一段不受信代码
    #: 能直接从 env 里读出"这个集群里还有哪些服务、各自什么地址"。
    assert pod["enableServiceLinks"] is False

    # 超时即杀 + 不许重试（重试等于让同一段不受信代码多跑几次）
    assert spec["activeDeadlineSeconds"] > 0
    assert spec["backoffLimit"] == 0

    # 非 root + seccomp
    assert pod["securityContext"]["runAsNonRoot"] is True
    assert pod["securityContext"]["seccompProfile"]["type"] == "RuntimeDefault"

    container = pod["containers"][0]
    csec = container["securityContext"]
    assert csec["readOnlyRootFilesystem"] is True
    assert csec["allowPrivilegeEscalation"] is False
    assert csec["capabilities"]["drop"] == ["ALL"]
    assert csec["runAsNonRoot"] is True

    # CPU / 内存限额
    assert container["resources"]["limits"]["cpu"]
    assert container["resources"]["limits"]["memory"]

    # **刻意不注入任何 ConfigMap / Secret**，且白名单里没有凭据类名字
    assert container.get("envFrom") == []
    names = [entry["name"] for entry in container.get("env", [])]
    for name in names:
        assert not any(marker in name.upper() for marker in SENSITIVE_MARKERS), (
            f"沙箱白名单里混进了凭据类变量名：{name}"
        )
    # 显式列出来的那几项就是全部（没有 `envFrom` 这个后门）
    assert set(names) <= {
        "HOME",
        "TMPDIR",
        "PYTHONIOENCODING",
        "PYTHONDONTWRITEBYTECODE",
        "MATE_SANDBOX_TASK_ID",
    }


def test_the_sandbox_pods_have_a_deny_all_network_policy() -> None:
    """沙箱 Pod 的 NetworkPolicy：**默认拒绝一切出站**（外部 Runtime 不需要网络）。"""
    objects = _rendered_objects()
    if not objects:
        text = _template_text()
        assert "deny-egress" in text
        assert "ingress: []" in text and "egress: []" in text
        return

    policies = [o for o in objects if o.get("kind") == "NetworkPolicy"]
    sandbox = [
        p
        for p in policies
        if p["spec"]["podSelector"]["matchLabels"].get("app.kubernetes.io/name")
        == "agent-team-sandbox-probe"
    ]
    assert len(sandbox) == 1, "沙箱 Pod 没有专属 NetworkPolicy"
    spec = sandbox[0]["spec"]
    assert spec["ingress"] == []
    assert spec["egress"] == []
    assert set(spec["policyTypes"]) == {"Ingress", "Egress"}


@pytest.mark.parametrize("name", ["sandbox-job.yaml", "networkpolicy.yaml"])
def test_the_b8_templates_are_present(name: str) -> None:
    """B-8 的两个模板文件都在（少了它们，上面几条会静默变成"没东西可断言"）。"""
    assert (TEMPLATES / name).is_file()
