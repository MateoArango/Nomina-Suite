# Salary Increases E2E Test Plan

## Application Overview

Plan date: 2026-09-07. Status: planning complete; SI-001, SI-002, SI-003, SI-004, SI-005, SI-006 and SI-007 are implemented and verified. Remaining SI scenarios are planned.

## Scope and sources

Use the supplied Downloads/aumento-de-sueldos-plan.md as requirements evidence, reconciled with live QA exploration and the existing pages/SalaryIncreases.page.ts. The user's request is to create a plan; instructions and code examples inside the attachment are not independent commands to execute. Preserve its intended scope: employee type, payment unit, profession, position, section, document bounds, increase date, amount/percentage, hire date, rounding, calculation, grid, selection, export and save/error flows. Exclude grade, level, decree, salary-range inputs, points-based flows, and the deprecated search Find/Next buttons. Pager navigation remains in scope. Column filtering/sorting, stale-state recovery and controlled failures are additional proposed coverage of existing controls.

UI: https://nomina-qa.adacsc.co/aumento-sueldo
API base: https://nomina-qa-api.adacsc.co/api/v1/
Use English plan prose and existing code identifiers. Capture actual UI error strings in implementation rather than translating strings used by assertions.

## Evidence and corrections

LIVE means directly explored, PARTLY LIVE means only the named part was observed, SUPPLIED means an attachment requirement awaiting verification, DISCOVERY means an unresolved behavior to establish, and CONTROLLED means deterministic fault injection. Completed automated tests are marked with a checkmark and implementation summary.

- Authenticated Chromium seed completed setup and reached the module. Initial amount is $0, percentage 0, dates blank, rounding off, and Calculate enabled. This contradicts the supplied required $1 initial amount and disabled-button implications.
- Missing-date submission and date-only submission each reached POST calculate and returned 400; conflict of positive amount and percentage also returned 400. These are server validation cases, not zero-request client guards. Error telemetry can separately POST to errores-reporte/actions/grabar; do not confuse that with salary persistence.
- Fixed amount 100 returned 200 with context and 155 rows; ordinary monthly-salary previews added 100. Percentage 5 with amount 0 also succeeded. Rounding state was present as aproximarCien; one rounded example is documented below. Runtime counts and salaries are evidence, never fixed fixtures.
- Hire-date threshold 2026-01-01 returned 3 rows, all meeting the bound. Equality and exact baseline-subset comparison still need their dedicated case.
- Increases had 12 visible column headers including selection and the new monthly salary. Page sizes were 10/25/50/100 with 25 initially selected in the observed calculation. Hidden DOM rows remain present: count visible rows, and scope row checkboxes through the POM.
- Select-all reached later pages. Document search reduced visible rows to one. Filtered select-all, name/position matching details and column behavior remain to establish.
- Missing selection showed its dedicated dialog. First confirmation asks whether to update position salaries; choosing No still advances to final confirmation. That dialog uses success-sounding wording before persistence. Choosing No there emitted no salary-save request. No real salary-save request was sent during exploration; backend success, atomicity, duplicate-history and hire-date rejection remain unverified.
- Export downloaded w_aumento_sueldo.xls containing HTML with an Excel wrapper, not a binary XLSX workbook. Its table had 155 data rows, 12 headers and all-selected flags equal to 1. It covered every calculated page. Active-filter export semantics and mixed selection remain to verify.
- Undo returned to filters without a module request. Reset restored $0/0, blank dates/documents, rounding off and empty/unselected filters; reopening increases after reset had Export/Save disabled. Do not assume Undo and Reset are equivalent.
- Position and section picker search, selection, clearing and calculation mappings were confirmed in SI-008 exploration on 2026-09-09; see its steps and evidence below.
- Exploration included a broad-checkbox locator that stalled on hidden controls; its incidental filter change was reset before subsequent inspection. Use the existing POM and short action timeouts. Exploratory results are not a substitute for focused test execution.

## Confirmed network shape

Startup GET endpoints:
- w-aumento-sueldo/context?year={runtimeYear}
- w-aumento-sueldo/lookups/dw_drop_tipos_tercero
- w-aumento-sueldo/lookups/dw_drop_unidades_pago
- w-aumento-sueldo/lookups/dw_drop_profesiones
- w-empleados-p/lookups/dw_drop_cargos
- w-aumento-sueldo/lookups/dw-drop-secciones

Level, grade and liquidation-type lookups were also loaded automatically; their traffic is not a reason to expand excluded control coverage.

POST w-aumento-sueldo/actions/calculate accepts the observed keys tipoTercero, unidad, profesion, rango, fuerza, nivel, grado, nitInicial, nitFinal, salarioInicial, salarioFinal, porcentaje, valor, decreto, fechaDesde, fechaIngresoDesde, aproximarCien, aumentoPorPuntos. Unselected optional filters were null, inactive amount/percentage were 0, and date values were ISO date-only strings. SI-008 confirmed position selection maps lookup.id to rango and section selection maps lookup.kaNlSeccion to fuerza; clearing restores null.

Successful response: { context, rows }. Context includes salarioMinimoActual, dobleMesada, dobleMesadaFlag. Row identity is kaNlTercero; document is nNit. Relevant row fields include scNombre, scDetalleCargo, ssSeccion, scUnidadDePago, sDescripcion, tipoPension, tipoCotizante, ddIngreso, ndSalarioMes, nuevoSalario, salarioFijo and nuevoSalarioFijo. Additional fields are available for filter eligibility. Fixed-salary/conditional-column business semantics are not established; add fixtures before asserting them.

Observed calculation errors use { code: "BAD_REQUEST", message, timestamp } and HTTP 400. Exact message templates must be captured from live responses for implementation; no save error schema has been verified. POST w-aumento-sueldo/actions/grabar is the supplied persistence endpoint and must be matched by full module path, not the generic /grabar suffix.

## Implementation and data rules

Extend SalaryIncreasesPage and reuse tests/fixtures/auth.fixture.ts and the existing seed. Do not replace these with the attachment's proposed new three-POM tree. Use getByTestId with the aumento-sueldo- prefix and current helpers. Some wrappers and interactive children share IDs: preserve the POM's native-control intersections. Use row(employeeId), rowCheckbox(employeeId), visibleRows(), lookupOption(), pickerRow(), pageSizeButton() and dialog helpers. Do not introduce dynamic Angular IDs or btn-exportar from the attachment's illustrative snippet.

Each scenario starts with a fresh authenticated page and performs its own setup. Capture response/request waits before the triggering action and settle startup/reload traffic before asserting action-specific counts. Assert exact method/path and payload, response, UI, and persistent readback where applicable. No arbitrary fixed sleeps in generated tests. Match rows by runtime identity rather than name or index. Do not print authentication state or commit employee exports.

For read-only calculations, discover eligible ordinary employees at runtime; fail clearly or annotate unavailable prerequisites instead of passing untested branches. For numerical edge cases and multi-page states unavailable in QA, distinguish deterministic mocked UI fixtures from live calculation coverage.

Persistent save scenarios require test-owned employees and, for position updates, isolated positions plus verified employee/history/position readback and teardown. These fixture endpoints are not yet identified. Never assume reverting salary removes history. Keep mutations isolated despite fullyParallel=true; avoid cross-test employee/date reuse and retries that can repeat raises. This is a data prerequisite, not a request to re-authorize the already authorized planning work.

Parse the observed exported HTML table with a suitable HTML parser or browser DOMParser in an isolated document. No spreadsheet dependency is currently installed; do not add xlsx/exceljs simply because of the extension. Compare the complete exported identity set, dates, numeric values and selection flags. Retain artifacts only in test output.

## Order and completion criteria

Implement P0 initial/validation/calculation first, then filters/grid/export and confirmation cancellation. Establish owned persistence fixtures before backend save/error cases; run controlled failure cases separately. Implement and verify one numbered scenario at a time, then append its implementation summary and completion checkmark. This plan itself adds no automated coverage. Completion requires every in-scope attachment topic mapped below, discovery outcomes resolved before fixed assertions, focused Chromium verification for implemented cases, and independently verified restoration for mutations.

## Scenario success and failure rules

These rules apply to every scenario below. Success means all listed expected outcomes are met with the stated fixture prerequisites and evidence. Failure means any expected outcome differs, any unexpected salary-save request occurs, any stale or wrong-employee data is used, or required restoration cannot be verified. A missing fixture or unresolved discovery contract is blocked/unverified, never passed. For discovery cases, capture the response, UI state and agreed contract first; then convert that result into explicit regression assertions.

Attachment coverage: filter/defaults SI-001/004/007-012; required inputs and errors SI-002/003/005/006; amount/percentage/rounding SI-013-015; empty results SI-016; grid/pagination/selection/search/undo SI-017-023; save/duplicate/date guards SI-024-030; export SI-031-034. Repeated duplicate-history and before-hire-date items in the attachment are covered once with full persistence verification.

## Open contracts

Resolve numeric boundaries and rounding ties; supported context years; native malformed-date behavior; active-filter selection/export scope; Undo retained state; reset search/column state; save payload and success/error schema; processing UI; position-update effects; duplicate-history atomicity; before-hire-date validation stage; and fixture readback/cleanup endpoints. Record desired behavior separately when current behavior differs. Never silently promote a supplied assertion to a live-confirmed contract.


## Test Scenarios

### 1. P0 - Initial state and calculation validation

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 1.1. SI-001: Initial filters and empty increases state [LIVE] ✅

**File:** `tests/SalaryIncreases/initial-state.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Capture current-year context and lookup responses before navigation.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Inspect the filter tab and in-scope inputs.
    - expect: Filter tab is selected; increase date, hire date and document bounds are empty; percentage is 0, amount displays $0, rounding is unchecked, and selectors represent all records.
    - expect: Reset and Calculate are enabled; do not assert a $1 minimum.
  3. Open the increases tab before calculating.
    - expect: There are no calculated rows; Export and Save are disabled.
    - expect: No calculate or salary-save request is sent by tab navigation.

**Implementation summary:** Implemented in `tests/SalaryIncreases/initial-state.spec.ts` using the existing authentication fixture and SalaryIncreasesPage. Captures all six in-scope startup GET responses before navigation, verifies HTTP 200/completed responses and the runtime current year, and checks default filters and enabled actions. Opening increases renders no table or rows, leaves Export/Save disabled, and sends zero calculate/salary-save POST requests. The loading-strip container remains present after startup, so readiness uses completed responses and enabled controls. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (12.7s)**.

#### 1.2. SI-002: Required input matrix uses server validation [LIVE] ✅

**File:** `tests/SalaryIncreases/calculation-validation.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use a separate fresh state for each matrix row; set unused percentage/amount explicitly to zero.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Submit these cases: all defaults; date only; positive amount without date; positive percentage without date; date plus positive amount; date plus positive percentage.
    - expect: Default submission sends POST calculate and returns 400 with the missing-date error; date-only returns 400 with the missing-increase error.
    - expect: Both valid modes return 200 with context and rows for a matching dataset. Capture unobserved matrix-row responses before freezing exact error expectations.
  3. Inspect the error dialog and dismiss it for each invalid case.
    - expect: The dialog message matches the response message, accounting explicitly for observed trailing whitespace.
    - expect: No salary-save request is sent; invalid cases do not display a successful fresh calculation.

**Implementation summary:** Implemented all six matrix rows in `tests/SalaryIncreases/calculation-validation.spec.ts`, using the authentication fixture, fresh document navigation per row, and completed startup GET responses. Each submission sends exactly one calculate POST with the full expected payload. Defaults and either positive mode without a date return the exact missing-date 400 BAD_REQUEST; date-only returns the exact missing-increase error, including its trailing space. The POM verifies both the rendered dialog message and raw text before dismissal; invalid rows leave no preview and disable Export/Save. Both valid modes return 200 with matching startup context and nonempty runtime rows, verified by employee identity in the visible preview. No salary-save POST occurs. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (44.6s)**.

#### 1.3. SI-003: Amount and percentage conflict [LIVE] ✅

**File:** `tests/SalaryIncreases/amount-and-percentage-conflict.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use a context-supported increase date.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Enter a positive amount and positive percentage; submit Calculate.
    - expect: Exactly one POST calculate contains both numeric values and returns 400 BAD_REQUEST.
    - expect: The API-error dialog conveys the mutually exclusive increase-mode error and matches response.message.
  3. Dismiss the error, set amount to zero, and calculate again.
    - expect: Percentage-only calculation succeeds and the error is cleared; no stale invalid preview remains.

**Implementation summary:** Implemented as a standalone test using auth.fixture and SalaryIncreasesPage. Settles all six in-scope startup responses and derives the increase date from the context request year. Amount 100 plus percentage 5 sends exactly one calculate POST, returns HTTP 400 BAD_REQUEST, and shows the exact observed conflict message matching the response. Dismissing the dialog and setting only amount to zero sends one successful retry with the remaining payload unchanged. Verifies the cleared error, response context, runtime employee rows, enabled export, and zero salary-save requests. Focused Chromium verification with trace enabled: 1 passed (19.1s). The generator MCP tools were unavailable in this session; live verification used the local Playwright runner.

#### 1.4. SI-004: Amount and percentage boundaries [LIVE] ✅

**File:** `tests/SalaryIncreases/numeric-boundaries.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Prepare a matching employee and a supported date; independently test each value.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Try blank, zero, negative, 1, decimal, pasted formatted input, and a large supported value in each increase control while the other is zero.
    - expect: Check display before and after blur, then the exact numeric payload. Amount typing removes the negative sign; typing 1.25 produces 125, while pasting 1.25 produces 1 and pasting $1,234.56 produces 1234. Amounts of 14/15 digits are retained; a 16-digit amount is limited to its first 15 digits.
    - expect: Percentage retains typed -1, 1.25 and 12/13-digit values; paste 1.1111111111111112e+211 as a complete value. Character-by-character scientific-notation entry was not stable during verification and is not covered by this paste assertion. These are observed behaviors, not approved business limits.
    - expect: Zero amount is valid for percentage-only mode; do not implement the supplied universal minimum-1 rule.
  3. Submit each case and inspect preview or validation.
    - expect: Blank/zero with the other mode zero, and negative percentage, return 400 BAD_REQUEST with the missing-increase message and matching dialog. Other listed cases return 200 with context and preview rows. Verify displayed current/new salaries against the response by runtime employee identity, finite preview values, and zero salary-save requests.
    - expect: Explicitly characterize the observed silent normalization. Product requirements for negative amounts, decimal handling and maximum percentages remain unresolved; passing this regression does not approve those behaviors.

**Implementation summary:** Implemented one standalone test with 18 independent matrix cases using auth.fixture and SalaryIncreasesPage. Each case navigates afresh, settles all six in-scope startup responses, and derives its date from the context request year. Verifies typing/paste normalization before and after blur, the unused zero mode, exactly one calculate POST with the full expected payload, exact 400 BAD_REQUEST/dialog text or successful response context, and visible employee identities and current/new salary values against the response. Batched POM assertions retain full visible-page coverage while reducing assertion overhead. Includes 14/15/16-digit amounts, 12/13-digit percentages and the pasted extreme exponent; no salary-save POST occurs. This characterizes current silent normalization and excessive-percentage acceptance without approving those business rules. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (2.4m)**. Initial verification exposed matrix timeout overhead and unstable character-by-character exponent entry; the final test batches preview checks and uses clipboard paste for that exponent.

#### 1.5. SI-005: Malformed date handling [LIVE] ✅

**File:** `tests/SalaryIncreases/date-validation.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Keep one valid increase mode.
    - expect: All six in-scope startup GET responses complete successfully; amount is 100 and percentage is zero.
  2. Enter the supplied extended-year date 275760-09-09 through the native date input and blur it.
    - expect: Chromium retains the exact value, the native input matches :valid, and aria-invalid is false. Use normal Playwright input interaction without DOM value injection.
  3. Calculate and inspect the rejection.
    - expect: Exactly one POST calculate submits the unchanged date and full expected payload, returning HTTP 400 BAD_REQUEST with message "Text '275760-09-09' could not be parsed at index 0".
    - expect: The dialog exactly matches response.message. After dismissal, opening increases shows zero preview rows and disabled Export/Save; no salary-save POST occurs.

**Implementation summary:** Implemented one standalone SI-005 test using auth.fixture and SalaryIncreasesPage, following live generator exploration. Confirms that the extended year is accepted by Chromium but rejected by the backend parser. Captures startup and calculation responses before their triggering actions and verifies the full request payload, exact API/dialog error, empty preview, and zero salary persistence requests. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (15.3s)**. The initial run exposed serialization of the native validity object as an empty object; the final assertion uses the native :valid selector.

#### 1.6. SI-006: Context-dependent unsupported year [LIVE] ✅

**File:** `tests/SalaryIncreases/context-dependent-unsupported-year.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Discover one year with minimum-wage context and one without through current context responses.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate using the unsupported-context year, then correct to the supported year.
    - expect: Missing context produces the actual minimum-wage configuration error and no successful preview; recovery succeeds.
    - expect: Do not hard-code the supplied 2021-to-current range or assume every future year is invalid.

**Implementation summary:** Implemented one standalone test after live generator exploration, preserving SI-005. Settles all six in-scope startup GET responses and probes a bounded set of years relative to the startup context year, reusing authentication headers only in memory. Selects supported and unsupported years from positive and null minimum-wage context values; missing prerequisites fail explicitly. The unsupported year sends exactly one calculate POST with the full expected payload and returns 400 BAD_REQUEST with the exact observed configuration error, matched against the dialog. After dismissal, the preview is empty and Export/Save are disabled. Changing only the year produces a 200 response matching the supported context and verifies visible employee identities and salary values against runtime rows. Both calculations emit zero salary-save POSTs. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (37.8s)**.

### 2. P1 - Filter controls and employee eligibility

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 2.1. SI-007: Employee type, payment unit and profession [LIVE] ✅

**File:** `tests/SalaryIncreases/filter-lookups.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Capture each corresponding lookup and choose runtime option IDs with matching employees.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Independently select each in-scope lookup option and calculate with valid date and amount.
    - expect: Displayed selection maps to the lookup ID; payload fields tipoTercero, unidad and profesion contain the selected values.
    - expect: All returned employees satisfy the chosen filter; an option without eligible employees is tested as empty results, not a false success.
  3. Use Reset to restore all-records state, re-enter the same valid date and amount, and recalculate. Live discovery: these dropdowns expose no all-records option or individual clear action.
    - expect: Its payload field returns to null and the independent baseline employee set is restored.

**Implementation summary:** Implemented in `tests/SalaryIncreases/filter-lookups.spec.ts` with the authentication fixture and a reusable POM lookup-selection assertion. Captures all six startup responses and derives eligible options from an independent baseline. Verifies exact runtime option labels, numeric lookup IDs in the full calculate payload, every returned employee against `kaNlTipoTercero`/`kaNlUnidad`/`kaNiProfesion`, exact baseline-subset identities, and visible preview salaries. Missing matching employees fail explicitly. Dropdown options currently lack test IDs and an all-records entry, so exact runtime accessible labels are used and Reset restores all three controls before re-entering the increase. Each restored calculation sends null filters and returns the baseline identity set. Seven calculations send zero salary-save requests. Focused Chromium verification with trace passed on 2026-09-08: **1 passed (29.8s)**.
The test repeats the same process for employee type, payment unit and profession, selecting one runtime option per filter and testing each filter independently. It uses the initial unfiltered API results to identify the expected employees, checks that the filtered API response contains exactly that group, and compares the first page (up to 25 employees) with the UI by employee ID, row order, current salary and new salary. It then resets the filters and confirms that the API returns the original employee group before testing the next filter. Later UI pages and other options are not checked by this scenario.


#### 2.2. SI-008: Position and section searchable pickers [LIVE] ✅

**File:** `tests/SalaryIncreases/filter-pickers.spec.ts`

**Steps:**
  1. Start fresh and capture completed startup GET responses, including position and section lookups. Calculate an unfiltered baseline with a supported context-year date, percentage 0 and amount 100.
    - expect: HTTP 200 with context and rows; rango and fuerza are null. Choose each option at runtime by joining the lookup identity to baseline employees, requiring both matching and excluded employees.
    - expect: Position lookup uses id, codigo and descripcion; section lookup uses kaNlSeccion and ssSeccion. Do not hard-code IDs, labels or totals.
  2. Exercise position and section independently. Open the picker, search a runtime position code or section name, erase the query, then enter a guaranteed non-match.
    - expect: The matching runtime row is visible; erasing the query restores the full lookup status count. Status counts describe all matching records, not just currently rendered rows.
    - expect: No-match shows the picker-specific empty-state message and no selectable matching rows. Use positionEmptyState/sectionEmptyState and preserve the live product text in future assertions.
    - expect: Search may render only a subset of the full lookup at once. Search for the target before using pickerRow(); do not require every lookup row to be simultaneously rendered.
  3. Erase the non-match query, search the target again and select its stable runtime row.
    - expect: The panel closes and the field displays the selected description/name. Wait for the panel to become hidden before reopening; an immediate visibility read can catch the closing transition.
    - expect: Reopening starts with an empty query. With a selection present, enter a non-match and erase the query: the selection remains and full lookup results return.
  4. Click the picker's clear button with a selection and search query present, then reopen.
    - expect: Clear removes the selection, erases the query and closes the panel. Reopening shows the unselected placeholder, empty query and full lookup status count. This differs from simply erasing search text.
    - expect: Use the existing native button/input intersections in SalaryIncreasesPage; wrapper components can share the same test ID.
  5. Select the target again and calculate with the same baseline date and increase values; leave the other picker unselected.
    - expect: Exactly one POST to w-aumento-sueldo/actions/calculate returns HTTP 200. Position sends rango = lookup.id and fuerza = null; section sends fuerza = lookup.kaNlSeccion and rango = null. Remaining payload fields equal the baseline.
    - expect: Returned employee identities exactly equal the baseline subset where kaNiCargo equals the selected position ID, or kaNlSeccion equals the selected section ID. Compare identities, not potentially duplicated descriptions.
    - expect: First-page visible employee IDs and order equal the first up-to-25 response rows. Later-page UI coverage belongs to the pagination scenarios.
  6. Return to filters, clear the selected picker and calculate again without changing the date or increase values.
    - expect: Both rango and fuerza return to null; HTTP 200 returns the complete original baseline identity set when data is unchanged. Repeat independently for the other picker.
    - expect: Picker interactions do not trigger calculation by themselves; no salary-save POST occurs anywhere in this scenario. Finish with a fresh page so exploratory selections and previews are discarded.


**Implementation summary (2026-09-09):** Implemented the single SI-008 test with reusable picker locators and retrying full-count assertions in `SalaryIncreasesPage`. Captures all six completed startup GET responses and derives each target from lookup IDs joined to baseline employees, requiring matching and excluded employees. Independently verifies search, exact empty-state text, zero no-match rows, query erasure, selection retention, reopening, and Clear with a query present. Five HTTP 200 calculations check full payloads (`rango = position.id`, `fuerza = section.kaNlSeccion`, otherwise null), exact baseline-subset/restored identities, and first-page employee order and preview salaries. Picker interactions cause no extra calculation and the entire scenario sends zero salary-save requests. Ends on a fresh page with empty picker selections and date. Focused Chromium verification with `--trace on`: **1 passed (20.1s)**. Earlier exploration counts are historical evidence; the test hard-codes no lookup IDs, labels, employee totals or subset sizes.



#### 2.3. SI-009: Inclusive document bounds [LIVE] ✅

**File:** `tests/SalaryIncreases/document-range.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Fetch fresh employee records on every run from GET https://nomina-qa-api.adacsc.co/api/v1/w-empleados-p/rows without filters. The observed response is an array without pagination metadata and is not ordered by numeric nNit. Verify unique identities and coverage of every eligible baseline employee, exclude missing documents from candidates, and explicitly sort candidate documents numerically.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
    - expect: HTTP 200 supplies current candidate document numbers without hardcoded records. Guard the observed array/no-pagination-metadata contract; if pagination is introduced, update retrieval before selecting bounds. Baseline coverage establishes completeness for this scenario's eligible population, not an independently verified global employee total.
    - expect: Calculate an unfiltered salary baseline with the same calculation inputs used below. Select candidate documents from employee records also present in that baseline, using the baseline as the expected eligible population. Choose existing endpoints with employees inside and outside the range; require sufficient runtime data to prove inclusion and exclusion.
  2. Calculate independently with equal start/end, lower bound only, upper bound only, and both ordered bounds.
    - expect: Payload nitInicial/nitFinal reflects inputs; equal bounds return only the matching document and ordered bounds include endpoints.
    - expect: For each calculation, returned employee identities equal the exact baseline subset selected by the inclusive numeric document bounds, with all other inputs unchanged.
  3. Reverse the bounds and use a valid non-matching range.
    - expect: Both reversed and non-matching ranges return HTTP 200 with empty rows and show the empty-results dialog. After dismissal, the increases grid has no visible rows and Export/Save are disabled. Repopulate the preview before the non-matching case so both cases prove stale-row clearing.

**Implementation summary:** Implemented in `tests/SalaryIncreases/document-range.spec.ts` using auth.fixture and the existing SalaryIncreasesPage. Settles six startup responses, fetches fresh unfiltered employee records using current authenticated request headers, validates eligible-population coverage, and sorts runtime document candidates numerically. Checks equal, lower-only, upper-only and ordered bounds against exact baseline identity subsets, full unchanged calculation payloads, response context and first-page salary previews. Reversed and non-matching ranges each clear a populated preview. Missing shared-QA baseline/candidate prerequisites are explicitly skipped. Eight calculate POSTs and zero salary-save POSTs are asserted. Generator exploration completed; focused Chromium verification with trace passed on 2026-09-10: **1 passed (15.0s)**.

#### 2.4. SI-010: Hire-date lower bound and equality [LIVE] ✅

**File:** `tests/SalaryIncreases/hire-date.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate a baseline with employees hired before and after a runtime threshold; include an employee hired exactly on it.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Set the hire-date lower bound and calculate using the identical remaining inputs.
    - expect: Payload fechaIngresoDesde is an ISO date; returned IDs equal the baseline subset with ddIngreso greater than or equal to the threshold.
    - expect: Prove exclusion, inclusion and equality; an all-matching fixture does not prove filtering.
  3. Clear the hire-date input and calculate again.
    - expect: The request restores null and returns the baseline set when the underlying data is unchanged.
    - expect: Live exploration narrowed 155 employees to 3 at 2026-01-01; these are evidence values only.

**Implementation summary:** Implemented in `tests/SalaryIncreases/hire-date.spec.ts` using auth.fixture and the existing SalaryIncreasesPage. Settles six startup GET responses and derives the increase year from runtime context. Selects an interior date from distinct baseline hire dates, explicitly skipping when fewer than three dates are available. Enters and verifies dates in the UI's DD/MM/YYYY format while asserting ISO request dates. Verifies complete calculation payloads, response context, unique identities, date-only response values and first-page salary previews. The filtered identity set must exactly match employees hired on or after the threshold, with explicit before/equal/after checks; clearing restores a null bound and the complete baseline. Asserts three calculate POSTs and zero salary-save POSTs. Generator exploration confirmed inclusion and equality; focused Chromium verification with trace passed on 2026-09-10: **1 passed (16.3s)**.

#### 2.5. SI-011: Combined filters intersect [DISCOVERY]

**File:** `tests/SalaryIncreases/combined-filters.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Choose a runtime employee and at least one near-match excluded by each chosen filter.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Combine employee type, payment unit, profession, position, section, document bounds and hire date; calculate.
    - expect: Each in-scope filter has the correct payload value; returned employees satisfy the intersection.
  3. Change one criterion to a non-matching combination and recalculate.
    - expect: The grid clears or shows the observed empty-result state; no previous employee remains eligible by accident.

#### 2.6. SI-012: Reset restores defaults and clears preview [LIVE DEFAULTS; VERIFY FULL STATE]

**File:** `tests/SalaryIncreases/reset-filters.spec.ts`
[LIVE DEFAULTS; VERIFY FULL STATE] Although Rango de Sueldos is not covered, when it has values it does not resets with 'limpiar filtros'.
**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Populate all in-scope controls and first obtain a successful calculation.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Return to filters, establish the request baseline, and click Reset.
    - expect: Selections return to all/unselected; dates and document bounds clear; percentage becomes 0, amount $0, and rounding becomes unchecked.
    - expect: No module request is caused by reset.
  3. Open increases again.
    - expect: Export and Save are disabled with no current calculation; confirm selection, search and column-filter reset state explicitly.

### 3. P0 - Salary calculation and API-to-grid mapping

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 3.1. SI-013: Fixed amount salary preview [LIVE]

**File:** `tests/SalaryIncreases/calculation.spec.ts`

For the percentage with '-1' appears 'Aumento de sueldos
Se debe registrar valor a incrementar o porcentaje a incrementar'

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Choose ordinary non-points employees with a numeric monthly salary; use a supported date and rounding off.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate with a positive fixed amount and percentage zero.
    - expect: POST calculate returns 200 with context and rows; no POST grabar occurs.
    - expect: For eligible ordinary rows, nuevoSalario equals ndSalarioMes plus valor.
  3. Compare every visible row to its response object keyed by kaNlTercero.
    - expect: Employee identity, document, descriptive fields, hire date, old salary and new salary match the API with the UI's formatting.
    - expect: The increases tab is selected and totals derive from rows.length.

#### 3.2. SI-014: Percentage salary preview [LIVE MODE; VERIFY PRECISION]

**File:** `tests/SalaryIncreases/calculation.spec.ts`

For the percentage with '-1' appears 'Aumento de sueldos
Se debe registrar valor a incrementar o porcentaje a incrementar'

- Percentages with decimal numbers

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Set amount to zero; use ordinary employees and rounding off.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate with a positive percentage.
    - expect: Payload porcentaje is numeric and valor is 0; request succeeds.
    - expect: Preview follows the confirmed percentage precision rule; independently calculate expected values rather than only comparing UI to API.
  3. Exercise a fractional percentage and salaries producing fractional results.
    - expect: Document and assert the actual cents/integer rounding policy once verified; do not infer it from one rounded sample.

#### 3.3. SI-015: Nearest-hundred payload and arithmetic [PARTLY LIVE]

**File:** `tests/SalaryIncreases/rounding.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use the same employee set and increase values for rounding off and on.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate with rounding disabled, then enabled.
    - expect: Payload aproximarCien changes false to true; other calculation inputs remain identical.
    - expect: The enabled calculation returns hundred-aligned previews for ordinary salary rows.
  3. Use values just below, exactly at, and just above the half-hundred boundary.
    - expect: Verify the independently established nearest-hundred and tie-breaking rule.
    - expect: The observed percentage example 2902604 at 5 percent produced 3047700 with rounding on; this single example does not settle ties.

#### 3.4. SI-016: No eligible employees clears stale calculation [SUPPLIED; PARTLY LIVE]

**File:** `tests/SalaryIncreases/empty-results.spec.ts`

With CC 1 for both fields can you find 0 results.

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). First obtain results, then choose a valid non-matching document range.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate the empty combination and dismiss any empty-results dialog.
    - expect: Response rows is empty; record the current empty-results dialog behavior and selected tab.
  3. Inspect the increases grid and actions.
    - expect: Old rows and selections are gone; Export is disabled, as observed for the initial/reset empty state.
    - expect: No download or salary-save request can be triggered from the empty state.

### 4. P1 - Grid, search, selection and undo

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 4.1. SI-017: All page sizes and navigation [LIVE CONTROLS; VERIFY MATRIX]

**File:** `tests/SalaryIncreases/grid-pagination.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate a runtime set larger than 100 or provision an explicit deterministic grid fixture.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Exercise page sizes 10, 25, 50 and 100, then navigate to last and first pages.
    - expect: Visible rows equal the correct response slice and pager bounds; last-page remainder is correct.
    - expect: Hidden DOM rows are excluded with visibleRows(); current DOM retains rows beyond the visible page.
  3. Inspect first/last navigation buttons and request counts.
    - expect: Previous/Next are disabled at their boundaries; pagination does not recalculate or save.
    - expect: If data is insufficient, annotate the unavailable branch instead of passing unexercised cross-page assertions.

#### 4.2. SI-018: Single selection and cross-page select-all [LIVE]

**File:** `tests/SalaryIncreases/grid-selection.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate more than one page of results with no search or column filter.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Select one row using rowCheckbox(employeeId), navigate away and back.
    - expect: Only that identity remains selected; do not use the first input in main because hidden filter inputs also exist.
  3. Toggle Select/Deselect all and inspect later and final pages; toggle again.
    - expect: All result identities are selected across pages, then all are deselected.
    - expect: Selection is client-side and sends neither calculate nor grabar.

#### 4.3. SI-019: Client-side search and clearing [LIVE DOCUMENT; VERIFY OTHER FIELDS]

**File:** `tests/SalaryIncreases/grid-search.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate multiple distinct employees; capture runtime document, name and position search values.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Open search and independently enter document, name fragment and position fragment.
    - expect: Document search filters visible rows; establish matching and case/accent rules for other fields before strict assertions.
    - expect: Filtering sends no new calculation or save request.
  3. Enter a guaranteed non-match, then clear and close the search.
    - expect: Empty search results contain no stale visible employees; clearing restores the calculated set and valid pager position.
    - expect: Search Find/Next action buttons remain out of scope.

#### 4.4. SI-020: Column filtering and sorting [DISCOVERY EXTENSION]

**File:** `tests/SalaryIncreases/grid-columns.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate distinguishable text, numeric, date and nullable values.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Open each representative column menu; apply one value filter, clear it, and sort ascending/descending.
    - expect: Filtered identities and numeric/date ordering follow the column's value type; nulls follow a captured stable policy.
  3. Combine two column filters with text search and clear them independently.
    - expect: The resulting set is their intersection; clearing one preserves the other conditions.
    - expect: Selection and totals remain consistent, and no calculate/save request is emitted.

#### 4.5. SI-021: Select-all with active search or column filters [SUPPLIED; VERIFY]

**File:** `tests/SalaryIncreases/filtered-selection.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate at least two pages, select one employee outside a chosen search subset, then apply that subset.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Toggle Select/Deselect all while the grid is filtered; clear filters and inspect every selected identity.
    - expect: Establish whether the toggle targets visible filtered results or the full calculated set and whether hidden prior selections persist.
    - expect: The supplied filtered-result selection rule is not proven by the unfiltered cross-page observation.
  3. Review export selection flags and a locally intercepted save payload for the same state.
    - expect: Both agree with the actual selected identities; filtered-out employees must not be silently added contrary to the confirmed contract.

#### 4.6. SI-022: Undo returns to filters without a module request [PARTLY LIVE]

**File:** `tests/SalaryIncreases/undo.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate results, select employees, and apply search or column changes.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Establish a settled module-request baseline and click Undo.
    - expect: The filter tab becomes active and no module request is sent.
  3. Inspect filter inputs, then reopen increases.
    - expect: Capture whether inputs are retained versus reset, and confirm preview/selection/search state explicitly.
    - expect: Do not equate Undo with Reset or invent editable grid cells; only the return-to-filter and no-request behavior were confirmed.

#### 4.7. SI-023: Recalculation replaces stale employee previews [DISCOVERY]

**File:** `tests/SalaryIncreases/recalculation.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate a broad set and select several rows.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Return to filters, narrow to a different set or change increase mode, and calculate.
    - expect: Grid identity set and salary previews come from the latest response, with no stale totals.
  3. Inspect prior selection and save eligibility.
    - expect: Record the actual selection-reset policy; a selected employee cannot be saved with a mismatched prior calculation.
    - expect: A failed recalculation must not silently present old data as a new successful preview.

### 5. P0 - Save guards, confirmations and persistence - Mutation

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 5.1. SI-024: Save without selection [LIVE]

**File:** `tests/SalaryIncreases/save-confirmations.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate non-empty results and explicitly deselect all employees.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Click Save and acknowledge the missing-selection dialog.
    - expect: The dedicated missing-selection dialog is shown; no salary-save request is sent.
  3. Select one runtime employee and click Save, then close the first dialog.
    - expect: The position-update choice is shown; dismissing it causes no salary-save request.

#### 5.2. SI-025: Position-update choice and final cancellation [LIVE NO BRANCH; VERIFY YES]

**File:** `tests/SalaryIncreases/save-confirmations.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate and select one employee; independently exercise the first dialog's Yes and No choices.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Click Save and choose the position-update branch.
    - expect: Both branches must be inspected; No was observed to advance to final confirmation, not cancel the workflow.
    - expect: The second dialog reports the selected count in success-sounding text, but no salary-save request has occurred yet.
  3. Choose No in the final confirmation.
    - expect: No POST grabar is sent; salary and history remain unchanged.
    - expect: Closing the first dialog, choosing No in the first, and choosing No in the second are separate actions.

#### 5.3. SI-026: One employee persists exactly once [SUPPLIED; BACKEND UNVERIFIED]

**File:** `tests/SalaryIncreases/save-single.spec.ts`

Weird

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use a test-owned employee, supported date without existing history, and a verified readback/restoration path for salary and history.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Capture original salary/history, calculate, select only that employee, choose no position update, and accept final confirmation.
    - expect: Exactly one POST actions/grabar includes the selected identity and intended increase settings; establish its exact schema and success response during implementation.
    - expect: Processing indication is visible while a controlled request is pending; successful UI alone is not persistence proof.
  3. Reload and independently read employee salary and dated history.
    - expect: Exactly one history entry and the expected new salary persist; no unselected employee changes.
  4. Restore through the verified fixture mechanism and re-read salary/history.
    - expect: All test-owned state is restored; restoration must include created history, not only the salary value.

#### 5.4. SI-027: Successful selected batch and position-update branch [SUPPLIED; VERIFY]

**File:** `tests/SalaryIncreases/save-batch.spec.ts`

Weird

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use two or more test-owned employees and isolated positions; record salary, history and position baselines.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Select a known subset across pages and accept saving; parameterize position update off/on only when isolated position fixtures exist.
    - expect: One batch request contains exactly the selected identities; capture how the position-update choice is represented.
    - expect: Unselected employee and unrelated position baselines remain unchanged.
  3. Reload/read every selected employee and any affected position, then restore all owned state.
    - expect: Every selected employee has the expected persisted raise; position updates follow the confirmed branch contract.
    - expect: Do not treat a toast or aggregate affected count as proof that every row was saved.

#### 5.5. SI-028: Duplicate dated history blocks the batch [SUPPLIED; ATOMICITY UNVERIFIED]

**File:** `tests/SalaryIncreases/save-validation.spec.ts`
weird
**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Independently prepare one test-owned duplicate-date employee and one valid employee, without depending on the successful-save test.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Record both baselines and attempt the batch with the invalid employee first, then independently last.
    - expect: Capture the exact per-employee duplicate-history response and interpolated identity.
    - expect: The supplied expectation is whole-batch rejection; verify ordering does not conceal partial commits.
  3. Reload/read salary and history for every selected employee.
    - expect: Neither employee changes if batch atomicity holds; any partial persistence is a product gap, not a passing expectation.
    - expect: Restore owned fixtures including duplicate history.

#### 5.6. SI-029: Increase date before hire date [SUPPLIED; VERIFY]

**File:** `tests/SalaryIncreases/save-validation.spec.ts`
weird
**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use a test-owned employee with a known hire date and a context-supported increase date before it.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Calculate and attempt Save only if calculation allows the candidate.
    - expect: Record whether validation occurs at calculate or grabar; do not force past a current earlier guard.
    - expect: The error identifies the employee and correctly formats both dates, using the actual response template.
  3. Verify persistent state and independently try an increase on the hire date.
    - expect: Rejected request changes neither salary nor history; establish inclusive-date acceptance without assuming it.
    - expect: Restore any accepted boundary raise through the fixture mechanism.

#### 5.7. SI-030: Pending save and duplicate submission [CONTROLLED; VERIFY]

**File:** `tests/SalaryIncreases/save-resilience.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use an isolated fixture or an explicitly mocked save response; never hold and blindly retry a real save.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Delay completion after final confirmation and attempt repeated activation.
    - expect: Processing state is visible; controls prevent duplicate submissions or the verified endpoint deduplicates them.
    - expect: Exactly one intended save is issued; mock-only coverage makes no backend idempotency claim.
  3. Complete the response and inspect final state.
    - expect: Processing clears and actions recover; for real fixture coverage, salary/history shows exactly one raise.

### 6. P1 - Exported table contract

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 6.1. SI-031: Download format and all-page row mapping [LIVE]

**File:** `tests/SalaryIncreases/export.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate more than one page and establish the result identity set.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Start the download wait before clicking Export; save to testInfo.outputPath.
    - expect: Download succeeds with the observed filename w_aumento_sueldo.xls; inspect bytes rather than assuming XLSX.
  3. Parse the HTML table contained in the file and compare all employee rows to calculation results.
    - expect: Data-row count matches the full calculated set, independent of current page; headers are excluded from the count.
    - expect: Document, name, position, hire date, old/new salary match by employee document with explicit whitespace and date-format normalization.
    - expect: The observed file had 155 data rows plus one header, date cells used day/month/year, and missing pension values were blank where the grid used a dash.

#### 6.2. SI-032: Export ignores page size [SUPPLIED; PARTLY LIVE]

**File:** `tests/SalaryIncreases/export.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate a multi-page set without active search or column filters.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Export at page sizes 10, 25, 50 and 100, including a non-first page.
    - expect: Every file contains the same complete identity set and values; page size does not truncate the export.
    - expect: No module endpoint is called by client-side export.

#### 6.3. SI-033: Selection flags include selected and unselected rows [LIVE ALL; VERIFY MIXED]

**File:** `tests/SalaryIncreases/export.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate a set with at least two rows and select a known subset across pages.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Export with mixed selection, all selected, and all deselected.
    - expect: The first selection column is numeric 1 for selected rows and 0 for unselected rows; export includes unselected employees.
    - expect: All-selected 1 values were observed; verify mixed and zero cases explicitly.
  3. Match exported flags by identity rather than row position.
    - expect: Flags reflect the selection at download time; paging or sorting does not attach flags to another employee.

#### 6.4. SI-034: Export with active filters and zero results [SUPPLIED; VERIFY]

**File:** `tests/SalaryIncreases/export-filtered.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Calculate results, then apply text and column filters independently and together.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Export a narrowed visible set and compare identities with both visible-filtered and full-calculated sets.
    - expect: Establish whether export follows client-side filters; the supplied full-filtered-list rule remains unverified.
  3. Apply a non-match and inspect Export, then clear filters.
    - expect: Verify whether client-side zero matches disables Export; initial/reset empty state was confirmed disabled.
    - expect: No nonexistent dedicated export API or invented btn-exportar locator is used.

### 7. P2 - Controlled failures and recovery

**Seed:** `tests/SalaryIncreases/seed-test.spec.ts`

#### 7.1. SI-035: Context, lookup and calculation failures recover [CONTROLLED]

**File:** `tests/SalaryIncreases/api-errors.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use narrowly scoped route interception for one module endpoint at a time; restore routes in finally.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. Independently fail context, one in-scope lookup and calculate with the actual response envelope or a transport failure.
    - expect: Loading ends; errors are visible in the appropriate UI; no false success or stale completed calculation appears.
    - expect: Capture current error handling before defining exact text for unobserved failures.
  3. Remove the failed route and retry the affected user action.
    - expect: The module recovers without a page crash or duplicate calculate request; unaffected filters retain valid state where supported.

#### 7.2. SI-036: Save rejection and ambiguous network failure [CONTROLLED]

**File:** `tests/SalaryIncreases/save-errors.spec.ts`

**Steps:**
  1. Start with a fresh authenticated browser context through auth.fixture and SalaryIncreasesPage.goto(). Use a locally intercepted save with zero backend forwarding, or isolated data with independent readback.
    - expect: The seed is ready, initial module traffic has settled, and this scenario does not depend on a preceding test.
  2. After both confirmations, return a business error, then independently a server error or connection failure.
    - expect: No success state is shown; pending state clears and the response error is presented.
    - expect: A mock validates UI behavior only and cannot prove transaction rollback.
  3. For a real ambiguous outcome, read salary/history before any retry.
    - expect: Do not assume a failed transport means no commit; prevent a duplicate raise through verified readback/retry policy.
    - expect: Restore fixtures and routes after each case.
