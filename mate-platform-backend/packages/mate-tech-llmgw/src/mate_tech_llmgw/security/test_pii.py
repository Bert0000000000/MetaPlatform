"""PII mask tests (ST-5.5.11.2)."""
from __future__ import annotations

from mate_tech_llmgw.security.pii_mask import mask_pii, has_pii


def test_mask_phone() -> None:
    """手机号打码."""
    text = "我的手机是13800138000，请联系我"
    masked = mask_pii(text)
    assert "13800138000" not in masked
    assert "***" in masked


def test_mask_id_card() -> None:
    """身份证打码."""
    text = "身份证号：110101199003078888"
    masked = mask_pii(text)
    assert "110101199003078888" not in masked
    assert "***" in masked


def test_mask_email() -> None:
    """邮箱打码."""
    text = "请发邮件到user@example.com确认"
    masked = mask_pii(text)
    assert "user@example.com" not in masked
    assert "***" in masked


def test_mask_multiple_types() -> None:
    """多种 PII 同时打码."""
    text = "手机13800138000 邮箱 a@b.com 身份证 110101199003078888"
    masked = mask_pii(text)
    assert "13800138000" not in masked
    assert "a@b.com" not in masked
    assert "110101199003078888" not in masked


def test_no_pii_passthrough() -> None:
    """无 PII 文本原样返回."""
    text = "Hello world, no sensitive data here."
    masked = mask_pii(text)
    assert masked == text


def test_has_pii_true() -> None:
    assert has_pii("13800138000") is True
    assert has_pii("user@example.com") is True
    assert has_pii("110101199003078888") is True


def test_has_pii_false() -> None:
    assert has_pii("hello world") is False
    assert has_pii("普通文本，无敏感信息") is False