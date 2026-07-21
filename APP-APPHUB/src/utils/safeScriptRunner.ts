import type { FormValidationError } from '@/types';

export interface ScriptContext {
  values: Record<string, unknown>;
  form: FormApi;
  console: ConsoleApi;
}

export interface FormApi {
  setFieldVisible: (fieldKey: string, visible: boolean) => void;
  setFieldRequired: (fieldKey: string, required: boolean) => void;
  setFieldReadonly: (fieldKey: string, readonly: boolean) => void;
  setFieldValue: (fieldKey: string, value: unknown) => void;
  setFieldOptions: (fieldKey: string, options: Array<{ label: string; value: string }>) => void;
  addError: (fieldKey: string, message: string) => void;
}

export interface ConsoleApi {
  log: (...args: unknown[]) => void;
}

export interface ScriptResult {
  fieldVisible: Record<string, boolean>;
  fieldRequired: Record<string, boolean>;
  fieldReadonly: Record<string, boolean>;
  fieldValue: Record<string, unknown>;
  fieldOptions: Record<string, Array<{ label: string; value: string }>>;
  errors: FormValidationError[];
}

export function createScriptContext(): { context: ScriptContext; result: ScriptResult } {
  const result: ScriptResult = {
    fieldVisible: {},
    fieldRequired: {},
    fieldReadonly: {},
    fieldValue: {},
    fieldOptions: {},
    errors: [],
  };

  const form: FormApi = {
    setFieldVisible: (fieldKey, visible) => {
      result.fieldVisible[fieldKey] = visible;
    },
    setFieldRequired: (fieldKey, required) => {
      result.fieldRequired[fieldKey] = required;
    },
    setFieldReadonly: (fieldKey, readonly) => {
      result.fieldReadonly[fieldKey] = readonly;
    },
    setFieldValue: (fieldKey, value) => {
      result.fieldValue[fieldKey] = value;
    },
    setFieldOptions: (fieldKey, options) => {
      result.fieldOptions[fieldKey] = options;
    },
    addError: (fieldKey, message) => {
      result.errors.push({ fieldKey, code: 'SCRIPT_VALIDATION', message });
    },
  };

  const consoleApi: ConsoleApi = {
    log: (...args) => {
      // eslint-disable-next-line no-console
      console.log('[form-script]', ...args);
    },
  };

  return {
    context: {
      values: {},
      form,
      console: consoleApi,
    },
    result,
  };
}

/**
 * 受限脚本执行器：仅支持 if/else、比较/逻辑运算、算术、点访问与方法调用。
 * 不使用 eval / new Function，保证 preview 安全。
 */
export function runScript(script: string, values: Record<string, unknown>): ScriptResult {
  const { context, result } = createScriptContext();
  context.values = values;

  if (!script || !script.trim()) {
    return result;
  }

  try {
    const parser = new ScriptParser(script);
    parser.parseProgram(context);
  } catch (e) {
    result.errors.push({
      code: 'SCRIPT_ERROR',
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return result;
}

type TokenType =
  | 'ident'
  | 'string'
  | 'number'
  | 'bool'
  | 'null'
  | 'if'
  | 'else'
  | 'lparen'
  | 'rparen'
  | 'lbrace'
  | 'rbrace'
  | 'lbracket'
  | 'rbracket'
  | 'comma'
  | 'dot'
  | 'semi'
  | 'assign'
  | 'eq'
  | 'ne'
  | 'lt'
  | 'gt'
  | 'lte'
  | 'gte'
  | 'and'
  | 'or'
  | 'not'
  | 'plus'
  | 'minus'
  | 'mul'
  | 'div'
  | 'mod'
  | 'colon'
  | 'eof';

interface Token {
  type: TokenType;
  value: string | number | boolean | null;
}

class ScriptParser {
  private readonly tokens: Token[];
  private pos = 0;

  constructor(script: string) {
    this.tokens = tokenize(script);
  }

  parseProgram(ctx: ScriptContext): void {
    while (this.current().type !== 'eof') {
      this.parseStatement(ctx);
    }
  }

  private parseStatement(ctx: ScriptContext): void {
    if (this.current().type === 'if') {
      this.parseIf(ctx);
    } else if (this.current().type === 'ident') {
      this.parseExpressionStatement(ctx);
      this.consume('semi');
    } else {
      throw new Error(`Unexpected token: ${this.current().type}`);
    }
  }

  private parseIf(ctx: ScriptContext): void {
    this.consume('if');
    this.consume('lparen');
    const condition = this.parseExpression(ctx);
    this.consume('rparen');
    this.consume('lbrace');
    if (toBoolean(condition)) {
      while (this.current().type !== 'rbrace' && this.current().type !== 'eof') {
        this.parseStatement(ctx);
      }
      this.consume('rbrace');
      this.skipElseIfAny();
    } else {
      this.skipBlock();
      if (this.current().type === 'else') {
        this.consume('else');
        if (this.current().type === 'if') {
          this.parseIf(ctx);
        } else {
          this.consume('lbrace');
          while (this.current().type !== 'rbrace' && this.current().type !== 'eof') {
            this.parseStatement(ctx);
          }
          this.consume('rbrace');
        }
      }
    }
  }

  private skipElseIfAny(): void {
    while (this.current().type === 'else') {
      this.consume('else');
      if (this.current().type === 'if') {
        this.consume('if');
        this.consume('lparen');
        this.skipExpression();
        this.consume('rparen');
        this.skipBlock();
      } else {
        this.skipBlock();
        break;
      }
    }
  }

  private skipBlock(): void {
    this.consume('lbrace');
    let depth = 1;
    while (depth > 0 && this.current().type !== 'eof') {
      const t = this.current().type;
      this.advance();
      if (t === 'lbrace') depth++;
      if (t === 'rbrace') depth--;
    }
  }

  private skipExpression(): void {
    let depth = 0;
    while (this.current().type !== 'eof') {
      const t = this.current().type;
      if (t === 'lparen' || t === 'lbrace' || t === 'lbracket') depth++;
      if (t === 'rparen' || t === 'rbrace' || t === 'rbracket') {
        if (depth === 0 && t === 'rparen') break;
        depth--;
      }
      this.advance();
    }
  }

  private parseExpressionStatement(ctx: ScriptContext): unknown {
    const left = this.parsePrimary(ctx);
    return this.parseCallOrAssign(ctx, left);
  }

  private parseExpression(ctx: ScriptContext): unknown {
    return this.parseOr(ctx);
  }

  private parseOr(ctx: ScriptContext): unknown {
    let left = this.parseAnd(ctx);
    while (this.current().type === 'or') {
      this.advance();
      const right = this.parseAnd(ctx);
      left = toBoolean(left) || toBoolean(right);
    }
    return left;
  }

  private parseAnd(ctx: ScriptContext): unknown {
    let left = this.parseComparison(ctx);
    while (this.current().type === 'and') {
      this.advance();
      const right = this.parseComparison(ctx);
      left = toBoolean(left) && toBoolean(right);
    }
    return left;
  }

  private parseComparison(ctx: ScriptContext): unknown {
    const left = this.parseAdditive(ctx);
    const op = this.current().type;
    if (['eq', 'ne', 'lt', 'gt', 'lte', 'gte'].includes(op)) {
      this.advance();
      const right = this.parseAdditive(ctx);
      return compare(left, op, right);
    }
    return left;
  }

  private parseAdditive(ctx: ScriptContext): unknown {
    let left = this.parseMultiplicative(ctx);
    while (this.current().type === 'plus' || this.current().type === 'minus') {
      const op = this.current().type;
      this.advance();
      const right = this.parseMultiplicative(ctx);
      if (op === 'plus') left = add(left, right);
      else left = subtract(left, right);
    }
    return left;
  }

  private parseMultiplicative(ctx: ScriptContext): unknown {
    let left = this.parseUnary(ctx);
    while (this.current().type === 'mul' || this.current().type === 'div' || this.current().type === 'mod') {
      const op = this.current().type;
      this.advance();
      const right = this.parseUnary(ctx);
      if (op === 'mul') left = multiply(left, right);
      else if (op === 'div') left = divide(left, right);
      else left = modulo(left, right);
    }
    return left;
  }

  private parseUnary(ctx: ScriptContext): unknown {
    if (this.current().type === 'not') {
      this.advance();
      return !toBoolean(this.parseUnary(ctx));
    }
    if (this.current().type === 'minus') {
      this.advance();
      const v = this.parseUnary(ctx);
      return -toNumber(v);
    }
    return this.parsePrimary(ctx);
  }

  private parsePrimary(ctx: ScriptContext): unknown {
    const t = this.current();
    if (t.type === 'number' || t.type === 'string' || t.type === 'bool' || t.type === 'null') {
      this.advance();
      return t.value;
    }
    if (t.type === 'ident') {
      this.advance();
      let value = this.resolveIdent(ctx, String(t.value));
      while (this.current().type === 'dot') {
        this.advance();
        const prop = this.consume('ident');
        value = this.resolveProperty(value, String(prop.value));
      }
      return value;
    }
    if (t.type === 'lparen') {
      this.advance();
      const v = this.parseExpression(ctx);
      this.consume('rparen');
      return v;
    }
    if (t.type === 'lbracket') {
      return this.parseArray(ctx);
    }
    throw new Error(`Unexpected token in expression: ${t.type}`);
  }

  private parseArray(ctx: ScriptContext): Array<Record<string, unknown> | string> {
    this.consume('lbracket');
    const arr: Array<Record<string, unknown> | string> = [];
    if (this.current().type !== 'rbracket') {
      arr.push(this.parseArrayItem(ctx));
      while (this.current().type === 'comma') {
        this.advance();
        arr.push(this.parseArrayItem(ctx));
      }
    }
    this.consume('rbracket');
    return arr;
  }

  private parseArrayItem(ctx: ScriptContext): Record<string, unknown> | string {
    if (this.current().type === 'lbrace') {
      this.consume('lbrace');
      const obj: Record<string, unknown> = {};
      if (this.current().type !== 'rbrace') {
        const key = this.consume('ident');
        this.consume('colon');
        obj[String(key.value)] = this.parseExpression(ctx);
        while (this.current().type === 'comma') {
          this.advance();
          const k = this.consume('ident');
          this.consume('colon');
          obj[String(k.value)] = this.parseExpression(ctx);
        }
      }
      this.consume('rbrace');
      return obj;
    }
    const v = this.parseExpression(ctx);
    return String(v);
  }

  private parseCallOrAssign(ctx: ScriptContext, left: unknown): unknown {
    if (this.current().type === 'lparen') {
      this.advance();
      const args: unknown[] = [];
      if (this.current().type !== 'rparen') {
        args.push(this.parseExpression(ctx));
        while (this.current().type === 'comma') {
          this.advance();
          args.push(this.parseExpression(ctx));
        }
      }
      this.consume('rparen');
      if (typeof left === 'function') {
        return (left as (...args: unknown[]) => unknown)(...args);
      }
      throw new Error('Value is not a function');
    }
    if (this.current().type === 'assign') {
      this.advance();
      const value = this.parseExpression(ctx);
      if (left && typeof left === 'object' && 'set' in left) {
        (left as { set: (v: unknown) => void }).set(value);
        return value;
      }
      throw new Error('Invalid assignment target');
    }
    return left;
  }

  private resolveIdent(ctx: ScriptContext, name: string): unknown {
    if (name === 'values') {
      return new ValuesProxy(ctx.values);
    }
    if (name === 'form') {
      return ctx.form;
    }
    if (name === 'console') {
      return ctx.console;
    }
    throw new Error(`Unknown identifier: ${name}`);
  }

  private resolveProperty(obj: unknown, prop: string): unknown {
    if (obj instanceof ValuesProxy) {
      return new ValueSetter(obj.values, prop);
    }
    if (obj && typeof obj === 'object' && prop in obj) {
      const value = (obj as Record<string, unknown>)[prop];
      return typeof value === 'function' ? value.bind(obj) : value;
    }
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[prop];
    }
    return undefined;
  }

  private current(): Token {
    return this.tokens[this.pos] ?? { type: 'eof', value: '' };
  }

  private advance(): Token {
    const t = this.current();
    if (t.type !== 'eof') this.pos++;
    return t;
  }

  private consume(expected: TokenType): Token {
    const t = this.current();
    if (t.type !== expected) {
      throw new Error(`Expected ${expected}, got ${t.type}`);
    }
    return this.advance();
  }
}

class ValuesProxy {
  constructor(public readonly values: Record<string, unknown>) {}
  get(key: string): unknown {
    return this.values[key];
  }
  set(key: string, value: unknown): void {
    this.values[key] = value;
  }
}

class ValueSetter {
  constructor(private readonly values: Record<string, unknown>, private readonly key: string) {}
  set(v: unknown): void {
    this.values[this.key] = v;
  }
}

function tokenize(script: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = script;

  const keywords: Record<string, TokenType> = {
    if: 'if',
    else: 'else',
    true: 'bool',
    false: 'bool',
    null: 'null',
  };

  while (i < s.length) {
    const c = s[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      i++;
      let str = '';
      while (i < s.length && s[i] !== quote) {
        if (s[i] === '\\' && i + 1 < s.length) {
          i++;
          str += s[i];
        } else {
          str += s[i];
        }
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: str });
      continue;
    }

    if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1]))) {
      let num = '';
      while (i < s.length && (/\d/.test(s[i]) || s[i] === '.')) {
        num += s[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      let ident = '';
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        ident += s[i];
        i++;
      }
      const type = keywords[ident] || 'ident';
      const value = type === 'bool' ? ident === 'true' : type === 'null' ? null : ident;
      tokens.push({ type, value });
      continue;
    }

    const two = s.slice(i, i + 2);
    const twoMap: Record<string, TokenType> = {
      '==': 'eq',
      '!=': 'ne',
      '<=': 'lte',
      '>=': 'gte',
      '&&': 'and',
      '||': 'or',
    };
    if (twoMap[two]) {
      tokens.push({ type: twoMap[two], value: two });
      i += 2;
      continue;
    }

    const oneMap: Record<string, TokenType> = {
      '(': 'lparen',
      ')': 'rparen',
      '{': 'lbrace',
      '}': 'rbrace',
      '[': 'lbracket',
      ']': 'rbracket',
      ',': 'comma',
      '.': 'dot',
      ';': 'semi',
      '=': 'assign',
      '<': 'lt',
      '>': 'gt',
      '!': 'not',
      '+': 'plus',
      '-': 'minus',
      '*': 'mul',
      '/': 'div',
      '%': 'mod',
      ':': 'colon',
    };

    if (oneMap[c]) {
      tokens.push({ type: oneMap[c], value: c });
      i++;
      continue;
    }

    throw new Error(`Unknown character: ${c}`);
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

function toBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return v != null;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function add(a: unknown, b: unknown): unknown {
  if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
  return toNumber(a) + toNumber(b);
}

function subtract(a: unknown, b: unknown): number {
  return toNumber(a) - toNumber(b);
}

function multiply(a: unknown, b: unknown): number {
  return toNumber(a) * toNumber(b);
}

function divide(a: unknown, b: unknown): number {
  const n = toNumber(b);
  if (n === 0) throw new Error('Division by zero');
  return toNumber(a) / n;
}

function modulo(a: unknown, b: unknown): number {
  const n = toNumber(b);
  if (n === 0) throw new Error('Division by zero');
  return toNumber(a) % n;
}

function compare(left: unknown, op: string, right: unknown): boolean {
  switch (op) {
    case 'eq':
      return left === right;
    case 'ne':
      return left !== right;
    case 'lt':
      return toNumber(left) < toNumber(right);
    case 'gt':
      return toNumber(left) > toNumber(right);
    case 'lte':
      return toNumber(left) <= toNumber(right);
    case 'gte':
      return toNumber(left) >= toNumber(right);
    default:
      return false;
  }
}
