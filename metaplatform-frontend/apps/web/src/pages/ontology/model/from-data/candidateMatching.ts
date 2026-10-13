import type { KernelObjectType } from '@/api/ont/kernel';
import type { ModelingClass, ModelingResolution } from '@/api/ont/modeling';

const normalize = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '');

/** Suggest exact, unambiguous fields; native validation still checks identity and types. */
export function suggestResolution(cls: ModelingClass, target: KernelObjectType): ModelingResolution {
  const propertyMap: Record<string, string> = {};
  const used = new Set<string>();
  const properties = cls.properties.filter(prop => prop.included !== false);
  for (const prop of properties) {
    const expected = { text: 'string', number: 'double', date: 'date' }[prop.dataType];
    const targetSlug = target.rid.split('.').at(-2) || '';
    const matches = target.properties.filter(p => {
      if (p.type_id !== expected) return false;
      const slug = p.rid.split('.').at(-2) || '';
      const localSlug = slug.startsWith(`${targetSlug}-`) ? slug.slice(targetSlug.length + 1) : slug;
      const identifiers = [p.title || '', slug, localSlug].map(normalize);
      return [prop.name, prop.id].some(value => identifiers.includes(normalize(value)));
    });
    if (matches.length === 1 && !used.has(matches[0].rid)) {
      propertyMap[prop.id] = matches[0].rid;
      used.add(matches[0].rid);
    }
  }
  return { mode: Object.keys(propertyMap).length === properties.length ? 'reuse' : 'extend', targetRid: target.rid, propertyMap };
}

export function localMatches(cls: ModelingClass, types: KernelObjectType[]) {
  return types.filter(t => normalize(t.display_name) === normalize(cls.name) ||
    t.rid.split('.').some(part => normalize(part) === normalize(cls.id)));
}
