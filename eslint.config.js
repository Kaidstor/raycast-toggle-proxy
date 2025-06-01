import eslint from "@eslint/js";
import raycastConfig from "@raycast/eslint-config";

export default [
  eslint.configs.recommended,
  ...raycastConfig,
]; 