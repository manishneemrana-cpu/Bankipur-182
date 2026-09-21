import nextPlugin from "eslint-config-next";

const eslintConfig = [
  ...nextPlugin,
  { ignores: ["node_modules/**", ".next/**", "dist/**"] },
];

export default eslintConfig;
