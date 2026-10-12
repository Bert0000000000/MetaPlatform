"""Audit IDs must be unique across services sharing one process/database."""
from mate_kernel.action.engine import ActionService,SubmissionContext


def test_independent_action_services_never_reuse_audit_identity():
    outcomes=[]
    for _ in range(2):
        service=ActionService();service.register_function('fn',lambda *_: {'status':'approved'})
        outcomes.append(service.apply('action',(), 'fn','object','individual',{},(),SubmissionContext(actor='human')))
    assert outcomes[0].audit_id != outcomes[1].audit_id
    assert all(outcome.function_result=={'status':'approved'} for outcome in outcomes)
