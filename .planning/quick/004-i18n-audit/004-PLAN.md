---
phase: quick-004
plan: 004
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths:
    - "All user-facing text is identified and categorized"
    - "Compliance gaps are documented with specific file locations"
    - "Priority remediation list is created"
  artifacts:
    - path: ".planning/quick/004-i18n-audit/004-SUMMARY.md"
      provides: "Audit report with categorized findings"
      min_lines: 50
  key_links:
    - from: "frontend/**/*.tsx"
      to: "locales/en.json"
      via: "useTranslation hook"
      pattern: "useTranslation|{t\\("
    - from: "src/socialsim4/backend/**/*.py"
      to: "src/socialsim4/locales/en.json"
      via: "T() function"
      pattern: "from socialsim4.i18n import T"
---

<objective>
Audit the Social-Sim codebase for hardcoded user-facing text that violates i18n compliance.

Purpose: Identify all hardcoded strings that should use translation functions (t() for frontend, T() for backend) and produce a categorized remediation report.

Output: Audit report with findings grouped by severity and location.
</objective>

<execution_context>
@C:/Users/Justin/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Justin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

## Current i18n Infrastructure

**Frontend:**
- Uses `i18next` with `react-i18next`
- Translation files: `frontend/locales/en.json` (85KB), `frontend/locales/zh.json` (62KB)
- 51 files already import `useTranslation`
- Pattern: `const { t } = useTranslation();` then `{t('key')}`

**Backend:**
- Uses `src/socialsim4/i18n.py` module with `T()` function
- Translation files: `src/socialsim4/locales/en.json`, `src/socialsim4/locales/zh.json`
- 10 files already import `from socialsim4.i18n import T`
- Pattern: `T('key')` or `T('key', name=value)` for interpolation

**Known hardcoded text patterns to find:**
- JSX text content: `>Hardcoded Text<`
- Attribute strings: `title="..."`, `placeholder="..."`, `aria-label="..."`
- Option values with display text: `<option value="">Display Text</option>`
- Error messages: `return {"error": "message"}`
- Toast/notification strings

**Exclusions (do NOT flag):**
- Variable names, function names, code identifiers
- CSS class names
- URL paths
- API endpoint paths
- JSON keys (only values)
- Debug/logging strings (not user-facing)
- Comments
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scan frontend for hardcoded text</name>
  <files>.planning/quick/004-i18n-audit/004-frontend-findings.txt</files>
  <action>
    Search frontend TypeScript/TSX files for hardcoded user-facing text patterns:

    1. **JSX text content**: Use grep to find `>[A-Z][a-z]+` patterns in TSX files (text between tags starting with capital letter - likely UI text)

    2. **Attribute strings**: Find `title="`, `placeholder="`, `aria-label="` with literal strings (not `{t(...)}`)

    3. **Button/label text**: Find `<button.*>[^<{]` patterns (button text without translation)

    4. **Option text**: Find `<option.*>[^{<]` patterns (option display text without variables)

    For each finding, record:
    - File path and line number
    - The hardcoded string
    - Category (label, button, placeholder, error, etc.)

    Output a structured text file with findings grouped by category.
    Exclude files that are already fully compliant (check for useTranslation import and consistent t() usage).

    Use grep patterns:
    ```bash
    # JSX text content
    grep -rn --include="*.tsx" '>[A-Z][a-zA-Z ]*<' frontend/

    # Title attributes without t()
    grep -rn --include="*.tsx" 'title="[A-Z][^"]*"' frontend/ | grep -v 'title={t'

    # Placeholder without t()
    grep -rn --include="*.tsx" 'placeholder="[A-Z][^"]*"' frontend/ | grep -v 'placeholder={t'

    # Button text
    grep -rn --include="*.tsx" '<button[^>]*>[^<{]' frontend/
    ```
  </action>
  <verify>
    <automated>test -f .planning/quick/004-i18n-audit/004-frontend-findings.txt && wc -l .planning/quick/004-i18n-audit/004-frontend-findings.txt</automated>
  </verify>
  <done>Frontend findings file exists with categorized hardcoded text instances</done>
</task>

<task type="auto">
  <name>Task 2: Scan backend for hardcoded text</name>
  <files>.planning/quick/004-i18n-audit/004-backend-findings.txt</files>
  <action>
    Search backend Python files for hardcoded user-facing text patterns:

    1. **Error responses**: Find `{"error":` or `"error":` with literal string values (not T() calls)

    2. **Message responses**: Find `"message":` with literal strings

    3. **Exception messages**: Find `raise.*Exception.*["']` or `raise.*Error.*["']` with hardcoded strings

    4. **Return strings**: Find `return "..."` or `return '...'` patterns in route handlers

    For each finding, record:
    - File path and line number
    - The hardcoded string
    - Category (error, message, exception, etc.)

    Exclude:
    - Files in `src/socialsim4/core/` (not user-facing, internal simulation engine)
    - Test files
    - Debug/logging statements

    Use grep patterns:
    ```bash
    # Error responses
    grep -rn --include="*.py" '"error":\s*"[^"]*"' src/socialsim4/backend/ | grep -v 'T('

    # Message responses
    grep -rn --include="*.py" '"message":\s*"[^"]*"' src/socialsim4/backend/ | grep -v 'T('

    # Exception messages
    grep -rn --include="*.py" 'raise.*Exception\(["\']' src/socialsim4/backend/

    # Scenarios (check for hardcoded prompts)
    grep -rn --include="*.py" 'description.*=.*["\'][A-Z]' src/socialsim4/scenarios/ | head -20
    ```
  </action>
  <verify>
    <automated>test -f .planning/quick/004-i18n-audit/004-backend-findings.txt && wc -l .planning/quick/004-i18n-audit/004-backend-findings.txt</automated>
  </verify>
  <done>Backend findings file exists with categorized hardcoded text instances</done>
</task>

<task type="auto">
  <name>Task 3: Generate audit summary report</name>
  <files>.planning/quick/004-i18n-audit/004-SUMMARY.md</files>
  <action>
    Create a comprehensive audit summary that consolidates findings from Task 1 and Task 2:

    **Report structure:**

    ```markdown
    # i18n Compliance Audit Report

    ## Summary
    - Total files scanned: X frontend, Y backend
    - Files with violations: N
    - Total hardcoded strings found: M
    - Files already compliant: (list)

    ## Findings by Severity

    ### High Priority (User-facing UI text)
    - [ ] file.tsx:123 - "Hardcoded Text" (category)
    - ...

    ### Medium Priority (Error messages, notifications)
    - [ ] route.py:45 - "Error message" (category)
    - ...

    ### Low Priority (Edge cases, rarely seen)
    - ...

    ## Files Requiring Attention
    | File | Issues | Priority |
    |------|--------|----------|
    | Component.tsx | 5 | High |
    | route.py | 2 | Medium |

    ## Remediation Steps
    1. For frontend: Add key to locales/en.json and locales/zh.json
    2. Replace hardcoded text with {t('key')}
    3. For backend: Add key to src/socialsim4/locales/en.json and zh.json
    4. Replace hardcoded string with T('key')

    ## Positive Findings
    - 51 frontend files already use useTranslation
    - 10 backend files already use T()
    - Translation files are well-structured with 185+ keys
    ```

    Count statistics and prioritize based on:
    - High: User-facing labels, buttons, errors (blocks user understanding)
    - Medium: Placeholders, tooltips, notifications
    - Low: Rare edge cases, developer-oriented messages
  </action>
  <verify>
    <automated>test -f .planning/quick/004-i18n-audit/004-SUMMARY.md && grep -q "## Summary" .planning/quick/004-i18n-audit/004-SUMMARY.md</automated>
  </verify>
  <done>Summary report exists with statistics, prioritized findings, and remediation guidance</done>
</task>

</tasks>

<verification>
- All frontend TSX files scanned for hardcoded text patterns
- All backend Python files (API routes, scenarios) scanned
- Findings categorized by type and severity
- Summary report generated with actionable remediation list
</verification>

<success_criteria>
- Frontend findings file contains at least 20 entries (expected based on grep preview)
- Backend findings file contains entries for API routes
- Summary report has clear priority categorization
- Each finding has file path, line number, and string content
- Remediation steps are clear and actionable
</success_criteria>

<output>
After completion, create `.planning/quick/004-i18n-audit/004-SUMMARY.md`
</output>
