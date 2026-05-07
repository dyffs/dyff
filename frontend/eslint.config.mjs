// eslint.config.mjs
import pluginVue from 'eslint-plugin-vue'
import {
  defineConfigWithVueTs,
  vueTsConfigs
} from '@vue/eslint-config-typescript'
import stylisticTs from '@stylistic/eslint-plugin-ts'

export default defineConfigWithVueTs(
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.strictTypeChecked,
  stylisticTs.configs.all,
  {
    plugins: {
      '@stylistic/ts': stylisticTs
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',

      '@stylistic/ts/quotes': ['error', 'single'],
      '@stylistic/ts/object-curly-spacing': 'off',
      '@stylistic/ts/quote-props': 'off',
      '@stylistic/ts/indent': ['error', 2],
      '@stylistic/ts/semi': ['error', 'never'],
      '@stylistic/ts/comma-dangle': ['off'],
      '@stylistic/ts/object-property-newline': ['off'],
      '@stylistic/ts/member-delimiter-style': ['off'],
      '@stylistic/ts/lines-between-class-members': ['off'],
    }
  }
)