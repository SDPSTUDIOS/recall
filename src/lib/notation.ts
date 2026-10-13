/**
 * How Claude writes maths, shared by generation and grading so both produce
 * text that RichText renders. \( \) and \[ \] only: a dollar sign in study
 * material is far more often money than maths.
 */
export const MATH_RULE = `Write mathematical notation (variables, equations, units with powers, Greek letters) as LaTeX inside \\( ... \\) for inline maths or \\[ ... \\] for a displayed equation, in any text field. Never use $ as a maths delimiter; a dollar sign always means money.`;
