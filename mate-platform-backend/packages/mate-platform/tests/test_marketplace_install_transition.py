"""MP-MKT-INSTALL-01：transition_install 事务化 + 审计单测（sqlite 内存库）。"""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from mate_platform.marketplace.domain.install import Install, InstallAudit
from mate_platform.marketplace.service.install_service import (
    InstallNotFound,
    InvalidTransition,
    create_install,
    transition_install,
)


@pytest.fixture()
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    from mate_tech_db.base import Base

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    s = factory()
    yield s
    s.close()


def _seed(session, state: str = "installed") -> uuid.UUID:
    iid, already = create_install(
        session=session, kind="mcp", artifact_id=uuid.uuid4(),
        version="1.0.0", installed_by=uuid.uuid4(), tenant_id=None,
    )
    if already:
        raise AssertionError("seed collision")
    row = session.get(Install, iid)
    row.state = state
    session.commit()
    return iid


def test_uninstall_from_installed_writes_audit(session):
    iid = _seed(session, "installed")
    row = transition_install(session=session, install_id=iid, action="uninstall",
                             actor=uuid.uuid4())
    assert row.state == "uninstalling"
    audits = session.query(InstallAudit).filter_by(install_id=iid).all()
    assert len(audits) == 1
    assert (audits[0].action, audits[0].from_state, audits[0].to_state) == \
        ("uninstall", "installed", "uninstalling")
    assert audits[0].actor != ""


def test_retry_from_failed_increments_count(session):
    iid = _seed(session, "failed")
    row = transition_install(session=session, install_id=iid, action="retry")
    assert row.state == "downloading"
    assert row.retry_count == 1
    assert session.query(InstallAudit).filter_by(install_id=iid).count() == 1


def test_invalid_transition_rejected(session):
    iid = _seed(session, "downloading")
    with pytest.raises(InvalidTransition):
        transition_install(session=session, install_id=iid, action="retry")
    assert session.get(Install, iid).state == "downloading"
    assert session.query(InstallAudit).filter_by(install_id=iid).count() == 0


def test_missing_install_raises_not_found(session):
    with pytest.raises(InstallNotFound):
        transition_install(session=session, install_id=uuid.uuid4(),
                           action="uninstall")
