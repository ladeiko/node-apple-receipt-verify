import mocha from "eslint-plugin-mocha";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [...compat.extends("eslint:recommended"), {
    plugins: {
        mocha,
    },

    languageOptions: {
        globals: {
            ...Object.fromEntries(Object.entries(globals.browser).map(([key]) => [key, "off"])),
            ...globals.commonjs,
            Atomics: "readonly",
            SharedArrayBuffer: "readonly",
            process: "readonly",
            console: "readonly",
            __dirname: "readonly",
            it: "readonly",
            describe: "readonly",
            beforeEach: "readonly",
            afterEach: "readonly",
            before: "readonly",
            after: "readonly",
        },

        ecmaVersion: 2018,
        sourceType: "script",
    },

    rules: {
        "no-console": "off",
        "mocha/no-exclusive-tests": "error",
    },
}];