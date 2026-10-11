from copy import deepcopy

import pytest

from mate_tech_ont.modeling.core import Draft
from mate_tech_ont.modeling.generation_quality import analyze, apply_repairs, input_fingerprint


def fixture():
    value = {'name': '费用明细', 'relationships': [], 'classes': [{'id': 'line', 'name': '费用明细', 'identity': ['line_no'], 'identityStatus': 'proposed',
        'identityReason': '单据中的明细号', 'grain': '一张单据中的一行', 'labelProperty': 'line_no',
        'properties': [{'id': 'line_no', 'name': '明细编号', 'dataType': 'text'}, {'id': 'document_id', 'name': '单据编号', 'dataType': 'text'},
                       {'id': 'amount', 'name': '金额', 'dataType': 'number'}]}],
        'mappings': [{'id': 'm', 'classId': 'line', 'sheet': '费用', 'bindings': {'line_no': '明细号', 'document_id': '单号', 'amount': '金额'}}]}
    rows = [{'sheet': '费用', 'row': 2, 'values': {'单号': 'A', '明细号': '10', '金额': 100}},
            {'sheet': '费用', 'row': 3, 'values': {'单号': 'B', '明细号': '10', '金额': 200}}]
    return Draft.model_validate(value).model_dump(), rows


def test_full_data_detects_local_line_identity_and_only_identifier_extensions():
    value, rows = fixture()
    report = analyze(value, rows)
    item = report['identities'][0]
    assert item['conflictingIdentities'] == 1
    assert item['candidates'][0]['identity'] == ['line_no', 'document_id']
    assert item['candidates'][0]['conflictingIdentities'] == 0
    assert all('amount' not in c['identity'] for c in item['candidates'])


def test_repair_preserves_concepts_and_never_approves_or_changes_source_rows():
    value, rows = fixture(); original = deepcopy(rows)
    fixed, changes = apply_repairs(value, rows, {'repairs': [{'kind': 'identity', 'id': 'line', 'identity': ['line_no', 'document_id'], 'reason': '明细编号由所属单据限定'}]})
    assert fixed['classes'][0]['identity'] == ['line_no', 'document_id']
    assert fixed['classes'][0]['identityStatus'] == 'proposed' and not fixed['classes'][0]['accepted']
    assert changes[0]['before'] == ['line_no']
    assert fixed['mappings'] == value['mappings'] and fixed['classes'][0]['properties'] == value['classes'][0]['properties']
    assert rows == original and value['classes'][0]['identity'] == ['line_no']


@pytest.mark.parametrize('identity', [['amount'], ['line_no', 'amount'], ['unknown'], ['document_id']])
def test_statistical_unique_measures_or_replacing_existing_identity_are_rejected(identity):
    value, rows = fixture()
    fixed, changes = apply_repairs(value, rows, {'repairs': [{'kind': 'identity', 'id': 'line', 'identity': identity, 'reason': '试图消除报错'}]})
    assert fixed == value and not changes


def test_genuine_conflict_missing_identifier_and_repeat_projection_are_distinct():
    value, rows = fixture()
    rows[1]['values']['单号'] = 'A'
    report = analyze(value, rows)
    assert report['identities'][0]['conflictingIdentities'] == 1
    assert not report['identities'][0]['candidates']
    rows[1]['values']['金额'] = 100
    assert analyze(value, rows)['identities'][0]['conflictingIdentities'] == 0
    rows[1]['values']['明细号'] = None
    assert analyze(value, rows)['identities'][0]['emptyIdentityRows'] == 1


def test_confirmed_identity_and_hierarchy_are_not_silently_changed():
    value, rows = fixture()
    value['classes'][0]['accepted'] = True
    patch = {'repairs': [{'kind': 'identity', 'id': 'line', 'identity': ['line_no', 'document_id'], 'reason': '明细属于单据'}]}
    assert apply_repairs(value, rows, patch)[0] == value
    value['classes'][0]['accepted'] = False
    child = deepcopy(value['classes'][0]); child.update(id='special_line', name='特定明细', parentClassId='line', inheritanceReason='业务分类')
    value['classes'].append(child)
    fixed, _ = apply_repairs(value, rows, patch)
    assert fixed['classes'][0]['identity'] == fixed['classes'][1]['identity'] == ['line_no', 'document_id']


def test_conceptual_parent_can_use_descendant_evidence_without_duplicating_instances():
    value, rows = fixture()
    child = deepcopy(value['classes'][0]); child.update(id='special_line',name='特定明细',parentClassId='line',inheritanceReason='业务分类')
    value['classes'].append(child);value['mappings'][0]['classId']='special_line'
    report=analyze(value,rows)
    assert report['identities'][0]['rows'] == 0
    assert report['identities'][0]['candidateBasis']['rows'] == 2
    fixed, changes=apply_repairs(value,rows,{'repairs':[{'kind':'identity','id':'line','identity':['line_no','document_id'],'reason':'子类明细同样由所属单据限定'}]})
    assert len(changes)==1 and all(c['identity']==['line_no','document_id'] for c in fixed['classes'])
    assert fixed['mappings'][0]['classId']=='special_line'


def test_input_fingerprint_covers_full_rows_context_native_and_policy_schema():
    value, rows = fixture()
    key = input_fingerprint((rows, {'费用': ['单号','明细号','金额']}), '背景', [], [{'rid': 'B'}, {'rid': 'A'}])
    assert key == input_fingerprint((rows, {'费用': ['单号','明细号','金额']}), '背景', [], [{'rid': 'A'}, {'rid': 'B'}])
    changed = deepcopy(rows); changed[-1]['values']['金额'] = 201
    assert key != input_fingerprint((changed, {'费用': ['单号','明细号','金额']}), '背景', [], [{'rid':'A'}, {'rid':'B'}])
    assert key != input_fingerprint((rows, {'费用': ['单号','明细号','金额']}), '不同背景', [], [{'rid':'A'}, {'rid':'B'}])


def test_arbitrary_fields_in_model_patches_are_rejected():
    value, rows = fixture()
    with pytest.raises(ValueError):
        apply_repairs(value, rows, {'repairs': [{'kind': 'identity', 'id': 'line', 'identity': ['line_no','document_id'], 'reason': '依据', 'accepted': True}]})


def related_fixture():
    value, rows = fixture()
    value['classes'][0]['identity'] = ['line_no', 'document_id']
    source = deepcopy(value['classes'][0]); source.update(id='payment', name='付款明细', identity=['payment_id'], labelProperty='payment_id')
    source['properties'].append({'id':'payment_id','name':'付款明细标识','dataType':'text'})
    value['classes'].append(source)
    value['mappings'].append({'id':'payments','classId':'payment','sheet':'付款','bindings':{'payment_id':'付款号','line_no':'明细号','document_id':'单号'}})
    rows.append({'sheet':'付款','row':2,'values':{'付款号':'P1','明细号':'10','单号':'A'}})
    value['relationships'] = [{'id':'pays','name':'付款归属费用明细','source':'payment','target':'line','joins':[{'sourceProperty':'line_no','targetProperty':'line_no'}], 'targetSelection':'entity','cardinality':'N:1','cardinalityReason':'付款明细归属单条费用明细','cardinalityStatus':'proposed','accepted':False}]
    return Draft.model_validate(value).model_dump(), rows


def test_join_repair_covers_complete_identity_and_keeps_business_cardinality():
    value, rows = related_fixture()
    candidates = analyze(value, rows)['relationshipCandidates']
    assert candidates == [{'relationId': 'pays', 'joins': [
        {'sourceProperty': 'line_no', 'targetProperty': 'line_no'},
        {'sourceProperty': 'document_id', 'targetProperty': 'document_id'},
    ]}]
    fixed, changes = apply_repairs(value, rows, {'repairs':[{'kind':'joins','id':'pays','joins':[{'sourceProperty':'line_no','targetProperty':'line_no'},{'sourceProperty':'document_id','targetProperty':'document_id'}],'reason':'来源含所属单据编号与明细号，覆盖目标完整身份'}]})
    assert len(fixed['relationships'][0]['joins']) == 2 and len(changes) == 1
    assert fixed['relationships'][0]['cardinality'] == 'N:1'
    assert not fixed['relationships'][0]['accepted']
    assert analyze(fixed, rows)['structureErrors'] == analyze(fixed, rows)['dataErrors'] == 0


def test_same_typed_unrelated_fields_and_unmatched_joins_are_not_auto_repaired():
    value, rows = related_fixture()
    source=value['classes'][1];source['properties'].append({'id':'account_id','name':'账户编号','dataType':'text'})
    value['mappings'][1]['bindings']['account_id']='账户编号';rows[-1]['values']['账户编号']='A'
    patch={'repairs':[{'kind':'joins','id':'pays','joins':[{'sourceProperty':'line_no','targetProperty':'line_no'},{'sourceProperty':'account_id','targetProperty':'document_id'}],'reason':'同类型但无业务含义证据'}]}
    assert apply_repairs(value, rows, patch)[0] == value
    patch['repairs'][0]['joins'][1]['sourceProperty']='document_id'
    rows[-1]['values']['单号']='nonexistent'
    assert apply_repairs(value, rows, patch)[0] == value
