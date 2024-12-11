/*-
 *
 * Hedera JSON RPC Relay
 *
 * Copyright (C) 2022-2024 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

module.exports = {
    "env": {
        "node": true,
        "es2021": true,
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    "plugins": [
        "simple-import-sort",
        "header",
    ],
    "overrides": [
        {
            "env": {
                "node": true,
            },
            "files": [
                ".eslintrc.{js,cjs}",
            ],
            "parserOptions": {
                "sourceType": "script",
            },
        },
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module",
    },
    "rules": {
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": "warn",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/ban-types": "warn",
        "no-trailing-spaces": "error",
        "no-useless-escape": "warn",
        "prefer-const": "error",
        "comma-dangle": ["error", {
            "arrays": "always-multiline",
            "objects": "always-multiline",
            "imports": "always-multiline",
            "exports": "always-multiline",
            "functions": "always-multiline",
        }],
        "simple-import-sort/imports": "error",
        "simple-import-sort/exports": "off",
        "header/header": [2, "block", [
            "-",
            " *",
            " * Hedera JSON RPC Relay",
            " *",
            {"pattern": "^\\s\\*\\sCopyright \\(C\\) 20(1[8-9]|[2-9]\\d)(?:-20(1[8-9]|[2-9]\\d))? Hedera Hashgraph, LLC$", "template": ` * Copyright (C) ${new Date().getFullYear()} Hedera Hashgraph, LLC`},
            " *",
            " * Licensed under the Apache License, Version 2.0 (the \"License\");",
            " * you may not use this file except in compliance with the License.",
            " * You may obtain a copy of the License at",
            " *",
            " *      http://www.apache.org/licenses/LICENSE-2.0",
            " *",
            " * Unless required by applicable law or agreed to in writing, software",
            " * distributed under the License is distributed on an \"AS IS\" BASIS,",
            " * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.",
            " * See the License for the specific language governing permissions and",
            " * limitations under the License.",
            " *",
            " ",
        ]],
    },
};
