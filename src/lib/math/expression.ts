/**
 * A small, safe mathematical expression parser and evaluator.
 *
 * No eval, no `new Function`. User input is tokenised, parsed to an AST by
 * precedence climbing, and walked by an interpreter that only knows about the
 * operators and functions listed below. Nothing a user types can reach the
 * JavaScript runtime.
 *
 * Two design rules carried over from the rest of the app:
 *
 *   1. Refuse rather than guess. A malformed expression produces a ParseError
 *      with a character offset and a message naming what was expected, not a
 *      best-effort interpretation. `2 +` is an error, not 2.
 *
 *   2. Surface numeric failure honestly. Division by zero, log of a negative,
 *      and overflow all propagate as Infinity or NaN and are reported as such by
 *      the caller. Nothing is silently clamped to a plottable value, because a
 *      clamped pole is a line the function does not have.
 *
 * Name collisions are resolved explicitly rather than by overloading, because
 * two of them are real and would otherwise be silent:
 *
 *   pi   is the constant 3.14159...   The prime counting function is primeCount(x).
 *   phi  is the golden ratio          Euler's totient is totient(n).
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(
    message: string,
    /** Zero-based character offset in the source expression. */
    readonly position: number,
    readonly source: string,
  ) {
    super(message);
    this.name = 'ParseError';
  }

  /** A caret line pointing at the offending character, for monospace display. */
  get pointer(): string {
    return `${' '.repeat(Math.max(0, this.position))}^`;
  }
}

export class EvalError_ extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalError';
  }
}

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATOR_CHARS = new Set(['+', '-', '*', '/', '^', '%']);

export function tokenise(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i]!;

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }

    if (c >= '0' && c <= '9') {
      const start = i;
      while (i < src.length && src[i]! >= '0' && src[i]! <= '9') i++;
      if (src[i] === '.') {
        i++;
        while (i < src.length && src[i]! >= '0' && src[i]! <= '9') i++;
      }
      // Scientific notation, but only when an exponent actually follows, so
      // "2e" is an error rather than silently becoming 2.
      if (src[i] === 'e' || src[i] === 'E') {
        const save = i;
        i++;
        if (src[i] === '+' || src[i] === '-') i++;
        if (src[i]! >= '0' && src[i]! <= '9') {
          while (i < src.length && src[i]! >= '0' && src[i]! <= '9') i++;
        } else {
          i = save;
        }
      }
      tokens.push({ type: 'number', value: src.slice(start, i), pos: start });
      continue;
    }

    if (c === '.') {
      const start = i;
      i++;
      if (!(src[i]! >= '0' && src[i]! <= '9')) {
        throw new ParseError('A decimal point must be followed by a digit.', start, src);
      }
      while (i < src.length && src[i]! >= '0' && src[i]! <= '9') i++;
      tokens.push({ type: 'number', value: src.slice(start, i), pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) i++;
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start });
      continue;
    }

    if (OPERATOR_CHARS.has(c)) {
      // ** as a synonym for ^, which people type out of habit.
      if (c === '*' && src[i + 1] === '*') {
        tokens.push({ type: 'op', value: '^', pos: i });
        i += 2;
        continue;
      }
      tokens.push({ type: 'op', value: c, pos: i });
      i++;
      continue;
    }

    if (c === '(' || c === '[') {
      tokens.push({ type: 'lparen', value: c, pos: i++ });
      continue;
    }
    if (c === ')' || c === ']') {
      tokens.push({ type: 'rparen', value: c, pos: i++ });
      continue;
    }
    if (c === ',') {
      tokens.push({ type: 'comma', value: c, pos: i++ });
      continue;
    }

    throw new ParseError(`Unexpected character ${JSON.stringify(c)}.`, i, src);
  }

  tokens.push({ type: 'eof', value: '', pos: src.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string; pos: number }
  | { kind: 'unary'; op: '-' | '+'; operand: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node; pos: number }
  | { kind: 'call'; name: string; args: Node[]; pos: number };

/** Left binding power. Higher binds tighter. */
const BINDING: Record<string, number> = { '+': 10, '-': 10, '*': 20, '/': 20, '%': 20, '^': 30 };

/** Depth cap: a pathological input like "((((((..." must not blow the JS stack. */
const MAX_DEPTH = 64;

export function parse(src: string): Node {
  const tokens = tokenise(src);
  let pos = 0;
  let depth = 0;

  const peek = () => tokens[pos]!;
  const next = () => tokens[pos++]!;

  function expect(type: TokenType, what: string): Token {
    const t = peek();
    if (t.type !== type) {
      throw new ParseError(
        `Expected ${what}${t.type === 'eof' ? ' but the expression ended' : `, found ${JSON.stringify(t.value)}`}.`,
        t.pos,
        src,
      );
    }
    return next();
  }

  function parseExpression(minPower: number): Node {
    if (++depth > MAX_DEPTH) {
      throw new ParseError('This expression is nested too deeply.', peek().pos, src);
    }

    let left = parsePrefix();

    for (;;) {
      const t = peek();

      // Implicit multiplication, but only where it is unambiguous: a value
      // followed by a name, a number, or an opening bracket. "2x", "3(x+1)",
      // "2 sin(x)". Never between two names, where "xy" is one identifier.
      if (t.type === 'number' || t.type === 'lparen' || t.type === 'ident') {
        if (20 < minPower) break;
        const right = parseExpression(21);
        left = { kind: 'binary', op: '*', left, right, pos: t.pos };
        continue;
      }

      if (t.type !== 'op') break;
      const power = BINDING[t.value];
      if (power === undefined || power < minPower) break;

      next();
      // ^ is right-associative: 2^3^2 is 2^(3^2) = 512, not (2^3)^2 = 64.
      const right = parseExpression(t.value === '^' ? power : power + 1);
      left = { kind: 'binary', op: t.value, left, right, pos: t.pos };
    }

    depth--;
    return left;
  }

  function parsePrefix(): Node {
    const t = next();

    if (t.type === 'number') {
      const value = Number(t.value);
      if (!Number.isFinite(value)) {
        throw new ParseError(`${JSON.stringify(t.value)} is not a finite number.`, t.pos, src);
      }
      return { kind: 'num', value };
    }

    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      // Binds tighter than * so -2^2 is -(2^2) = -4, matching convention.
      return { kind: 'unary', op: t.value as '-' | '+', operand: parseExpression(25) };
    }

    if (t.type === 'lparen') {
      const inner = parseExpression(0);
      expect('rparen', 'a closing bracket');
      return inner;
    }

    if (t.type === 'ident') {
      if (peek().type === 'lparen') {
        next();
        const args: Node[] = [];
        if (peek().type !== 'rparen') {
          for (;;) {
            args.push(parseExpression(0));
            if (peek().type === 'comma') {
              next();
              continue;
            }
            break;
          }
        }
        expect('rparen', 'a closing bracket');
        return { kind: 'call', name: t.value, args, pos: t.pos };
      }
      return { kind: 'var', name: t.value, pos: t.pos };
    }

    if (t.type === 'eof') {
      throw new ParseError('The expression is incomplete.', t.pos, src);
    }

    throw new ParseError(`Unexpected ${JSON.stringify(t.value)}.`, t.pos, src);
  }

  if (peek().type === 'eof') throw new ParseError('The expression is empty.', 0, src);

  const tree = parseExpression(0);
  const trailing = peek();
  if (trailing.type !== 'eof') {
    throw new ParseError(`Unexpected ${JSON.stringify(trailing.value)} after the expression.`, trailing.pos, src);
  }
  return tree;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: 2 * Math.PI,
  // Euler-Mascheroni. Distinct from `e`.
  gamma: 0.5772156649015329,
  // Golden ratio. NOT Euler's totient, which is totient(n).
  phi: (1 + Math.sqrt(5)) / 2,
  Infinity: Infinity,
};

export interface FunctionSpec {
  arity: number | [number, number];
  /** True when the argument must be a positive integer. */
  integerDomain?: boolean;
  fn: (...args: number[]) => number;
  help: string;
}

const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y) [x, y] = [y, x % y];
  return x;
};

export const BASE_FUNCTIONS: Record<string, FunctionSpec> = {
  sin: { arity: 1, fn: Math.sin, help: 'sine, radians' },
  cos: { arity: 1, fn: Math.cos, help: 'cosine, radians' },
  tan: { arity: 1, fn: Math.tan, help: 'tangent, radians' },
  asin: { arity: 1, fn: Math.asin, help: 'inverse sine' },
  acos: { arity: 1, fn: Math.acos, help: 'inverse cosine' },
  atan: { arity: 1, fn: Math.atan, help: 'inverse tangent' },
  sinh: { arity: 1, fn: Math.sinh, help: 'hyperbolic sine' },
  cosh: { arity: 1, fn: Math.cosh, help: 'hyperbolic cosine' },
  tanh: { arity: 1, fn: Math.tanh, help: 'hyperbolic tangent' },
  exp: { arity: 1, fn: Math.exp, help: 'e to the power of x' },
  ln: { arity: 1, fn: Math.log, help: 'natural logarithm' },
  log: { arity: [1, 2], fn: (x, b) => (b === undefined ? Math.log(x!) : Math.log(x!) / Math.log(b)), help: 'log(x) natural, or log(x, base)' },
  log2: { arity: 1, fn: Math.log2, help: 'base-2 logarithm' },
  log10: { arity: 1, fn: Math.log10, help: 'base-10 logarithm' },
  sqrt: { arity: 1, fn: Math.sqrt, help: 'square root' },
  cbrt: { arity: 1, fn: Math.cbrt, help: 'cube root' },
  abs: { arity: 1, fn: Math.abs, help: 'absolute value' },
  floor: { arity: 1, fn: Math.floor, help: 'round down' },
  ceil: { arity: 1, fn: Math.ceil, help: 'round up' },
  round: { arity: 1, fn: Math.round, help: 'round to nearest' },
  sign: { arity: 1, fn: Math.sign, help: 'sign: -1, 0 or 1' },
  min: { arity: [1, 8], fn: (...a) => Math.min(...a), help: 'smallest argument' },
  max: { arity: [1, 8], fn: (...a) => Math.max(...a), help: 'largest argument' },
  gcd: { arity: 2, fn: gcd, help: 'greatest common divisor' },
  lcm: { arity: 2, fn: (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a!, b!)), help: 'least common multiple' },
  mod: { arity: 2, fn: (a, b) => ((a! % b!) + b!) % b!, help: 'mod(a, b), always non-negative' },
};

export interface EvalContext {
  variables?: Record<string, number>;
  /** Merged over BASE_FUNCTIONS. Used to inject the arithmetic kernels. */
  functions?: Record<string, FunctionSpec>;
}

/** Steps allowed per evaluation, so a deep tree cannot hang the thread. */
const MAX_STEPS = 20_000;

export function evaluate(node: Node, ctx: EvalContext = {}): number {
  const functions = ctx.functions ? { ...BASE_FUNCTIONS, ...ctx.functions } : BASE_FUNCTIONS;
  const variables = ctx.variables ?? {};
  let steps = 0;

  function walk(n: Node): number {
    if (++steps > MAX_STEPS) throw new EvalError_('This expression took too many steps to evaluate.');

    switch (n.kind) {
      case 'num':
        return n.value;

      case 'var': {
        // Object.hasOwn, never `in`. The `in` operator walks the prototype
        // chain, so `constructor`, `toString`, `__proto__` and every other
        // Object.prototype member resolved as if the user had defined them —
        // `constructor` returned the Object constructor function where a number
        // was expected. Caught by the hostile-input tests, not by review.
        if (Object.hasOwn(variables, n.name)) return variables[n.name]!;
        if (Object.hasOwn(CONSTANTS, n.name)) return CONSTANTS[n.name]!;
        if (Object.hasOwn(functions, n.name)) {
          throw new EvalError_(`${n.name} is a function; write ${n.name}(...) with an argument.`);
        }
        throw new EvalError_(`Unknown name ${JSON.stringify(n.name)}.`);
      }

      case 'unary': {
        const v = walk(n.operand);
        return n.op === '-' ? -v : v;
      }

      case 'binary': {
        const a = walk(n.left);
        const b = walk(n.right);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          // Division by zero yields Infinity, which the caller reports as a pole
          // rather than plotting through.
          case '/': return a / b;
          case '%': return a % b;
          case '^': return a ** b;
          default: throw new EvalError_(`Unknown operator ${n.op}.`);
        }
      }

      case 'call': {
        // Same prototype-chain hazard as above: functions['toString'] would
        // otherwise resolve to Object.prototype.toString and then fail deep
        // inside with an unhelpful TypeError.
        const spec = Object.hasOwn(functions, n.name) ? functions[n.name] : undefined;
        if (!spec) throw new EvalError_(`Unknown function ${JSON.stringify(n.name)}.`);

        const [lo, hi] = Array.isArray(spec.arity) ? spec.arity : [spec.arity, spec.arity];
        if (n.args.length < lo || n.args.length > hi) {
          const want = lo === hi ? `${lo}` : `${lo} to ${hi}`;
          throw new EvalError_(
            `${n.name} takes ${want} argument${hi === 1 ? '' : 's'}, got ${n.args.length}.`,
          );
        }

        const args = n.args.map(walk);

        if (spec.integerDomain) {
          for (const a of args) {
            if (!Number.isFinite(a) || !Number.isInteger(a)) {
              // Rounding here would return a real value for a query the function
              // is not defined on, which is worse than refusing.
              throw new EvalError_(
                `${n.name} is only defined on integers; got ${Number.isFinite(a) ? a : String(a)}.`,
              );
            }
          }
        }

        return spec.fn(...args);
      }
    }
  }

  return walk(node);
}

/** Parse and evaluate in one step. Throws ParseError or EvalError. */
export function compute(src: string, ctx: EvalContext = {}): number {
  return evaluate(parse(src), ctx);
}

/**
 * Compile once, evaluate many. Plotting calls this hundreds of times per frame,
 * and re-parsing per sample would dominate the cost.
 */
export function compile(src: string, ctx: EvalContext = {}): (x: number) => number {
  const tree = parse(src);
  const base = ctx.variables ?? {};
  return (x: number) => evaluate(tree, { ...ctx, variables: { ...base, x, n: x } });
}

/** Every name the evaluator will accept, for autocomplete and help. */
export function knownNames(extra?: Record<string, FunctionSpec>): {
  constants: string[];
  functions: { name: string; help: string }[];
} {
  const functions = { ...BASE_FUNCTIONS, ...extra };
  return {
    constants: Object.keys(CONSTANTS).sort(),
    functions: Object.entries(functions)
      .map(([name, spec]) => ({ name, help: spec.help }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
