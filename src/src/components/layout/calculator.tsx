"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useLanguage } from "@/i18n";

const KEYS = [
  "7",
  "8",
  "9",
  "/",
  "4",
  "5",
  "6",
  "*",
  "1",
  "2",
  "3",
  "-",
  "0",
  ".",
  "=",
  "+",
];

/** Evaluates + - * / left to right with precedence, no eval(). */
function calculate(expression: string) {
  const tokens = expression.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g) ?? [];
  const values: number[] = [];
  const ops: string[] = [];
  const apply = () => {
    const b = values.pop() ?? 0;
    const a = values.pop() ?? 0;
    const op = ops.pop();
    values.push(
      op === "+"
        ? a + b
        : op === "-"
          ? a - b
          : op === "*"
            ? a * b
            : b === 0
              ? NaN
              : a / b,
    );
  };
  const rank = (op: string) => (op === "*" || op === "/" ? 2 : 1);
  for (const token of tokens) {
    if (/[+\-*/]/.test(token)) {
      while (ops.length && rank(ops[ops.length - 1]) >= rank(token)) apply();
      ops.push(token);
    } else values.push(Number(token));
  }
  while (ops.length) apply();
  const result = values[0] ?? 0;
  return Number.isFinite(result)
    ? String(Math.round(result * 1e6) / 1e6)
    : "Error";
}

export function Calculator({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { l } = useLanguage();
  const [value, setValue] = useState("");
  const press = (key: string) =>
    setValue((old) =>
      key === "=" ? calculate(old) : old === "Error" ? key : old + key,
    );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={l(["Calculator", "ម៉ាស៊ីនគិតលេខ"])}
      size="sm"
    >
      <div className="calculator">
        <output aria-live="polite">{value || "0"}</output>
        <div className="calculator-keys">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={/[=+\-*/]/.test(key) ? "op" : ""}
              onClick={() => press(key)}
            >
              {key === "*" ? "×" : key === "/" ? "÷" : key}
            </button>
          ))}
          <button type="button" className="clear" onClick={() => setValue("")}>
            C
          </button>
          <button
            type="button"
            onClick={() => setValue((old) => old.slice(0, -1))}
          >
            ⌫
          </button>
        </div>
      </div>
    </Modal>
  );
}
