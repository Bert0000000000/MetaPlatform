import pytest

from mate_clients.fakes.policy import assert_fake_allowed


def test_fake_allowed_in_test_profile() -> None:
    assert_fake_allowed(profile="test")  # does not raise


def test_fake_rejected_in_production_profile() -> None:
    with pytest.raises(RuntimeError):
        assert_fake_allowed(profile="production")
