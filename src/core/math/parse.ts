// מפענח ביטויים מתמטיים (LaTeX כפי ש-MathLive מייצר, או כתיב פשוט כמו x^2-3x+2)
// לעץ חישוב, ואז לפונקציה שמחשבת ערכים.
// בטוח: לא משתמשים ב-eval / new Function – הפונקציה נבנית מאבני בניין קבועות.

export type Node =
  | { k: 'num'; v: number }
  | { k: 'x' }
  | { k: 'neg'; a: Node }
  | { k: 'add' | 'sub' | 'mul' | 'div' | 'pow'; a: Node; b: Node }
  | { k: 'fn'; name: FnName; a: Node }
  | { k: 'log'; base: Node; a: Node }
  | { k: 'root'; n: Node; a: Node };

export type FnName =
  | 'sin'
  | 'cos'
  | 'tan'
  | 'cot'
  | 'sec'
  | 'csc'
  | 'asin'
  | 'acos'
  | 'atan'
  | 'ln'
  | 'exp'
  | 'sqrt'
  | 'abs'
  | 'floor'
  | 'ceil';

export class MathParseError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
    this.name = 'MathParseError';
  }
}

// ---------- פירוק לאסימונים ----------

type Tok =
  | { t: 'num'; v: number; p: number; raw: string }
  | { t: 'x'; p: number }
  | { t: 'const'; v: number; p: number }
  | { t: 'fn'; name: FnName | 'log'; p: number }
  | { t: 'cmd'; name: 'frac' | 'sqrt'; p: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' | '_' | '!'; p: number }
  | { t: 'open' | 'close'; v: '(' | '{' | '[' | '|'; p: number }
  | { t: 'end'; p: number };

const FUNCTIONS: Record<string, FnName | 'log'> = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  tg: 'tan',
  cot: 'cot',
  ctg: 'cot',
  sec: 'sec',
  csc: 'csc',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  asin: 'asin',
  acos: 'acos',
  atan: 'atan',
  ln: 'ln',
  log: 'log',
  exp: 'exp',
  sqrt: 'sqrt',
  abs: 'abs',
  floor: 'floor',
  ceil: 'ceil',
};

/** פקודות שאין להן משמעות חישובית (רווחים, גדלי סוגריים) */
const IGNORED = new Set([
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'bigr',
  'Bigl',
  'Bigr',
  ',',
  ';',
  '!',
  ':',
  ' ',
  'quad',
  'qquad',
  'displaystyle',
  'mathrm',
  'operatorname',
]);

const MAX_LENGTH = 2000;

function tokenize(src: string): Tok[] {
  if (src.length > MAX_LENGTH) throw new MathParseError('too long', 0);
  const out: Tok[] = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const ch = s[i]!;
    const p = i;
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i))!;
      out.push({ t: 'num', v: Number(m[0]), p, raw: m[0] });
      i += m[0].length;
    } else if (ch === '\\') {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      if (!m) throw new MathParseError('bad command', p);
      const name = m[1]!;
      i += m[0].length;
      if (IGNORED.has(name)) continue;
      if (name === 'pi') out.push({ t: 'const', v: Math.PI, p });
      else if (name === 'exponentialE') out.push({ t: 'const', v: Math.E, p });
      else if (name === 'frac' || name === 'dfrac' || name === 'tfrac')
        out.push({ t: 'cmd', name: 'frac', p });
      else if (name === 'sqrt') out.push({ t: 'cmd', name: 'sqrt', p });
      else if (name === 'cdot' || name === 'times' || name === 'ast')
        out.push({ t: 'op', v: '*', p });
      else if (name === 'div') out.push({ t: 'op', v: '/', p });
      else if (
        name === 'vert' ||
        name === 'lvert' ||
        name === 'rvert' ||
        name === 'mid' ||
        name === '|'
      )
        out.push({ t: 'open', v: '|', p });
      else if (name === '{') out.push({ t: 'open', v: '(', p });
      else if (name === '}') out.push({ t: 'close', v: '(', p });
      else if (FUNCTIONS[name]) out.push({ t: 'fn', name: FUNCTIONS[name]!, p });
      else throw new MathParseError(`unknown \\${name}`, p);
    } else if (/[A-Za-z]/.test(ch)) {
      // שם פונקציה בכתיב פשוט (sin, sqrt...) או המשתנה x / הקבוע e
      const m = /^[A-Za-z]+/.exec(s.slice(i))!;
      let word = m[0];
      i += word.length;
      while (word.length > 0) {
        const fn = Object.keys(FUNCTIONS)
          .filter((f) => word.startsWith(f))
          .sort((a, b) => b.length - a.length)[0];
        if (fn) {
          out.push({ t: 'fn', name: FUNCTIONS[fn]!, p });
          word = word.slice(fn.length);
        } else if (word.startsWith('pi')) {
          out.push({ t: 'const', v: Math.PI, p });
          word = word.slice(2);
        } else if (word[0] === 'x') {
          out.push({ t: 'x', p });
          word = word.slice(1);
        } else if (word[0] === 'e') {
          out.push({ t: 'const', v: Math.E, p });
          word = word.slice(1);
        } else {
          throw new MathParseError(`unknown ${word}`, p);
        }
      }
    } else if ('+-*/^_!'.includes(ch)) {
      out.push({ t: 'op', v: ch as '+', p });
      i++;
    } else if (ch === '·' || ch === '×') {
      out.push({ t: 'op', v: '*', p });
      i++;
    } else if (ch === '÷') {
      out.push({ t: 'op', v: '/', p });
      i++;
    } else if (ch === '−') {
      out.push({ t: 'op', v: '-', p });
      i++;
    } else if ('({['.includes(ch)) {
      out.push({ t: 'open', v: ch === '{' ? '{' : ch === '[' ? '[' : '(', p });
      i++;
    } else if (')}]'.includes(ch)) {
      out.push({ t: 'close', v: ch === '}' ? '{' : ch === ']' ? '[' : '(', p });
      i++;
    } else if (ch === '|') {
      out.push({ t: 'open', v: '|', p });
      i++;
    } else if (ch === 'π') {
      out.push({ t: 'const', v: Math.PI, p });
      i++;
    } else {
      throw new MathParseError(`unexpected ${ch}`, p);
    }
  }
  out.push({ t: 'end', p: s.length });
  return out;
}

// ---------- ניתוח תחבירי ----------

class Parser {
  private i = 0;
  private absDepth = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok {
    return this.toks[this.i]!;
  }
  private next(): Tok {
    return this.toks[this.i++]!;
  }
  private fail(msg: string): never {
    throw new MathParseError(msg, this.peek().p);
  }

  parse(): Node {
    const n = this.sum();
    if (this.peek().t !== 'end') this.fail('unexpected token');
    return n;
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }

  private sum(): Node {
    let a = this.product();
    for (;;) {
      if (this.isOp('+')) {
        this.next();
        a = { k: 'add', a, b: this.product() };
      } else if (this.isOp('-')) {
        this.next();
        a = { k: 'sub', a, b: this.product() };
      } else return a;
    }
  }

  /** האם האסימון הבא יכול להתחיל גורם (לכפל מרומז: 2x, 3\sin x, (x+1)(x-1)) */
  private startsFactor(): boolean {
    const t = this.peek();
    if (t.t === 'num' || t.t === 'x' || t.t === 'const' || t.t === 'fn' || t.t === 'cmd')
      return true;
    if (t.t === 'open') return t.v !== '|' || this.absDepth === 0;
    return false;
  }

  private product(): Node {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.next();
        a = { k: 'mul', a, b: this.unary() };
      } else if (this.isOp('/')) {
        this.next();
        a = { k: 'div', a, b: this.unary() };
      } else if (this.startsFactor()) {
        a = { k: 'mul', a, b: this.power() };
      } else return a;
    }
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.next();
      return { k: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  private power(): Node {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.next();
      return { k: 'pow', a: base, b: this.exponent() };
    }
    return base;
  }

  /** מעריך: קבוצה בסוגריים מסולסלים, או גורם בודד (x^2, x^-1, e^{2x}) */
  private exponent(): Node {
    if (this.isOp('-')) {
      this.next();
      return { k: 'neg', a: this.exponent() };
    }
    // חזקה במעריך מתפרשת מימין לשמאל: 2^3^2 = 2^(3^2)
    return this.power();
  }

  private postfix(): Node {
    const n = this.primary();
    if (this.isOp('!')) this.fail('factorial not supported');
    return n;
  }

  private group(close: '(' | '{' | '[' | '|'): Node {
    if (close === '|') this.absDepth++;
    const n = this.sum();
    const t = this.next();
    if (close === '|') this.absDepth--;
    if (!(t.t === 'close' && t.v === close) && !(close === '|' && t.t === 'open' && t.v === '|')) {
      throw new MathParseError('missing closing bracket', t.p);
    }
    return n;
  }

  /** ארגומנט של פקודה: {…}, או תו בודד – כמו ב-TeX: \frac12 = ½ */
  private braced(): Node {
    const t = this.next();
    if (t.t === 'open' && t.v === '{') return this.group('{');
    if (t.t === 'num') {
      if (t.raw.length > 1 && /^\d/.test(t.raw)) {
        // רק הספרה הראשונה שייכת לארגומנט; השאר חוזר לרשימה
        const rest = t.raw.slice(1);
        this.toks.splice(this.i, 0, { t: 'num', v: Number(rest), p: t.p + 1, raw: rest });
        return { k: 'num', v: Number(t.raw[0]) };
      }
      return { k: 'num', v: t.v };
    }
    if (t.t === 'x') return { k: 'x' };
    throw new MathParseError('expected {', t.p);
  }

  private primary(): Node {
    const t = this.next();
    switch (t.t) {
      case 'num':
        return { k: 'num', v: t.v };
      case 'x':
        return { k: 'x' };
      case 'const':
        return { k: 'num', v: t.v };
      case 'open':
        return t.v === '|' ? { k: 'fn', name: 'abs', a: this.group('|') } : this.group(t.v);
      case 'cmd': {
        if (t.name === 'frac') {
          const a = this.braced();
          const b = this.braced();
          return { k: 'div', a, b };
        }
        // \sqrt[n]{a}
        let n: Node = { k: 'num', v: 2 };
        const pk = this.peek();
        if (pk.t === 'open' && pk.v === '[') {
          this.next();
          n = this.group('[');
        }
        const a = this.braced();
        return { k: 'root', n, a };
      }
      case 'fn':
        return this.func(t.name);
      default:
        throw new MathParseError('unexpected token', t.p);
    }
  }

  private func(name: FnName | 'log'): Node {
    // log_b, \log_{b}
    let base: Node | null = null;
    if (name === 'log' && this.isOp('_')) {
      this.next();
      base = this.braced();
    }
    // \sin^2 x = (\sin x)^2 ; \sin^{-1} x = arcsin x
    let power: Node | null = null;
    if (this.isOp('^')) {
      this.next();
      power = this.exponent();
    }
    let arg: Node;
    const pk = this.peek();
    if (pk.t === 'open' && pk.v !== '|') {
      this.next();
      arg = this.group(pk.v);
    } else {
      // בלי סוגריים: \sin 2x = sin(2x) – כל הגורמים הצמודים
      arg = this.power();
      while (this.startsFactor() && this.peek().t !== 'fn')
        arg = { k: 'mul', a: arg, b: this.power() };
    }
    let node: Node =
      name === 'log'
        ? { k: 'log', base: base ?? { k: 'num', v: 10 }, a: arg }
        : { k: 'fn', name, a: arg };
    if (power) {
      const isInverse = power.k === 'neg' && power.a.k === 'num' && power.a.v === 1;
      const inv: Partial<Record<FnName, FnName>> = { sin: 'asin', cos: 'acos', tan: 'atan' };
      if (isInverse && name !== 'log' && inv[name]) node = { k: 'fn', name: inv[name]!, a: arg };
      else node = { k: 'pow', a: node, b: power };
    }
    return node;
  }
}

/** מנקה "y =" או "f(x) =" בתחילת הביטוי */
function stripLhs(src: string): string {
  // y = …, f(x) = …, g(x) = …, וגם עם אינדקס: f_1(x) = …, f_{12}(x) = … (כמו ש-MathLive כותב)
  const m =
    /^\s*(?:y|[a-z](?:\s*_\s*(?:\{\s*[a-z0-9]+\s*\}|[a-z0-9]))?\s*(?:\\left)?\(\s*x\s*(?:\\right)?\))\s*=/i.exec(
      src,
    );
  return m ? src.slice(m[0].length) : src;
}

export function parseExpression(src: string): Node {
  const clean = stripLhs(src).trim();
  if (!clean) throw new MathParseError('empty', 0);
  return new Parser(tokenize(clean)).parse();
}

// ---------- הפיכה לפונקציה ----------

export type RealFn = (x: number) => number;

const FN_IMPL: Record<FnName, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (v) => 1 / Math.tan(v),
  sec: (v) => 1 / Math.cos(v),
  csc: (v) => 1 / Math.sin(v),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  exp: Math.exp,
  sqrt: Math.sqrt,
  abs: Math.abs,
  floor: Math.floor,
  ceil: Math.ceil,
};

/** חזקה עם שורש אי-זוגי של מספר שלילי (למשל x^{1/3}) */
function pow(a: number, b: number): number {
  const r = Math.pow(a, b);
  if (Number.isNaN(r) && a < 0) {
    const inv = 1 / b;
    if (Number.isInteger(inv) && Math.abs(inv) % 2 === 1) return -Math.pow(-a, b);
  }
  return r;
}

export function compile(n: Node): RealFn {
  switch (n.k) {
    case 'num': {
      const v = n.v;
      return () => v;
    }
    case 'x':
      return (x) => x;
    case 'neg': {
      const a = compile(n.a);
      return (x) => -a(x);
    }
    case 'add': {
      const a = compile(n.a);
      const b = compile(n.b);
      return (x) => a(x) + b(x);
    }
    case 'sub': {
      const a = compile(n.a);
      const b = compile(n.b);
      return (x) => a(x) - b(x);
    }
    case 'mul': {
      const a = compile(n.a);
      const b = compile(n.b);
      return (x) => a(x) * b(x);
    }
    case 'div': {
      const a = compile(n.a);
      const b = compile(n.b);
      return (x) => a(x) / b(x);
    }
    case 'pow': {
      const a = compile(n.a);
      const b = compile(n.b);
      return (x) => pow(a(x), b(x));
    }
    case 'fn': {
      const a = compile(n.a);
      const f = FN_IMPL[n.name];
      return (x) => f(a(x));
    }
    case 'log': {
      const a = compile(n.a);
      const b = compile(n.base);
      return (x) => Math.log(a(x)) / Math.log(b(x));
    }
    case 'root': {
      const a = compile(n.a);
      const r = compile(n.n);
      return (x) => pow(a(x), 1 / r(x));
    }
  }
}

/** מפענח ומחזיר פונקציה, או שגיאה מוסברת */
export function compileExpression(src: string): RealFn {
  return compile(parseExpression(src));
}
