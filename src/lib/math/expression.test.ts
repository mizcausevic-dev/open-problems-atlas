import { describe, it, expect } from 'vitest';
import {
  parse,
  compute,
  compile,
  tokenise,
  knownNames,
  ParseError,
  EvalError_,
  CONSTANTS,
  type FunctionSpec,
} from './expression';

const ev = (src: string, vars?: Record<string, number>) => compute(src, { variables: vars });

describe('arithmetic and precedence', () => {
  it('evaluates the basics', () => {
    expect(ev('1 + 2')).toBe(3);
    expect(ev('7 - 3 - 2')).toBe(2); // left-associative
    expect(ev('2 * 3 + 4')).toBe(10);
    expect(ev('4 + 2 * 3')).toBe(10);
    expect(ev('(4 + 2) * 3')).toBe(18);
    expect(ev('10 / 4')).toBe(2.5);
  });

  it('makes ^ right-associative', () => {
    // 2^(3^2) = 2^9 = 512, not (2^3)^2 = 64.
    expect(ev('2^3^2')).toBe(512);
  });

  it('binds unary minus tighter than * but looser than ^', () => {
    expect(ev('-2^2')).toBe(-4); // -(2^2)
    expect(ev('(-2)^2')).toBe(4);
    expect(ev('-2 * 3')).toBe(-6);
    expect(ev('3 - -2')).toBe(5);
  });

  it('accepts ** as a synonym for ^', () => {
    expect(ev('2 ** 10')).toBe(1024);
  });

  it('handles decimals and scientific notation', () => {
    expect(ev('0.5 + .25')).toBe(0.75);
    expect(ev('1e3')).toBe(1000);
    expect(ev('1.5e-2')).toBeCloseTo(0.015, 12);
  });

  it('supports implicit multiplication where it is unambiguous', () => {
    expect(ev('2x', { x: 5 })).toBe(10);
    expect(ev('3(1 + 1)')).toBe(6);
    expect(ev('2 sin(0) + 1')).toBe(1);
    expect(ev('(1+1)(2+2)')).toBe(8);
  });

  it('does not split an identifier into implicit multiplication', () => {
    // "xy" is one unknown name, not x times y. Guessing here would silently
    // change the meaning of an expression.
    expect(() => ev('xy', { x: 2, y: 3 })).toThrow(EvalError_);
  });
});

describe('constants', () => {
  it('resolves the mathematical constants', () => {
    expect(ev('pi')).toBeCloseTo(Math.PI, 15);
    expect(ev('e')).toBeCloseTo(Math.E, 15);
    expect(ev('tau')).toBeCloseTo(2 * Math.PI, 15);
    expect(ev('gamma')).toBeCloseTo(0.5772156649015329, 15);
  });

  it('keeps the two documented name collisions unambiguous', () => {
    // phi is the golden ratio; Euler's totient is totient(n).
    expect(ev('phi')).toBeCloseTo((1 + Math.sqrt(5)) / 2, 15);
    expect(CONSTANTS.phi).not.toBe(Math.PI);
    // pi is the constant; the prime counting function is primeCount(x).
    expect(ev('pi')).toBeCloseTo(Math.PI, 15);
  });

  it('lets a variable shadow a constant deliberately', () => {
    expect(ev('e', { e: 10 })).toBe(10);
  });
});

describe('functions', () => {
  it('evaluates the standard library', () => {
    expect(ev('sqrt(16)')).toBe(4);
    expect(ev('abs(-3)')).toBe(3);
    expect(ev('max(1, 7, 3)')).toBe(7);
    expect(ev('min(1, 7, 3)')).toBe(1);
    expect(ev('gcd(12, 18)')).toBe(6);
    expect(ev('lcm(4, 6)')).toBe(12);
    expect(ev('log(8, 2)')).toBeCloseTo(3, 12);
    expect(ev('ln(e)')).toBeCloseTo(1, 12);
    expect(ev('floor(2.7)')).toBe(2);
  });

  it('makes mod always non-negative, unlike %', () => {
    expect(ev('mod(-1, 5)')).toBe(4);
    expect(ev('-1 % 5')).toBe(-1);
  });

  it('rejects the wrong number of arguments', () => {
    expect(() => ev('sqrt()')).toThrow(EvalError_);
    expect(() => ev('sqrt(1, 2)')).toThrow(EvalError_);
    expect(() => ev('gcd(4)')).toThrow(EvalError_);
  });

  it('tells you when a function name is used as a value', () => {
    expect(() => ev('sin + 1')).toThrow(/function/);
  });
});

describe('integer-domain functions refuse non-integers', () => {
  const totient: FunctionSpec = {
    arity: 1,
    integerDomain: true,
    fn: (n) => n!,
    help: 'test stub',
  };

  it('accepts integers', () => {
    expect(compute('totient(10)', { functions: { totient } })).toBe(10);
  });

  it('refuses a fractional argument rather than rounding it', () => {
    // Rounding would return a real value for a query the function is not
    // defined on, which is a quieter kind of wrong.
    expect(() => compute('totient(2.5)', { functions: { totient } })).toThrow(
      /only defined on integers/,
    );
  });

  it('refuses NaN and Infinity', () => {
    expect(() => compute('totient(1/0)', { functions: { totient } })).toThrow(EvalError_);
    expect(() => compute('totient(0/0)', { functions: { totient } })).toThrow(EvalError_);
  });
});

describe('numeric edge cases surface honestly', () => {
  it('yields Infinity for division by zero rather than throwing or clamping', () => {
    expect(ev('1/0')).toBe(Infinity);
    expect(ev('-1/0')).toBe(-Infinity);
  });

  it('yields NaN for genuine domain errors', () => {
    expect(Number.isNaN(ev('sqrt(-1)'))).toBe(true);
    expect(Number.isNaN(ev('ln(-1)'))).toBe(true);
    expect(Number.isNaN(ev('0/0'))).toBe(true);
  });

  it('propagates NaN through arithmetic', () => {
    expect(Number.isNaN(ev('sqrt(-1) + 1'))).toBe(true);
  });

  it('overflows to Infinity rather than wrapping', () => {
    expect(ev('10^400')).toBe(Infinity);
  });
});

describe('parse errors are precise', () => {
  const failsAt = (src: string, pos: number) => {
    try {
      parse(src);
    } catch (err) {
      expect(err, src).toBeInstanceOf(ParseError);
      expect((err as ParseError).position, `${src} position`).toBe(pos);
      return;
    }
    throw new Error(`${src} should not have parsed`);
  };

  it('reports the offset of the problem', () => {
    failsAt('2 +', 3);
    failsAt('(1 + 2', 6);
    failsAt('1 + * 2', 4);
    failsAt('2 $ 3', 2);
    failsAt('', 0);
  });

  it('rejects trailing junk instead of ignoring it', () => {
    failsAt('1 + 2)', 5);
  });

  it('rejects a bare decimal point', () => {
    failsAt('1 + .', 4);
  });

  it('produces a caret that lines up under the offending character', () => {
    try {
      parse('1 + * 2');
    } catch (err) {
      const e = err as ParseError;
      expect(e.pointer).toBe('    ^');
      expect(e.pointer.length - 1).toBe(e.position);
    }
  });

  it('refuses expressions nested beyond the depth cap', () => {
    expect(() => parse('('.repeat(200) + '1' + ')'.repeat(200))).toThrow(ParseError);
  });
});

describe('no code execution is possible', () => {
  it('treats JavaScript as unknown names or syntax errors, never as code', () => {
    const hostile = [
      'constructor',
      'globalThis',
      'process',
      'require("fs")',
      'this',
      '__proto__',
      'window',
      'alert(1)',
      'eval("1")',
    ];
    for (const src of hostile) {
      // Every one must fail. None may execute or return a value.
      expect(() => ev(src), src).toThrow();
    }
  });

  it('does not let a call reach a prototype method', () => {
    expect(() => ev('toString(1)')).toThrow(EvalError_);
    expect(() => ev('valueOf(1)')).toThrow(EvalError_);
    expect(() => ev('hasOwnProperty(1)')).toThrow(EvalError_);
  });

  it('does not resolve a prototype property as a constant', () => {
    expect(() => ev('constructor')).toThrow(EvalError_);
  });
});

describe('compile', () => {
  it('parses once and evaluates many times', () => {
    const f = compile('x^2 + 1');
    expect(f(0)).toBe(1);
    expect(f(3)).toBe(10);
    expect(f(-3)).toBe(10);
  });

  it('binds n to the same value as x, for integer-domain expressions', () => {
    const f = compile('n + 1');
    expect(f(41)).toBe(42);
  });

  it('throws at compile time for a malformed expression, not per sample', () => {
    expect(() => compile('x +')).toThrow(ParseError);
  });

  it('is fast enough to plot with', () => {
    const f = compile('sin(x) * exp(-x/10) + sqrt(abs(x))');
    const t0 = performance.now();
    for (let i = 0; i < 20_000; i++) f(i / 100);
    // 20k samples is far more than any plot needs; this must not be a bottleneck.
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('knownNames', () => {
  it('lists constants and functions for autocomplete', () => {
    const { constants, functions } = knownNames();
    expect(constants).toContain('pi');
    expect(constants).toContain('gamma');
    expect(functions.map((f) => f.name)).toContain('sqrt');
    expect(functions.every((f) => f.help.length > 0)).toBe(true);
  });

  it('includes injected functions', () => {
    const { functions } = knownNames({
      totient: { arity: 1, integerDomain: true, fn: (n) => n!, help: "Euler's totient" },
    });
    expect(functions.map((f) => f.name)).toContain('totient');
  });
});

describe('tokeniser', () => {
  it('records positions for every token', () => {
    const tokens = tokenise('1 + foo(2)');
    expect(tokens.map((t) => [t.type, t.value, t.pos])).toEqual([
      ['number', '1', 0],
      ['op', '+', 2],
      ['ident', 'foo', 4],
      ['lparen', '(', 7],
      ['number', '2', 8],
      ['rparen', ')', 9],
      ['eof', '', 10],
    ]);
  });

  it('treats square brackets as parentheses', () => {
    expect(ev('2 * [1 + 2]')).toBe(6);
  });
});
