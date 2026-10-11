"""Inert AI instance-edit proposals and a native-validated, explicitly gated subset."""

from collections import defaultdict
from copy import deepcopy
from uuid import uuid4

from pydantic import Field

from .core import Draft, EntityKey, Primitive, Strict, _evaluate, convert, digest
from .store import now


class Repair(Strict):
    key: EntityKey
    values: dict[str, Primitive]
    reason: str = Field(min_length=1, max_length=1000)


class Repairs(Strict):
    repairs: list[Repair] = Field(max_length=30)


def base_hash(source, rows):
    return digest({'id': source['id'], 'draft': source['draft'], 'rows': rows})


def effective(source, rows):
    draft = deepcopy(source['draft'])
    treatment = source.get('dataTreatment') or {}
    if treatment.get('baseHash') != base_hash(source, rows):
        return draft
    edits = {e['key']: deepcopy(e) for e in draft.get('instanceEdits', [])}
    for repair in treatment.get('edits', []):
        edit = edits.setdefault(repair['key'], {'key': repair['key'], 'values': {}, 'excluded': False})
        edit['values'].update(repair['values'])
    draft['instanceEdits'] = list(edits.values())
    return Draft.model_validate(draft).model_dump()


def summarize(deferred, draft):
    groups = {}
    rows = set()
    for entry in deferred:
        refs = {(r['sheet'], r['row']) for r in entry['sources']}
        rows.update(refs)
        token = (entry['kind'], entry.get('classId', entry['item']), entry['reason'])
        group = groups.setdefault(token, {'kind':entry['kind'], 'item': token[1], 'reason':entry['reason'], 'count':0, 'examples':[]})
        group['count'] += len(refs) if refs else entry.get('count', 1)
        for sheet, row in sorted(refs):
            if len(group['examples']) < 3:
                group['examples'].append({'sheet':sheet,'row':row})
    names = {c['id']:c['name'] for c in draft['classes']}
    names.update({r['id']:r['name'] for r in draft['relationships']})
    for group in groups.values():group['name'] = names.get(group['item'], group['item'])
    return {'rows':len(rows), 'entities':sum(d['kind']=='entity' for d in deferred),
            'relationships':len({d['item'] for d in deferred if d['kind']=='relationship'}),
            'groups':list(groups.values())[:100], 'groupsTruncated':len(groups)>100}


def prepare(source, rows, partial=False):
    draft = effective(source, rows)
    deferred = []
    report, nodes, edges = _evaluate(draft, rows, True, quarantine=deferred if partial else None)
    report.update(scope='data', canSync=report.pop('canPublish'))
    report['quarantine'] = summarize(deferred, draft)
    if partial and not nodes:
        report['canSync'] = False
    # Includes approved edits, source contents, exact eligible graph and deferred manifest.
    publication=source.get('publication') or {}
    report['checkHash'] = digest({'base':base_hash(source,rows), 'draft':draft, 'plan':source.get('plan'),
                                  'publication':{k:publication.get(k) for k in ['configHash','status','completed','results']},
                                  'nodes':nodes, 'edges':edges, 'deferred':deferred})
    return report,nodes,edges,deferred


def candidates(source, rows):
    _,_,_,deferred = prepare(source,rows,True)
    conflicts = {d['item']:d for d in deferred if d.get('conflicts')}
    if not conflicts:return []
    model = Draft.model_validate(effective(source,rows))
    classes = {c.id:c for c in model.classes}
    grouped = defaultdict(list)
    for row in rows[0] if isinstance(rows,tuple) else rows:grouped[row['sheet']].append(row)
    variants = defaultdict(lambda:defaultdict(dict))
    for mapping in model.mappings:
        cls = classes[mapping.classId]
        if not cls.included or not cls.identity:continue
        for row in grouped[mapping.sheet]:
            try:
                props = {p.id:convert(row['values'].get(mapping.bindings.get(p.id,'')),p.dataType) for p in cls.properties}
            except (ValueError,TypeError,OverflowError):continue
            identity = [props[p] for p in cls.identity]
            key = f'entity:{cls.id}:' + digest(identity)[:24]
            if key not in conflicts:continue
            for prop in conflicts[key]['conflicts']:
                value=props[prop]
                if prop in cls.identity or value is None or len(str(value))>500:continue
                token = digest(value)
                item=variants[key][prop].setdefault(token,{'value':value,'rows':[]})
                if len(item['rows'])<3:item['rows'].append({'sheet':row['sheet'],'row':row['row']})
    result=[]
    for key in sorted(conflicts):
        fields={p:list(values.values())[:6] for p,values in variants[key].items() if len(values)<=6}
        if fields:
            cls=classes[conflicts[key]['classId']]
            result.append({'key':key,'classId':cls.id,'name':cls.name,'identity':conflicts[key]['identity'],
                           'properties':{p.id:p.name for p in cls.properties if p.id in fields},'variants':fields})
        if len(result)>=30:break
    return result


def proposal(source, rows, raw):
    patches = Repairs.model_validate(raw)
    allowed = {c['key']:c for c in candidates(source,rows)}
    selected=[];seen=set()
    for patch in patches.repairs:
        candidate=allowed.get(patch.key)
        if not candidate or patch.key in seen or not patch.values:
            raise ValueError('AI 修复引用无效、重复或空实例，原数据未修改')
        for prop,value in patch.values.items():
            if prop not in candidate['variants'] or not any(digest(value)==digest(v['value']) for v in candidate['variants'][prop]):
                raise ValueError('AI 修复必须采用当前冲突组已有的非身份属性值，禁止编造或修改身份')
        selected.append({**patch.model_dump(), 'name':candidate['name'], 'identity':candidate['identity'],
                         'before':{p:candidate['variants'][p] for p in patch.values}, 'properties':candidate['properties']})
        seen.add(patch.key)
    result={'id':str(uuid4()),'inputHash':input_hash(source,rows),'baseHash':base_hash(source,rows),
            'createdAt':now(),'repairs':selected,'before':prepare(source,rows,True)[0]}
    trial=deepcopy(source)
    trial['dataTreatment']=confirm(source,rows,result,[p['key'] for p in selected],'preview',preview=True)
    result['after']=prepare(trial,rows,True)[0]
    if result['after']['errors']>result['before']['errors']:
        raise ValueError('修复引入额外配置阻断，方案未采用')
    return result


def input_hash(source,rows):
    return digest({'base':base_hash(source,rows),'draft':effective(source,rows)})


def confirm(source,rows,proposal,keys,actor,preview=False):
    if proposal['inputHash']!=input_hash(source,rows):raise ValueError('修复方案已过期，请重新分析')
    repairs={r['key']:r for r in proposal['repairs']}
    if len(set(keys))!=len(keys) or not set(keys)<=repairs.keys():raise ValueError('确认项不属于当前修复方案')
    current=source.get('dataTreatment') or {}
    if current.get('baseHash')!=base_hash(source,rows):current={}
    edits={r['key']:deepcopy(r) for r in current.get('edits',[])}
    audit=list(current.get('audit',[]))
    for key in keys:
        patch=repairs[key]
        edit=edits.setdefault(key,{'key':key,'values':{}});edit['values'].update(patch['values'])
        if not preview:audit.append({'proposalId':proposal['id'],'key':key,'actor':actor,'at':now(),
                                    'before':patch['before'],'after':patch['values'],'reason':patch['reason']})
    if len(edits)>1000:raise ValueError('实例修订超过平台容量，请分来源处理')
    return {'baseHash':base_hash(source,rows),'edits':list(edits.values()),'audit':audit}
