module.exports = {
    "env": {
        "browser": false,
        "commonjs": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly",
        "process": "readonly",
        "console": "readonly",
        "__dirname": "readonly",
        "it": "readonly",
        "describe": "readonly",
        "beforeEach": "readonly",
        "afterEach": "readonly",
        "before": "readonly",
        "after": "readonly",
    },
    "parserOptions": {
        "ecmaVersion": 2018
    },
    "rules": {
        "no-console": "off",
        "mocha/no-exclusive-tests": "error"
    },
    "plugins": [
        "mocha"
    ],
};