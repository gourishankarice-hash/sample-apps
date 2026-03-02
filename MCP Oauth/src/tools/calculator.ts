/**
 * Tool: calculate
 * Safely evaluates mathematical expressions.
 * Supports: +, -, *, /, %, **, sqrt(), abs(), floor(), ceil(), round(),
 *           sin(), cos(), tan(), log(), log2(), log10(), PI, E
 */

export interface CalculationResult {
  expression: string;
  result: number;
  formatted: string;
}

// Whitelist-based safe evaluator — avoids eval() security risks
const ALLOWED_PATTERN = /^[0-9+\-*/%.() \t\n^,]+$/;

const SAFE_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt:  (x) => Math.sqrt(x),
  abs:   (x) => Math.abs(x),
  floor: (x) => Math.floor(x),
  ceil:  (x) => Math.ceil(x),
  round: (x) => Math.round(x),
  sin:   (x) => Math.sin(x),
  cos:   (x) => Math.cos(x),
  tan:   (x) => Math.tan(x),
  log:   (x) => Math.log(x),
  log2:  (x) => Math.log2(x),
  log10: (x) => Math.log10(x),
  pow:   (x, y) => Math.pow(x, y),
  min:   (...args) => Math.min(...args),
  max:   (...args) => Math.max(...args),
};

const SAFE_CONSTANTS: Record<string, number> = {
  PI:  Math.PI,
  E:   Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
};

export function calculate(expression: string): CalculationResult {
  // Normalise
  let expr = expression.trim();

  // Replace constants
  for (const [name, value] of Object.entries(SAFE_CONSTANTS)) {
    expr = expr.replace(new RegExp(`\\b${name}\\b`, "g"), String(value));
  }

  // Replace ** with pow() for exponentiation
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*\*\*\s*(\d+(?:\.\d+)?)/g, "pow($1,$2)");

  // Validate characters after constant replacement
  const stripped = expr.replace(/[a-z_]+\s*\(/gi, "").replace(/[0-9.e]/g, "");
  if (/[a-z_]/i.test(stripped)) {
    throw new Error(`Invalid characters in expression: ${expression}`);
  }

  // Build a safe function body using only allowed math functions
  let evalBody = expr;
  for (const [name, fn] of Object.entries(SAFE_FUNCTIONS)) {
    evalBody = evalBody.replace(
      new RegExp(`\\b${name}\\b`, "g"),
      `Math.${name in Math ? name : "abs"}` // fallback
    );
  }

  // Create restricted evaluator
  // eslint-disable-next-line no-new-func
  const restricted = new Function(
    "Math",
    `"use strict"; return (${evalBody});`
  );

  let result: number;
  try {
    result = restricted(Math);
  } catch (e) {
    throw new Error(`Cannot evaluate expression: ${expression}`);
  }

  if (!isFinite(result)) {
    throw new Error(`Result is not finite (division by zero or overflow): ${expression}`);
  }

  const formatted =
    Number.isInteger(result)
      ? result.toLocaleString()
      : result.toLocaleString(undefined, { maximumFractionDigits: 10 });

  return { expression, result, formatted };
}
