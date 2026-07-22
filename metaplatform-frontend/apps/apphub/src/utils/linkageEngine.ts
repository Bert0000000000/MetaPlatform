import type { LinkageRule, FormField } from '@/types';

export interface LinkageResult {
  visible: Record<string, boolean | undefined>;
  required: Record<string, boolean | undefined>;
  readonly: Record<string, boolean | undefined>;
  value: Record<string, unknown>;
  options: Record<string, Array<{ label: string; value: string }>>;
}

function compare(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case 'eq':
      return String(actual) === String(expected);
    case 'ne':
      return String(actual) !== String(expected);
    case 'contains':
      return String(actual).includes(String(expected));
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'in':
      return String(expected)
        .split(',')
        .map((s) => s.trim())
        .includes(String(actual));
    default:
      return false;
  }
}

export function evaluateLinkageRules(
  rules: LinkageRule[],
  values: Record<string, unknown>
): LinkageResult {
  const result: LinkageResult = {
    visible: {},
    required: {},
    readonly: {},
    value: {},
    options: {},
  };

  for (const rule of rules) {
    const when = rule.when;
    const actual = values[when.fieldKey];
    const matched = compare(actual, when.operator || 'eq', when.value);
    if (!matched) continue;

    const then = rule.then;
    const key = then.fieldKey;
    switch (then.action) {
      case 'show':
        result.visible[key] = true;
        break;
      case 'hide':
        result.visible[key] = false;
        break;
      case 'require':
        result.required[key] = true;
        break;
      case 'optional':
        result.required[key] = false;
        break;
      case 'readonly':
        result.readonly[key] = true;
        break;
      case 'editable':
        result.readonly[key] = false;
        break;
      case 'setValue':
        result.value[key] = then.value;
        break;
      case 'setOptions':
        if (then.options) {
          result.options[key] = then.options;
        }
        break;
    }
  }

  return result;
}

export function applyLinkageToFields(
  fields: FormField[],
  linkageResult: LinkageResult
): FormField[] {
  return fields.map((field) => {
    const key = field.fieldKey;
    const updates: Partial<FormField> = {};
    if (linkageResult.visible[key] !== undefined) {
      updates.hidden = !linkageResult.visible[key];
    }
    if (linkageResult.required[key] !== undefined) {
      updates.required = linkageResult.required[key];
    }
    if (linkageResult.readonly[key] !== undefined) {
      updates.readonly = linkageResult.readonly[key];
    }
    if (linkageResult.options[key] !== undefined) {
      updates.options = linkageResult.options[key];
    }
    return { ...field, ...updates };
  });
}
