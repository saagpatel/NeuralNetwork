import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
	...nextVitals,
	{
		rules: {
			"react-hooks/refs": "off",
			"react-hooks/set-state-in-effect": "off",
		},
	},
	globalIgnores([
		".next/**",
		"out/**",
		"build/**",
		"coverage/**",
		"node_modules/**",
		".turbo/**",
		".vercel/**",
		"next-env.d.ts",
	]),
]);
