import type { Question } from "./types";

/** Fisher-Yates shuffle of 0..n-1. */
function permutation(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const isTrueFalse = (options: string[]) =>
  options.length === 2 && options[0].toLowerCase() === "true" && options[1].toLowerCase() === "false";

/**
 * Shuffles a choice question's options, because models tend to list the
 * correct answers first. Returns the new question and a map from old option
 * index to new one (for remapping saved answers). True/False keeps its order.
 */
export function shuffleOptions(q: Question): { question: Question; newIndex: number[] } {
  const n = q.options.length;
  const identity = Array.from({ length: n }, (_, i) => i);
  if ((q.type !== "mcq" && q.type !== "single") || n < 2 || isTrueFalse(q.options)) {
    return { question: q, newIndex: identity };
  }
  const order = permutation(n); // order[new] = old
  const newIndex = identity.slice();
  order.forEach((oldIdx, newIdx) => (newIndex[oldIdx] = newIdx));
  return {
    question: {
      ...q,
      options: order.map((i) => q.options[i]),
      correctOptions: q.correctOptions.map((i) => newIndex[i]).sort((a, b) => a - b),
    },
    newIndex,
  };
}
