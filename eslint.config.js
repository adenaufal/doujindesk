import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// ---------------------------------------------------------------------------
// Design-token gate. Success criterion 5: every colour traces to a token in
// src/index.css. This is one no-restricted-syntax rule rather than a plugin
// dependency — it costs nothing and catches the only violation that matters.
// ---------------------------------------------------------------------------

const PALETTE =
  '(bg|text|border|ring|from|to|via|fill|stroke|divide)-(gray|slate|zinc|neutral|stone|blue|indigo|purple|violet|green|emerald|teal|cyan|sky|red|rose|pink|fuchsia|orange|amber|yellow|lime)-[0-9]+'

const TOKEN_MESSAGE =
  'Raw Tailwind palette colour. Use a design token instead — the class-by-class ' +
  'migration table is the comment at the top of src/index.css ' +
  '(gray-* -> muted-foreground/border/muted, blue-600 -> primary, green-* -> success, ' +
  'amber/yellow-* -> warning, red-* -> destructive, genre badges -> chart-3/4/5).'

const GRADIENT_MESSAGE =
  'No gradient backgrounds. bg-gradient-to-* reads as AI-generated and has no ' +
  'token equivalent — use a flat token surface (bg-card, bg-muted, bg-primary/10).'

const HEX_MESSAGE =
  'Raw hex colour in a component. Every colour must come from a token in ' +
  'src/index.css via a Tailwind utility.'

const tokenGate = [
  'error',
  { selector: `Literal[value=/${PALETTE}/]`, message: TOKEN_MESSAGE },
  { selector: `TemplateElement[value.raw=/${PALETTE}/]`, message: TOKEN_MESSAGE },
  { selector: 'Literal[value=/bg-gradient-to-/]', message: GRADIENT_MESSAGE },
  { selector: 'TemplateElement[value.raw=/bg-gradient-to-/]', message: GRADIENT_MESSAGE },
  { selector: 'Literal[value=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]', message: HEX_MESSAGE },
  { selector: 'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b/]', message: HEX_MESSAGE },
]

// Files that already violate the gate, frozen so it is green today and only
// *new* violations fail. Each screen package deletes its own line here in the
// same commit that rewrites the file — the count after the path is what it
// inherits.
//
// ponytail: a config-level baseline instead of a `/* eslint-disable */` comment
// at the top of each of the 17 files. Same effect, but it keeps the debt in one
// visible list that can only shrink, and it let this package land without
// writing into files owned by Wave 5. Upgrade path if the list ever grows
// instead of shrinking: move to per-file disables so the debt is visible where
// the code is.
const TOKEN_GATE_BASELINE = [
  'src/components/Dashboard.tsx', //           79
  'src/components/QueueStatus.tsx', //         49
  'src/components/AnnouncementSystem.tsx', //  49
  'src/components/NotificationCenter.tsx', //  35
  'src/components/InteractiveMap.tsx', //      34
  'src/components/EventSchedule.tsx', //       31
  'src/components/EventGuide.tsx', //          28
  'src/components/AttendeeRegistration.tsx', // 27
  'src/components/BoothAllocation.tsx', //     25
  'src/components/CircleCatalog.tsx', //       20
  'src/components/StaffCoordination.tsx', //   15
  'src/components/FinancialManagement.tsx', // 14
  'src/components/CircleManagement.tsx', //    14
  'src/components/TicketingSystem.tsx', //      1
  'src/components/PaymentProcessor.tsx', //     1
]

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: { 'no-restricted-syntax': tokenGate },
  },
  {
    files: TOKEN_GATE_BASELINE,
    rules: { 'no-restricted-syntax': 'off' },
  },
)
