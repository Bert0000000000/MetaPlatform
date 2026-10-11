from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import Draft, compile_graph, digest
from mate_tech_ont.modeling import data_treatment as treatment
from .test_modeling_generation_quality import fixture, related_fixture


def source_fixture():
    draft, rows = related_fixture()
    for c in draft['classes']:
        c.update(accepted=True, identityStatus='confirmed', identityReason='单据与明细构成完整身份')
    for m in draft['mappings']:
        m['accepted'] = True
    for r in draft['relationships']:
        r['joins'].append({'sourceProperty':'document_id','targetProperty':'document_id'})
        r.update(accepted=True,cardinalityStatus='confirmed')
    return {'id':'example','revision':1,'draft':draft,'plan':{'configHash':'native'}}, rows


def test_partial_isolates_whole_conflict_group_and_missing_identity_and_dependent_edges():
    source, rows = source_fixture()
    rows += [deepcopy(rows[0]), deepcopy(rows[0])]
    rows[-2]['row'] = 4; rows[-2]['values']['金额'] = 999
    rows[-1]['row'] = 5; rows[-1]['values']['明细号'] = None
    original = deepcopy((source,rows))
    with pytest.raises(ValueError):
        compile_graph(source['draft'],rows)
    report, nodes, edges, deferred = treatment.prepare(source,rows,partial=True)
    assert report['canSync'] and len(nodes) == 2 and not edges
    assert report['quarantine']['rows'] == 3
    assert any(d['kind']=='entity' and d['conflicts']==['amount'] for d in deferred)
    assert any(d['kind']=='relationship' for d in deferred)
    assert (source,rows) == original


def test_type_error_quarantines_other_rows_with_same_identity():
    source, rows = source_fixture()
    bad = deepcopy(rows[0]);bad['row']=4;bad['values']['金额']='not-a-number';rows.append(bad)
    report,nodes,edges,_=treatment.prepare(source,rows,partial=True)
    assert len(nodes)==2 and not edges and report['quarantine']['rows']==2


def test_unreviewed_mapping_is_never_bypassed_and_all_deferred_cannot_sync():
    source, rows = source_fixture()
    source['draft']['mappings'][0]['accepted']=False
    report,*_=treatment.prepare(source,rows,partial=True)
    assert not report['canSync'] and report['errors']
    source, rows = source_fixture()
    for row in rows:row['values']['明细号']=None
    # payment keeps its own ID, so explicitly remove its mapping for this case.
    source['draft']['mappings']=source['draft']['mappings'][:1]
    report,*_=treatment.prepare(source,rows,partial=True)
    assert not report['canSync']


def test_ai_repairs_only_observed_nonidentity_conflicts_and_never_apply_without_confirmation():
    source,rows=source_fixture()
    bad=deepcopy(rows[0]);bad['row']=4;bad['values']['金额']=999;rows.append(bad)
    candidates=treatment.candidates(source,rows)
    assert len(candidates)==1
    key=candidates[0]['key']
    proposal=treatment.proposal(source,rows,{'repairs':[{'key':key,'values':{'amount':999},'reason':'采用经业务确认的修订值，需核对来源第4行'}]})
    assert treatment.prepare(source,rows,True)[0]['quarantine']['rows']==2
    assert proposal['after']['quarantine']['rows']==0
    source['dataTreatment']=treatment.confirm(source,rows,proposal,[key],'reviewer')
    report,nodes,edges,_=treatment.prepare(source,rows,True)
    assert report['canSync'] and len(nodes)==3 and len(edges)==1
    assert source['dataTreatment']['audit'][-1]['actor']=='reviewer'
    assert next(n for n in nodes if n['key']==key)['payload'].find('999')>=0
    with pytest.raises(ValueError):
        treatment.proposal(source,rows,{'repairs':[{'key':key,'values':{'line_no':'999'},'reason':'改身份'}]})


def test_unobserved_values_and_stale_confirmation_rejected():
    source,rows=source_fixture();bad=deepcopy(rows[0]);bad['row']=4;bad['values']['金额']=999;rows.append(bad)
    key=treatment.candidates(source,rows)[0]['key']
    with pytest.raises(ValueError):
        treatment.proposal(source,rows,{'repairs':[{'key':key,'values':{'amount':12},'reason':'无依据'}]})
    proposal=treatment.proposal(source,rows,{'repairs':[{'key':key,'values':{'amount':999},'reason':'来源值待确认'}]})
    rows[0]['values']['金额']=101
    with pytest.raises(ValueError):treatment.confirm(source,rows,proposal,[key],'reviewer')


def test_confirmed_cardinality_and_alternative_key_are_respected():
    source,rows=source_fixture()
    source['draft']['relationships'][0].update(cardinality='1:1')
    row=deepcopy(rows[-1]);row['row']=3;row['values']['付款号']='P2';rows.append(row)
    report,nodes,edges,deferred=treatment.prepare(source,rows,True)
    assert len(nodes)==4 and not edges
    assert any('基数' in d['reason'] for d in deferred)
    source['draft']['classes'][0]['uniqueKeys']=[{'properties':['line_no'],'confirmed':True,'reason':'需唯一'}]
    report,nodes,edges,deferred=treatment.prepare(source,rows,True)
    assert len(nodes)==2 and not edges
    assert any('替代唯一键' in d['reason'] for d in deferred)
