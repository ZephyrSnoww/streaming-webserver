/**
 * @type {import("eslint").Linter.Config}
 */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
  ],
  env: { node: true },
  parserOptions: { project: ["./tsconfig.json"] },
};
