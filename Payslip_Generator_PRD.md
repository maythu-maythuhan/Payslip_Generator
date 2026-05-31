# 📄 PRD: Enterprise Payslip Generator Web App for HR

## 1. Product Overview

### 1.1 Product Name
**Enterprise Payslip Generator**

### 1.2 Purpose
Build a professional web app for HR to generate employee payslips in a standardized format identical to the current company payslip layout shown in `Payslip_May_2026.pdf`.

The app will:
- collect employee master data and monthly salary inputs
- calculate all earnings and deductions in the backend
- generate a pixel-accurate payslip preview
- export the payslip as PDF in the same visual structure as the current payslip
- support future tax and deduction rule changes through configurable admin settings rather than hardcoded logic

### 1.3 Business Goal
Replace manual payroll slip preparation with a fast, low-error, professional system that HR can use confidently without knowing tax formulas.

### 1.4 Users
- **Primary users:** HR payroll officers
- **Secondary users:** HR admin, People Operations lead
- **Future users:** Finance reviewer, payroll manager, auditors

---

## 2. Current Payslip Reference Format

The output must follow the visible structure of the current payslip format from `Payslip_May_2026.pdf`.

### 2.1 Required PDF Layout Structure
1. Header title:
   - `REMUNERATION STATEMENT FOR THE MONTH OF [MONTH YEAR]`
2. Employee detail block:
   - Employee Name
   - Employer Name
   - Employee No
   - Branch
   - Designation
   - Department
   - NRC
   - Join Date
   - Pay Period
   - Pay Year
   - SSB Card No
   - Bank AC Number
3. Earnings section:
   - Basic Salary
   - Transportation Allowance
   - Phone Allowance (Air Charges)
   - Total
4. Deductions section:
   - NET PIT
   - SSB EMPLOYEE
   - Total
5. Footer summary:
   - Net Pay
   - Salary - Original
6. Footer note:
   - `Powered by Automation`

### 2.2 Formatting Requirements
- right-align all numeric amounts
- always show 2 decimal places
- use comma thousand separators, e.g. `1,500,000.00`
- bold key totals
- preserve label ordering
- preserve white-space rhythm similar to existing payslip
- printable on A4 portrait PDF
- use clean enterprise typography to visually match the current payslip as closely as possible

---

## 3. Scope

### 3.1 In Scope
- employee data entry and editing
- one-time global transport allowance setting
- configurable deduction engine in backend
- payslip preview screen
- PDF export matching current format
- admin settings for tax rules and deduction rules
- audit-friendly calculation breakdown stored invisibly in backend
- effective-date versioning of payroll rules

### 3.2 Out of Scope for Initial Version
- direct bank transfer file generation
- full payroll ledger integration
- ESS employee self-service portal
- leave, overtime, bonus, incentive modules
- e-signature workflow
- MyHR integration

---

## 4. Core Product Principles

- **No manual math by HR**
- **Backend-driven calculations only**
- **Global settings for common values**
- **Configurable tax engine for future change**
- **Professional enterprise UI**
- **Fast repeated use for HR**
- **Export identical-looking PDF every time**
- **Audit trace for every deduction**

---

## 5. Functional Requirements

## 5.1 Global Settings Module

HR must be able to set standard values once and apply them automatically.

### Required Global Settings
- Transportation Allowance
- Employer Name
- Default Branch
- Default Department options
- Default Designation options
- Current tax year label format, e.g. `2026-2027`
- PDF footer text

### Required Behavior
- transportation allowance is entered once by an authorized user
- system stores it centrally
- every new payslip uses that value automatically
- regular HR users should see it as read-only during payslip generation
- admin users can update it
- every change must be versioned with:
  - changed by
  - changed at
  - effective from month

---

## 5.2 Employee Master Data Module

### Fields
- Employee Name
- Employee No
- Employer Name
- Branch
- Designation
- Department
- NRC
- Join Date
- SSB Card No
- Bank Account Number

### Requirements
- save employee profiles for reuse
- search existing employee by name or employee number
- allow edit of employee master data
- keep change history

---

## 5.3 Monthly Payslip Input Module

### HR Inputs Per Employee Per Month
- Pay Month
- Pay Year Label
- Basic Salary
- Phone Allowance

### System Auto-Fills
- Transportation Allowance from global settings
- Employee details from employee profile
- Employer name from global settings unless overridden

### Buttons
- `Generate Payslip`
- `Preview`
- `Download PDF`
- `Reset`
- `Save Draft`

---

## 5.4 Calculation Engine

### Important Rule
Users must **never** type tax or deduction results manually.
All calculations must happen in backend.

### Earnings Formula
```text
Total Earnings = Basic Salary + Transportation Allowance + Phone Allowance
```

### Current Deduction Components
1. NET PIT
2. SSB EMPLOYEE

### Current Net Pay Formula
```text
Net Pay = Total Earnings - Total Deductions
```

---

## 6. Myanmar PIT and SSB Logic

This section must be implemented as a configurable rules engine, not as one-off hardcoded numbers.

## 6.1 Why Configurable Rules Are Required
Tax and payroll rules can change in the future. The app must support:
- updated PIT brackets
- updated relief percentages
- updated relief caps
- updated SSB rates
- updated SSB wage caps
- future inclusion or exclusion of allowance types
- effective-date changes by tax year

Therefore, the app should store payroll rules in configuration tables.

---

## 6.2 Recommended Enterprise Design for Rules Engine

### A. Payroll Rule Set Table
Each rule set must be versioned.

Suggested fields:
- `rule_set_id`
- `rule_set_name`
- `country`
- `effective_from`
- `effective_to`
- `status` (Draft / Active / Retired)
- `currency`
- `description`
- `created_by`
- `created_at`
- `approved_by`
- `approved_at`

### B. PIT Bracket Table
Suggested fields:
- `pit_bracket_id`
- `rule_set_id`
- `sequence_no`
- `lower_bound`
- `upper_bound` (nullable for final tier)
- `tax_rate`

### C. Relief Rules Table
Suggested fields:
- `relief_rule_id`
- `rule_set_id`
- `relief_name`
- `relief_type` (`percentage`, `fixed`, `dependent_count_based`)
- `relief_value`
- `annual_cap`
- `is_active`

### D. SSB Rules Table
Suggested fields:
- `ssb_rule_id`
- `rule_set_id`
- `employee_rate`
- `employer_rate`
- `monthly_wage_cap`
- `max_employee_contribution`
- `max_employer_contribution`
- `is_active`

### E. Earning Component Taxability Table
Suggested fields:
- `component_id`
- `rule_set_id`
- `component_name`
- `is_taxable_for_pit`
- `is_included_in_ssb_base`
- `display_order`
- `is_active`

This is important because future payroll policy may change whether transportation or phone allowance is taxable, and HR should not need source-code changes for that.

---

## 6.3 Current Rule Assumptions to Implement in Version 1

### A. Taxable Earning Components
For Version 1, the backend should treat the following as PIT-taxable:
- Basic Salary
- Transportation Allowance
- Phone Allowance

### B. Current SSB Logic
For Version 1:
```text
Employee SSB = MIN(SSB Eligible Wage Base, Monthly SSB Wage Cap) * Employee SSB Rate
```

Recommended default active configuration:
- employee SSB rate = 2%
- employer SSB rate = 3%
- monthly SSB wage cap = 300,000
- max employee SSB = 6,000
- max employer SSB = 9,000

### C. Current PIT Logic
Use annualized taxable income calculation by default for Version 1, but architect the engine so it can support cumulative YTD logic later if payroll policy requires it.

#### Step 1: Monthly Gross Taxable Earnings
```text
Monthly Gross Taxable Earnings = Sum of all earning components marked as PIT-taxable
```

For Version 1:
```text
Monthly Gross Taxable Earnings = Basic Salary + Transportation Allowance + Phone Allowance
```

#### Step 2: Annual Gross Taxable Earnings
```text
Annual Gross Taxable Earnings = Monthly Gross Taxable Earnings * 12
```

#### Step 3: Basic Personal Relief
```text
Basic Personal Relief = MIN(Annual Gross Taxable Earnings * 20%, 10,000,000)
```

#### Step 4: Annual Employee SSB Deduction
```text
Annual Employee SSB Deduction = Monthly Employee SSB * 12
```

#### Step 5: Annual Taxable Income
```text
Annual Taxable Income = Annual Gross Taxable Earnings - Basic Personal Relief - Annual Employee SSB Deduction - Other Active Reliefs
```

#### Step 6: PIT Brackets for Current Rule Set
Use the following annual PIT brackets in the active rule set:

| Tier | Annual Taxable Income Range | Rate |
|---|---:|---:|
| 1 | 0 to 2,000,000 | 0% |
| 2 | 2,000,001 to 10,000,000 | 5% |
| 3 | 10,000,001 to 30,000,000 | 10% |
| 4 | 30,000,001 to 50,000,000 | 15% |
| 5 | 50,000,001 to 70,000,000 | 20% |
| 6 | Above 70,000,000 | 25% |

#### Step 7: Annual PIT
Progressively calculate annual tax by bracket.

Pseudo-logic:
```text
Annual PIT = Sum of tax calculated for each bracket portion of Annual Taxable Income
```

#### Step 8: Monthly PIT
```text
Monthly PIT = Annual PIT / 12
```

#### Step 9: Final Monthly Deductions
```text
Total Deductions = Monthly PIT + Monthly Employee SSB
```

#### Step 10: Net Pay
```text
Net Pay = Total Earnings - Total Deductions
```

---

## 6.4 Enterprise-Ready Future Upgrade: Cumulative YTD Mode

The rules engine should support a future switch to cumulative tax mode if payroll policy requires it.

### Optional Future Mode
```text
YTD Gross Taxable = Sum of taxable earnings from start of tax year to current month
YTD Relief = Calculated relief up to current month
YTD PIT = Progressive tax on YTD Taxable Income
Current Month PIT = YTD PIT - PIT Already Withheld Previously
```

### Recommended Design
Add a field in Rule Set Table:
- `pit_calculation_method`
  - `ANNUALIZED_MONTHLY`
  - `CUMULATIVE_YTD`

This lets the app switch formula behavior without code rewrite.

---

## 6.5 Sample Calculation Flow for Version 1

### Inputs
- Basic Salary = 1,361,000
- Transportation Allowance = 350,000
- Phone Allowance = 20,000


```text
Annual PIT =
0% on first 2,000,000 = 0
5% on next 8,000,000 = 400,000
10% on remaining 6,545,600 = 654,560
Total Annual PIT = 1,054,560
```

## 7. UX and UI Requirements

## 7.1 UX Principles
- very simple for HR
- minimal typing
- obvious call-to-action buttons
- easy to scan
- accessible for non-technical users
- professional enterprise presentation

## 7.2 Visual Style
- white and soft gray base
- clean cards
- rounded but not overly playful
- subtle shadows
- strong readable labels
- large inputs
- clear section headers
- mobile/tablet responsive, but optimized first for desktop

## 7.3 Main Screens

### Screen A: Dashboard
- quick actions
- recent payslips
- global settings shortcut
- employee search
- generate new payslip button

### Screen B: Global Settings
- transportation allowance
- active payroll rule set
- tax year label
- employer defaults
- PDF template settings

### Screen C: Employee Master Data
- create employee
- edit employee
- search employee

### Screen D: Payslip Generator
- step 1: select employee
- step 2: enter month and values
- step 3: preview calculations
- step 4: preview PDF
- step 5: export PDF

### Screen E: Admin Rules Screen
- manage PIT brackets
- manage relief values
- manage SSB values
- activate rule sets by effective date
- preview effect before publishing

---

## 8. Permissions and Roles

### Role 1: HR User
- create payslips
- edit monthly salary inputs
- view employee data
- export PDF
- cannot edit tax rules

### Role 2: HR Admin
- all HR User permissions
- manage transportation allowance
- manage employer defaults
- manage employee master data

### Role 3: Payroll Config Admin
- manage rule sets
- update PIT brackets
- update relief caps
- update SSB rates and caps
- publish future-effective rule versions

### Role 4: Auditor / Reviewer
- read-only access
- view calculation breakdown and history

---

## 9. Data Model Summary

### Employee
- employee_id
- employee_no
- name
- nrc
- join_date
- branch
- designation
- department
- ssb_card_no
- bank_account_no
- employer_name
- status

### Monthly Payslip Input
- payslip_id
- employee_id
- pay_month
- pay_year_label
- basic_salary
- transportation_allowance_applied
- phone_allowance
- active_rule_set_id
- status

### Calculation Snapshot
- calculation_id
- payslip_id
- total_earnings
- pit_amount
- employee_ssb
- total_deductions
- net_pay
- serialized_calculation_breakdown_json

### PDF Output
- pdf_id
- payslip_id
- file_path_or_blob_reference
- generated_at
- generated_by
- checksum

---

## 10. Validation Rules

- required fields must be completed
- basic salary must be numeric and >= 0
- phone allowance must be numeric and >= 0
- transportation allowance must come from active global setting
- join date cannot be future date unless explicitly allowed by admin
- employee number must be unique
- PDF export blocked if required inputs are missing
- if no active rule set exists for selected month, system must block generation and show clear admin error

---

## 11. PDF Rendering Requirements

### Must Have
- browser preview before export
- PDF export must not shift layout unexpectedly
- amounts aligned consistently
- employee info block must not wrap badly
- page size fixed to A4 portrait
- export file naming convention:
```text
Payslip_[EmployeeName]_[Month]_[Year].pdf
```

### Recommended Implementation
- HTML/CSS payslip template
- render hidden print template
- export using Puppeteer in backend or equivalent stable PDF generator

---

## 12. Non-Functional Requirements

### Performance
- generate payslip preview in < 2 seconds for single employee
- export PDF in < 5 seconds under normal load

### Security
- role-based access control
- audit logs for rule changes
- encrypted storage for sensitive employee fields
- secure session management

### Reliability
- calculation must be deterministic
- identical inputs + same rule set = identical output

### Maintainability
- no hardcoded PIT bracket values in UI code
- all rule changes via admin configuration tables

### Accessibility
- keyboard navigable forms
- contrast-compliant labels and buttons
- readable font sizes

---

## 13. Recommended Tech Stack

### Frontend
- Next.js or React
- Tailwind CSS for fast professional UI
- component library like shadcn/ui

### Backend
- Node.js or Python
- REST or GraphQL API

### Database
- PostgreSQL

### PDF
- Puppeteer or Playwright PDF rendering

### Auth
- enterprise SSO ready architecture preferred

---

## 14. Development Phases

## Phase 1: UX Foundation and Form Screens
### Goal
Build polished UI and navigation skeleton.

### Deliverables
- dashboard
- global settings screen
- employee master data form
- payslip input form
- responsive layout
- role-aware menu placeholders

### Acceptance Criteria
- HR can enter employee and salary inputs without confusion
- transport allowance can be saved globally
- UI already feels enterprise-grade

---

## Phase 2: Calculation Engine MVP
### Goal
Implement backend earnings and deduction engine.

### Deliverables
- rule set tables
- PIT bracket config
- relief config
- SSB config
- earnings and deductions API
- calculation preview card

### Acceptance Criteria
- system calculates total earnings, PIT, SSB, total deductions, net pay
- calculation uses active rule set
- transport allowance auto-applies globally

---

## Phase 3: Payslip Preview and Draft PDF
### Goal
Generate a structured payslip preview and downloadable PDF.

### Deliverables
- on-screen payslip preview
- first downloadable PDF version
- A4 output
- correct data placement

### Acceptance Criteria
- HR can preview and download a readable payslip
- no manual deduction edits allowed

---

## Phase 4: Pixel-Perfect Template Matching
### Goal
Refine the exported PDF to match current payslip format as closely as possible.

### Deliverables
- spacing refinement
- typography refinement
- alignment refinement
- footer and totals formatting
- real-sample comparison QA

### Acceptance Criteria
- exported PDF is visually near-identical to current payslip structure
- finance and HR approve the output format

---

## Phase 5: Enterprise Rule Management
### Goal
Make the app future-proof for rule changes.

### Deliverables
- admin rule set management
- effective-date activation
- bracket editing UI
- relief editing UI
- SSB editing UI
- audit trail for rule changes

### Acceptance Criteria
- future PIT or SSB changes can be updated without code changes
- historical payslips continue using old rule set versions correctly

---

## Phase 6: Operational Enhancements
### Goal
Improve processing speed and scale.

### Optional Deliverables
- employee import via Excel/CSV
- bulk payslip generation
- month-end batch export ZIP
- email dispatch integration
- approval workflow
- dashboard reporting

---

## 15. QA and Test Cases

### Core Test Cases
1. transportation allowance entered once applies to all users
2. payslip calculation changes if admin changes active rule set
3. historical payslip remains unchanged when future rule set is activated
4. employee SSB never exceeds configured max employee SSB
5. PIT calculation follows configured brackets
6. missing employee number blocks save
7. generated PDF matches preview values exactly
8. numeric formatting always shows commas and 2 decimals

---

## 16. Risks and Mitigations

### Risk: future payroll formula changes
**Mitigation:** rules engine with effective-date versioning

### Risk: HR confusion on editable vs calculated fields
**Mitigation:** make calculated fields visibly locked and labeled as system-calculated

### Risk: PDF layout inconsistency across environments
**Mitigation:** render PDFs server-side using stable rendering engine

### Risk: hardcoded logic becoming obsolete
**Mitigation:** no bracket values in frontend business logic

---

## 17. Suggested Nice-to-Have Ideas

- side-by-side preview: input form + payslip preview
- admin simulation mode to compare old vs new PIT rule impact
- “why is deduction this amount?” expandable backend explanation panel
- payslip duplicate detection for same employee and month
- payroll summary dashboard for HR lead

---

## 18. Final Success Criteria

The product is successful when:
- HR can generate a correct payslip in under 1 minute
- no one types PIT or SSB manually
- transportation allowance is maintained centrally and reused automatically
- PDF output matches the current payslip style closely
- PIT and SSB can be changed in future through admin settings, not source code changes
- the app feels polished, modern, and easy for HR to use daily

---

## 19. PIT Adjustment Layer

### 19.1 Purpose

Allow the payroll system to match actual company payroll outputs by applying configurable post-calculation adjustments to PIT, without modifying the base calculation engine or requiring source code changes.

### 19.2 Architecture Overview

PIT is calculated in two sequential stages:

**Stage 1 — PIT Base Calculation**
The existing annualized progressive bracket formula produces `PIT_BASE` as defined in Section 6.

**Stage 2 — PIT Adjustment Layer**
An optional rule-based adjustment is applied after PIT base:

```
PIT_FINAL = MAX(PIT_BASE − ADJUSTMENT, 0)
```

PIT_FINAL is always floored at zero. If no adjustment rule matches, `PIT_FINAL = PIT_BASE`.

---

### 19.3 Adjustment Types

| Type | Description | Formula |
|------|-------------|---------|
| FIXED | Subtract a fixed MMK amount | `ADJUSTMENT = value` |
| PERCENTAGE | Subtract a percentage of PIT Base | `ADJUSTMENT = PIT_BASE × (value / 100)` |
| TARGET | Force PIT to a specific target value | `ADJUSTMENT = PIT_BASE − target_value` |
| FORMULA | Custom expression evaluated dynamically | `ADJUSTMENT = eval(expression, context)` |

**FORMULA context variables available:**
- `pitBase` — monthly PIT base before adjustment
- `basicSalary` — employee basic salary
- `totalEarnings` — total monthly earnings
- `annualTaxableIncome` — annual taxable income used in bracket calculation

---

### 19.4 Database Table: `pit_adjustment_rules`

| Field | Type | Description |
|-------|------|-------------|
| rule_id | UUID | Primary key, system-generated |
| rule_name | string | Human-readable display name |
| rule_type | enum | `FIXED` / `PERCENTAGE` / `TARGET` / `FORMULA` |
| value | string | Numeric value or formula expression string |
| min_salary | decimal | Minimum basic salary for rule to apply (nullable = no minimum) |
| max_salary | decimal | Maximum basic salary for rule to apply (nullable = no maximum) |
| effective_from | YYYY-MM | Month rule becomes effective (inclusive) |
| effective_to | YYYY-MM | Month rule expires (inclusive, nullable = open-ended) |
| priority | integer | Higher number = selected first when multiple rules match |
| is_active | boolean | Master on/off toggle independent of effective dates |
| created_at | datetime | Immutable creation timestamp |
| updated_at | datetime | Updated on every change |

---

### 19.5 Rule Selection Logic

```
1. Filter rules where:
   - is_active = true
   - basic_salary >= min_salary (or min_salary is null)
   - basic_salary <= max_salary (or max_salary is null)
   - pay_period >= effective_from
   - pay_period <= effective_to (or effective_to is null)

2. If multiple rules match:
   - Sort by priority descending
   - Use the highest-priority rule

3. If no rule matches:
   - PIT_FINAL = PIT_BASE (no adjustment applied)
```

---

### 19.6 Calculation Pseudocode

```javascript
function calculateFinalPIT(input) {
  // Step 3: Calculate PIT base from existing bracket engine
  const pitBase = calculateBasePIT(input);

  // Step 4a: Select applicable rule
  const rule = getApplicableRule(input.basicSalary, input.payMonth, input.payYear);

  // Step 4b: Compute adjustment
  let adjustment = 0;
  switch (rule.type) {
    case 'FIXED':      adjustment = rule.value;                          break;
    case 'PERCENTAGE': adjustment = pitBase * (rule.value / 100);        break;
    case 'TARGET':     adjustment = pitBase - rule.value;                break;
    case 'FORMULA':    adjustment = evaluate(rule.value, { pitBase, ...input }); break;
  }

  // Step 4c: Apply floor
  const pitFinal = Math.max(pitBase - adjustment, 0);

  return {
    pit_base:           pitBase,
    adjustment_applied: adjustment,
    adjustment_type:    rule?.type || 'NONE',
    rule_used:          rule?.rule_name || '—',
    pit_final:          pitFinal,
  };
}
```

---

### 19.7 Audit Requirements

Every payslip calculation snapshot (Section 9) must store the full PIT audit trail:

| Field | Description |
|-------|-------------|
| `pit_base` | Monthly PIT before adjustment |
| `adjustment_applied` | Amount subtracted from PIT base |
| `adjustment_type` | Rule type used (NONE if no rule matched) |
| `rule_used` | Name of the rule applied |
| `pit_final` | Final NET PIT shown on payslip |

Historical payslips must never be recalculated. The audit snapshot is frozen at generation time.

---

### 19.8 UI Behavior by Role

| Role | PIT Visibility |
|------|---------------|
| HR User | Sees only `PIT_FINAL` labeled "NET PIT". No adjustment breakdown visible. |
| HR Admin | Can view adjustment breakdown in the payslip calculation audit details. |
| Payroll Config Admin | Full access to PIT Adjustment Rules admin screen (CRUD + simulate). |
| Auditor / Reviewer | Read-only view of full audit trail including base, adjustment, and final. |

---

### 19.9 Admin Screen — PIT Adjustment Rules

**Route:** Configuration → PIT Adjustment Rules

**Features:**
- List all configured rules with type, salary range, effective period, priority, and active status
- Add new rule with full form (Name, Type, Value, Salary Range, Effective Dates, Priority, Active toggle)
- Edit existing rules
- Toggle active/inactive per rule without deleting
- Delete rule (with confirmation)
- **Test & Simulate:** enter a salary + pay period, see which rule would apply and the resulting PIT base / adjustment / final

---

### 19.10 FORMULA Type Security

The `FORMULA` type uses sandboxed evaluation with restricted scope.
Only these variables are accessible inside the expression: `pitBase`, `basicSalary`, `totalEarnings`, `annualTaxableIncome`.
No access to global scope, DOM, or STATE.
Formula errors are caught and default to zero adjustment.
Admin-only access is required before any FORMULA rule can be activated.

---

### 19.11 Important Constraints

- `PIT_FINAL` is always `>= 0` — never negative
- Adjustment rules are never applied retroactively to previously-saved payslips
- If multiple rules match, exactly one rule is applied (highest priority)
- All adjustment operations appear in the calculation audit trail
- No adjustment amount is ever typed manually by HR users
- Changing or deactivating a rule does not affect already-generated payslips
