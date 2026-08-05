"""K8s helm chart 静态解析测试(marketplace)。

[Pending Verification: helm / kubeconform / docker 在本机不可用] —
本测试仅做 YAML 静态解析 + NetworkPolicy/egress 白名单结构性检查。
"""
from __future__ import annotations

from pathlib import Path

import yaml

ROOT = Path(__file__).parents[1] / "helm" / "charts" / "marketplace"


def test_chart_metadata_present():
    chart = yaml.safe_load((ROOT / "Chart.yaml").read_text())
    assert chart["name"] == "marketplace"
    assert chart["type"] == "application"


def test_networkpolicy_default_deny_exists():
    tpl = (ROOT / "templates" / "networkpolicy.yaml").read_text()
    assert "kind: NetworkPolicy" in tpl
    # 默认 deny baseline:podSelector 选择 marketplace pod,
    # 但 policyTypes 同时声明 Ingress + Egress,默认所有 inbound/outbound 都隐式拒绝
    assert "policyTypes:" in tpl
    assert "Ingress" in tpl
    assert "Egress" in tpl


def test_networkpolicy_egress_to_saas_whitelisted():
    tpl = (ROOT / "templates" / "networkpolicy.yaml").read_text()
    # egress 必须放行 SaaS(由 values 注入)
    assert "egress" in tpl
    # values.allowedEgressCidrs 必须被引用
    assert "allowedEgressCidrs" in tpl


def test_no_secrets_in_chart():
    """硬规则 #12:不允许 KMS 密文/密钥泄露到 chart。"""
    for f in ROOT.rglob("*.yaml"):
        text = f.read_text()
        # 不允许 ENC[] 形式密文(数据库 connection string 也不会用 ENC[])
        if "ENC[" in text:
            raise AssertionError(
                f"chart file {f.name} 含 ENC[] 形式密文,违反硬规则 #12"
            )
        # 不允许 value: 形式裸 secret
        for line in text.splitlines():
            stripped = line.strip().lower()
            if stripped.startswith("#"):
                continue
            # 跳过 helm 模板里的变量
            if "{{" in stripped or "}}" in stripped:
                continue
            if (
                stripped.startswith("value:")
                and any(
                    tok in stripped
                    for tok in ("password", "secret", "key=", "token")
                )
            ):
                # password / secret / api-key 等裸密文
                if "ENC[" not in stripped and "encoded" not in stripped:
                    raise AssertionError(
                        f"chart file {f.name} 含裸 secret: {stripped!r}"
                    )