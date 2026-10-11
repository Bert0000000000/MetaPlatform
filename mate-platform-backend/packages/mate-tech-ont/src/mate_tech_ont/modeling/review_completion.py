"""One explicit review of a complete, dependency-closed candidate treatment plan."""

from copy import deepcopy

from .core import Draft, digest, validate_ontology
from .data_treatment import prepare
from .generation_quality import _records, _suggest_joins
from .rules import validate_evidence
from .scope import publication_scope


def propose(source, rows, defer_classes=()):
    if (source.get('publication') or {}).get('completed'):
        raise ValueError('已有发布结果，请使用原生迁移或另建来源；不能批量改变本次发布范围')
    draft = Draft.model_validate(source['draft']).model_dump()
    original = deepcopy(draft)
    changes = []
    classes = {c['id']: c for c in draft['classes']}
    if not set(defer_classes) <= classes.keys():
        raise ValueError('暂缓范围包含不存在的对象类型，请重新查看方案')

    def note(item, action, reason):
        kind = 'relationships' if 'source' in item else 'mappings' if 'classId' in item else 'classes'
        changes.append({'kind': kind, 'id': item['id'], 'name': item['name'], 'action': action, 'reason': reason})

    for ident in sorted(set(defer_classes)):
        cls = classes[ident]
        if cls['included']:
            cls['included'] = False; cls['accepted'] = False
            note(cls, '暂缓', '用户选择本次不发布；该类实例及依赖关系不进入本次同步')

    # Only copy explicit inherited definitions. Identity mappings are never guessed.
    for _ in classes:
        changed = False
        for cls in classes.values():
            parent = classes.get(cls.get('parentClassId'))
            if not cls['included'] or not parent or not parent['included']:
                continue
            additions = [p for p in parent['properties'] if not any(q['id'] == p['id'] for q in cls['properties'])]
            if additions:
                cls['properties'].extend(deepcopy(additions)); changed = True
                note(cls, '修复', '补齐平台要求的父类属性：' + '、'.join(p['name'] for p in additions))
            if cls['identity'] != parent['identity'] and parent['identity']:
                mappings = [m for m in draft['mappings'] if m['classId'] == cls['id']]
                if mappings and all(all(m['bindings'].get(p) for p in parent['identity']) for m in mappings):
                    cls['identity'] = list(parent['identity']); cls['identityCandidate'] = list(parent['identity'])
                    cls['identityStatus'] = 'proposed'; changed = True
                    note(cls, '修复', '沿用父类身份，所有来源映射已有对应字段')
        if not changed:
            break

    for cls in classes.values():
        if not cls['included']:
            continue
        if cls['identityStatus'] in ('proposed', 'legacy') and cls['identity'] and cls['identityReason'].strip():
            cls['identityStatus'] = 'confirmed'
        if not cls['accepted']:
            note(cls, '确认', cls['identityReason'] or '保留明确声明的来源记录身份，不跨文件对齐')
        cls['accepted'] = True
    records = _records(Draft.model_validate({**draft, 'mappings': publication_scope(draft)['mappings']}), rows)
    for rel in draft['relationships']:
        if not rel['included']:
            continue
        if not rel['accepted']:
            model = Draft.model_validate(draft)
            candidate = next(r for r in model.relationships if r.id == rel['id'])
            joins = _suggest_joins(model, candidate)
            if joins:
                src, dst = classes[rel['source']], classes[rel['target']]
                sp = {p['id']: p['dataType'] for p in src['properties']}
                tp = {p['id']: p['dataType'] for p in dst['properties']}
                if any(sp.get(j['sourceProperty']) != tp.get(j['targetProperty']) for j in joins):
                    joins = []
                elif records[src['id']] and records[dst['id']]:
                    targets = {tuple(r['values'].get(j['targetProperty']) for j in joins)
                               for r in records[dst['id']]
                               if all(r['values'].get(j['targetProperty']) not in (None, '') for j in joins)}
                    if not any(tuple(r['values'].get(j['sourceProperty']) for j in joins) in targets for r in records[src['id']]):
                        joins = []
            if joins:
                rel['joins'] = joins
                note(rel, '修复', '保留原关联条件，按来源映射中唯一对应的字段补齐目标身份')
        if rel['cardinalityStatus'] == 'proposed' and rel['cardinalityReason'].strip():
            rel['cardinalityStatus'] = 'confirmed'
        if not rel['accepted']:
            note(rel, '确认', rel['cardinalityReason'] or '缺少基数依据，将在下方校验后暂缓')
        rel['accepted'] = True

    def defer(item, reason):
        if not item['included']:
            return False
        item['included'] = False; item['accepted'] = False
        note(item, '暂缓', reason)
        return True

    headers = {s['name']: {c['name'] for c in s['columns']} for s in source['profile']['sheets']}
    for mapping in draft['mappings']:
        cls = classes.get(mapping['classId'])
        if not cls or not cls['included']:
            continue
        columns = headers.get(mapping['sheet'], set())
        required = {*cls['identity'], cls['labelProperty']}
        for prop in cls['properties']:
            if prop['id'] not in required or mapping['bindings'].get(prop['id']):
                continue
            matches = {value for value in (prop['id'], prop['name']) if value in columns}
            if len(matches) == 1:
                mapping['bindings'][prop['id']] = next(iter(matches))
                note(cls, '修复映射', f"{mapping['sheet']}：{prop['name']}采用唯一同名来源列")
        if (mapping['sheet'] not in headers or not required <= mapping['bindings'].keys()
                or not set(mapping['bindings'].values()) <= columns
                or not set(mapping['bindings']) <= {p['id'] for p in cls['properties']}):
            defer(cls, f"{mapping['sheet']}缺少有效身份、标签或字段绑定；本次暂缓该类及实例")

    # Resolve the complete dependency closure before asking the user to confirm.
    for _ in range(len(classes) + len(draft['relationships']) + 1):
        changed = False
        for cls in classes.values():
            if cls.get('parentClassId') and not classes.get(cls['parentClassId'], {}).get('included', False):
                changed |= defer(cls, '父类未纳入本次发布，保留候选供后续完善')
        for rel in draft['relationships']:
            if not all(classes.get(rel[key], {}).get('included', False) for key in ('source', 'target')):
                changed |= defer(rel, '依赖对象已暂缓，不生成悬空关系')
        report = validate_ontology(draft)
        issues = report['issues'] + validate_evidence(draft, source['profile'])
        for issue in issues:
            if issue['severity'] != 'error':
                continue
            item = classes.get(issue['item']) or next((r for r in draft['relationships'] if r['id'] == issue['item']), None)
            if item:
                changed |= defer(item, issue['message'])
        if not changed:
            break
    for mapping in draft['mappings']:
        if classes.get(mapping['classId'], {}).get('included') and not mapping['accepted']:
            mapping['accepted'] = True
            note(mapping | {'name': mapping['sheet']}, '确认映射', '核对当前来源字段绑定，数据问题由同步检查隔离')

    report = validate_ontology(draft)
    evidence = validate_evidence(draft, source['profile'])
    remaining = [i for i in report['issues'] + evidence if i['severity'] == 'error']
    trial = {**source, 'draft': draft}
    data, nodes, edges, _ = prepare(trial, rows, True)
    # Eliminate confirmation rows for items subsequently deferred; show each decision once.
    deferred = {(c['kind'], c['id']) for c in changes if c['action'] == '暂缓'}
    changes = [c for c in changes if c['action'] != '确认' or (c['kind'], c['id']) not in deferred]
    candidates = [{'id': c['id'], 'name': c['name'], 'included': c['included'],
                   'originallyIncluded': old['included'], 'parent': c.get('parentClassId'),
                   'identity': [p['name'] for ident in c['identity'] for p in c['properties'] if p['id'] == ident],
                   'reason': c['identityReason'],
                   'problem': next((x['reason'] for x in changes if x['kind'] == 'classes' and x['id'] == c['id'] and x['action'] == '暂缓'), '')}
                  for c, old in zip(draft['classes'], original['classes'])]
    return {'draft': draft, 'changes': changes, 'remaining': remaining,
            'candidates': candidates,
            'relationships': [{'id': r['id'], 'name': r['name'], 'included': r['included'],
                               'cardinality': r['cardinality'], 'reason': r['cardinalityReason'],
                               'source': r['source'], 'target': r['target'], 'joins': r['joins']}
                              for r in draft['relationships']],
            'counts': {'classes': sum(c['included'] for c in classes.values()),
                       'relationships': sum(r['included'] for r in draft['relationships']),
                       'deferred': sum(not c['included'] for c in classes.values()) + sum(not r['included'] for r in draft['relationships'])},
            'data': {'nodes': len(nodes), 'edges': len(edges), 'rows': data['quarantine']['rows'],
                     'canSync': data['canSync'], 'errors': data['errors']},
            'canApply': not remaining,
            'hash': digest({'revision': source['revision'], 'original': original, 'rows': rows,
                            'profile': source['profile'], 'draft': draft, 'resolutions': source.get('resolutions'),
                            'deferClasses': sorted(set(defer_classes))})}
