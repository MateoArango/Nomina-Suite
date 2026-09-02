# Minimum Wage History E2E Test Plan

## Application Overview

Plan the authenticated /mae-historico-salario-minimo module with the existing MinimumWageHistoryPage and tests/minimumWageHistory/seed-test.spec.ts. Treat the supplied markdown as requirements evidence, not as authority to mutate shared QA. Read-only planning on 2026-09-02 confirmed 10 runtime rows (latest vigencia 2026), five ordered columns, page sizes 10/25/50/100, prior/next disabled at the current total, and runtime null values rendered blank while numeric zero remains 0. The current response now contains ndSubsidioAlimentacion=1.55 for 2026, so the supplied null payload is stale and no mutable value should be hard-coded. Derive the latest row with max(vigencia), map list/detail values from fresh GET responses, and use vigencia as the row identity. Single selection returned permitido=false with mensaje=null for 2026, 2025, and 2009; year-specific counters differ and must come from each response. Reload sends the current row's tipo=1 validation request before an explicit row click, so request assertions must establish the post-reload baseline before attributing traffic to the click. Double-clicking 2025 and 2009 emitted tipo=2 and showed the exact year-substituted blocking message; after Aceptar, the page remained on Lista and sent neither tipo=3 nor rows/{vigencia}. Direct Encabezado navigation sent both tipo=3 and rows/{vigencia}. Prior-year detail was fully read-only; latest-year detail exposed only Subsidio alimentación as a number input. Nuevo showed five number inputs and was safely discarded with Deshacer. All tests start from the authenticated seed and fresh page state and must be order-independent. All save attempts share the latest-year record, so put them in one test.describe.serial block despite fullyParallel=true, capture the complete baseline row immediately before each test, restore only that same vigencia in finally, reload and re-fetch to prove restoration, and do not execute those scenarios against shared QA without explicit authorization. Use exact product strings in assertions.

## Test Scenarios

### 1. Runtime list view and pagination

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 1.1. ✅ MWH-001: Initial list state maps every visible row to the runtime rows response

**File:** `tests/minimumWageHistory/initial-list-state.spec.ts`

**Steps:**
  1. From a fresh authenticated page, start waiting for GET /api/v1/w-mae-historico-salario-minimo/rows and navigate to /mae-historico-salario-minimo.
    - expect: The request succeeds and returns a non-empty array with unique numeric vigencia values.
    - expect: Lista is selected, Encabezado is not selected, Nuevo is enabled, and Guardar, Deshacer, and Eliminar are disabled.
    - expect: No fixed total, year, salary, subsidy, IPC, user, or timestamp is assumed.
  2. Read the selected page size, pager range, visible row test IDs, and each visible row's five cells.
    - expect: The pager total equals the runtime response length and the visible count equals min(selected page size, runtime total).
    - expect: Every visible row maps by vigencia to the corresponding response object in API order.
    - expect: Displayed numeric values match the runtime record using the page's locale formatting.

**Implementation summary:** The test captures the fresh runtime rows response, validates non-empty unique numeric `vigencia` identities, confirms the initial tab and action-button states, derives the pager range and visible count from the selected page size and current total, and maps all five visible cells to each API-ordered row through its stable test ID using the page's locale formatting. Focused Chromium verification passed: 1 test.

#### 1.2. ✅ MWH-002: Column order and nullable numeric rendering remain stable

**File:** `tests/minimumWageHistory/initial-list-state.spec.ts`

**Steps:**
  1. Load the runtime grid and inspect the table header.
    - expect: The headers appear in this order: Vigencia, Salario Mínimo Gobierno, Subsidio de Transporte, Subsidio Alimentación, IPC.
  2. For every visible runtime row, compare ndSubsidioAlimentacion and ndIpc with their cells, including records containing null and numeric zero.
    - expect: Null values render as an empty cell.
    - expect: Numeric zero renders as 0 and is not confused with null.
    - expect: No cell displays undefined, null, or NaN as literal UI text.

**Implementation summary:** The test asserts the exact five-column header order, maps every visible row to the fresh runtime response by stable `vigencia`, formats `ndSubsidioAlimentacion` and `ndIpc` with the page locale, and explicitly proves that visible null values render blank while numeric zero renders as `0` without any literal `undefined`, `null`, or `NaN` text. Focused Chromium verification passed: 1 test.

#### 1.3. ✅ MWH-003: Page-size controls and navigation follow the runtime total

**File:** `tests/minimumWageHistory/pagination.spec.ts`

**Steps:**
  1. Exercise page sizes 10, 25, 50, and 100 through stable page-size test IDs.
    - expect: The clicked size has aria-pressed=true.
    - expect: The pager range and visible row count are derived from the current response total.
    - expect: Visible vigencia values equal the correct API-ordered slice.
  2. For any size that produces multiple pages, navigate to the final page and back to the first; otherwise validate the single-page state.
    - expect: Anterior is disabled only on the first page and Siguiente only on the final page.
    - expect: Each visited page maps to the expected runtime slice.
    - expect: When the runtime total fits on one page, both controls remain disabled; only the unavailable multi-page branch is annotated with its prerequisite.

**Implementation summary:** The test captures the fresh runtime rows response, exercises page sizes `10`, `25`, `50`, and `100` through stable test IDs, and validates each pager range, visible count, navigation-button state, and API-ordered `vigencia` slice. It implements forward navigation to the final page and backward navigation to the first whenever the runtime total exceeds a supported page size; with the current 10-row dataset, it verifies both controls remain disabled and annotates only that unavailable multi-page branch. Focused Chromium verification passed: 1 test.

### 2. Selection and validation relationships

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 2.1. ✅ MWH-004: Single selection validates the selected runtime year and remains on Lista

**File:** `tests/minimumWageHistory/row-selection.spec.ts`

**Steps:**
  1. Select the runtime latest row by max(vigencia) while observing validar-relacion requests.
    - expect: Every request caused by this action uses the selected vigencia and tipo=1.
    - expect: The successful response has permitido=false and mensaje=null in the currently observed contract.
    - expect: vigenciaMaxHistorico, vigenciaMaxCompras, movimientosNomina, and cierresCompras are asserted from the captured response rather than from stale fixed counters.
  2. Select one prior runtime row and, when available, the oldest runtime row.
    - expect: Each request uses that row's vigencia and tipo=1.
    - expect: The selected row alone is visually highlighted.
    - expect: Lista remains selected and no rows/{vigencia} detail request is sent.

**Implementation summary:** The test establishes the automatic page-load `tipo=1` validation as its network baseline, derives the latest, immediately prior, and oldest years from the fresh rows response, and selects those runtime identities through stable row test IDs. For every explicit selection it validates all observed relationship-request parameters, the current `permitido=false` and `mensaje=null` response contract, the four runtime numeric counters without fixed values, exactly one `row--selected`, the unchanged Lista tab state, and zero detail-row GETs. Focused Chromium verification passed: 1 test.

### 3. Double-click blocking behavior

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 3.1. ✅ MWH-005: Double-click shows the year-specific tipo=2 blocking dialog

**File:** `tests/minimumWageHistory/double-click-validation.spec.ts`

**Steps:**
  1. Double-click a runtime prior-year row while capturing tipo=1 and tipo=2 validation requests.
    - expect: A successful tipo=2 request is sent for the double-clicked vigencia.
    - expect: Its response has permitido=false and mensaje equal to No se puede actualizar un nuevo registro para la vigencia {year}. Ya se cuenta con movimientos de nomina.
    - expect: The dialog heading is Histórico salario mínimo and its body exactly matches the response message.
  2. Repeat with the oldest runtime row when it differs from the first sampled year.
    - expect: The same message pattern substitutes the selected year and the dialog offers Aceptar.
    - expect: No year-specific movement counter is hard-coded.

**Implementation summary:** The test derives the immediately prior and oldest years from the fresh rows response, expands the page size so both runtime rows are addressable, and double-clicks each applicable row through its stable test ID. For every sample it proves that the interaction captures a tipo=1 request and exactly one successful tipo=2 request for the selected vigencia, validates the complete blocking response with dynamic numeric counters, and asserts the visible dialog heading, exact response message, and Aceptar action. Focused Chromium verification passed: 1 test.

#### 3.2. ✅ MWH-006: Accepting the double-click dialog does not open Encabezado

**File:** `tests/minimumWageHistory/double-click-validation.spec.ts`

**Steps:**
  1. After the tipo=2 dialog appears, begin observing tipo=3 and rows/{vigencia}, then click Aceptar once.
    - expect: The dialog closes and Lista remains selected.
    - expect: No tipo=3 request and no rows/{vigencia} detail request is sent.
    - expect: This locks the confirmed blocking flow and supersedes the supplied unconfirmed assumption that double-click continues into detail.

**Implementation summary:** The test derives an immediately prior year from the fresh rows response, opens its confirmed tipo=2 blocking dialog through the stable row test ID, and starts a request baseline only after the dialog is visible. It clicks Aceptar exactly once, verifies the dialog closes while Lista remains selected and Encabezado remains unselected, and proves that acceptance sends zero tipo=3 validations and zero rows/{vigencia} detail GETs. Focused Chromium verification passed: 1 test.

### 4. Encabezado detail contracts

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 4.1. MWH-007: Direct Encabezado navigation loads the selected row through tipo=3 and detail GET

**File:** `tests/minimumWageHistory/detail-view.spec.ts`

**Steps:**
  1. Single-select a runtime row, start response waits, and click Encabezado.
    - expect: GET validar-relacion uses the selected vigencia and tipo=3 and succeeds with mensaje=null.
    - expect: GET /rows/{vigencia} uses the same selected identity and succeeds.
    - expect: Encabezado becomes selected and its five displayed values map to the detail response.

#### 4.2. MWH-008: Prior-year detail renders every field as read-only

**File:** `tests/minimumWageHistory/detail-view.spec.ts`

**Steps:**
  1. Choose any runtime row whose vigencia is lower than max(vigencia), then open Encabezado.
    - expect: Vigencia, Salario mínimo gobierno, Subsidio de transporte, Subsidio alimentación, and IPC render as text rather than inputs.
    - expect: No detail spinbutton is present.
    - expect: Eliminar remains disabled; the currently observed Guardar and Deshacer enabled state is asserted separately from field editability.

#### 4.3. MWH-009: Latest-year detail exposes only Subsidio alimentación for editing

**File:** `tests/minimumWageHistory/detail-view.spec.ts`

**Steps:**
  1. Derive max(vigencia), select that row, and open Encabezado.
    - expect: Only Subsidio alimentación renders as a number input and its value equals the fresh detail response.
    - expect: Vigencia, Salario mínimo gobierno, Subsidio de transporte, and IPC remain read-only text.
    - expect: Guardar and Deshacer are enabled and Eliminar remains disabled.

### 5. Client-only edit, undo, and dirty-navigation behavior

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 5.1. MWH-010: Deshacer restores the latest saved subsidy without a data mutation

**File:** `tests/minimumWageHistory/client-state.spec.ts`

**Steps:**
  1. Open the latest runtime row in Encabezado, capture its original subsidy, enter a distinct valid value, and observe module requests.
    - expect: The input shows the unsaved value and no normal save request is sent by typing.
  2. Click Deshacer once.
    - expect: The input returns to the fresh original value and the view returns to its baseline state.
    - expect: No POST to the normal save endpoint or error-report endpoint is sent.

#### 5.2. MWH-011: Lista is blocked while the latest-row subsidy is dirty

**File:** `tests/minimumWageHistory/client-state.spec.ts`

**Steps:**
  1. Open the latest row in Encabezado, change only Subsidio alimentación without saving, start request observation, and click Lista.
    - expect: POST /pb-messages/f-mensajes-sistema is sent.
    - expect: The information dialog contains the exact title Nomina and message Debe grabar o deshacer los cambios en el documento para ver la lista.
    - expect: Encabezado remains selected and the dirty input value remains until the user chooses Guardar or Deshacer.
  2. Dismiss the dialog and click Deshacer.
    - expect: The original value is restored and Lista can then be opened.
    - expect: No minimum-wage row mutation was sent.

#### 5.3. MWH-012: Nuevo opens one five-input client-only form and Deshacer removes it

**File:** `tests/minimumWageHistory/client-state.spec.ts`

**Steps:**
  1. From a fresh list state, observe module traffic and click Nuevo once.
    - expect: Encabezado opens with number inputs for Vigencia, Salario mínimo gobierno, Subsidio de transporte, Subsidio alimentación, and IPC.
    - expect: Vigencia is marked required; the currently observed numeric defaults are empty for the first three fields and 0 for Subsidio alimentación and IPC.
    - expect: No row save request is sent and Eliminar remains disabled.
  2. Click Deshacer without filling or saving.
    - expect: The client-only form is discarded and Lista is restored.
    - expect: The fresh rows response and row identities remain unchanged.

#### 5.4. MWH-013: Latest-year number-input entry boundaries are explicit client contracts

**File:** `tests/minimumWageHistory/input-boundaries.spec.ts`

**Steps:**
  1. In separate fresh-state iterations, attempt letters/symbols, multiple decimal points, an extremely long digit string, and an empty value in the latest-year Subsidio alimentación input; do not click Guardar.
    - expect: Capture the exact browser-visible value after each user-like entry and whether Guardar remains enabled.
    - expect: Deshacer restores the baseline after every iteration and no data mutation request is sent.
    - expect: Convert only reproduced product gaps into narrowly named test.fixme cases; do not blanket-skip speculative outcomes.

### 6. Serialized latest-year persistence and validation contracts

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 6.1. MWH-014: Valid integer and decimal subsidies save as a complete-row update

**File:** `tests/minimumWageHistory/mutation-contracts.spec.ts`

**Steps:**
  1. Inside test.describe.serial and only with shared-QA mutation authorization, fetch the latest complete row, retain it as the baseline, derive a distinct non-negative integer, edit only Subsidio alimentación, and click Guardar once while capturing POST /actions/grabar.
    - expect: The request identifies isNuevo=false and vigenciaOriginal equal to the selected vigencia.
    - expect: The row object deep-equals the complete fresh baseline with only ndSubsidioAlimentacion changed; do not hard-code user IDs, timestamps, or the supplied stale null value.
    - expect: The response succeeds and the exact success feedback is captured.
  2. Reload, re-fetch the latest row, and compare persistence; then repeat as an independent test iteration with a distinct decimal value using a dot.
    - expect: The persisted value equals the submitted integer or decimal and every other row field is unchanged.
    - expect: In finally, restore the complete original subsidy for the same vigencia, reload, and prove the full baseline row is restored.

#### 6.2. MWH-015: Zero is accepted and persisted as numeric zero

**File:** `tests/minimumWageHistory/mutation-contracts.spec.ts`

**Steps:**
  1. Capture the latest complete baseline row, set Subsidio alimentación to 0, and save once under the serial ownership and restoration rules.
    - expect: The normal save request contains numeric 0 rather than null or an empty string.
    - expect: A fresh rows/detail response persists numeric 0 and the list renders 0.
    - expect: Finally restoration returns the same vigencia to its complete captured baseline.

#### 6.3. MWH-016: Negative subsidy follows the server validation-error path without persistence

**File:** `tests/minimumWageHistory/mutation-contracts.spec.ts`

**Steps:**
  1. Capture the complete latest baseline, enter -1, and click Guardar once while observing both the normal save and /errores-reporte/actions/grabar endpoints.
    - expect: The error-report request is sent and no successful normal row update is accepted.
    - expect: The dialog title is Guardar and its message is El valor del subsidio de alimentacion debe se mayor o igual a cero (0).
    - expect: After reload, the complete latest row equals the baseline.
  2. Run failure-safe restoration in finally even if an unexpected normal save occurred.
    - expect: Only the captured latest vigencia is restored and a fresh response proves the full baseline row is intact.

### 7. Creation and deletion guards

**Seed:** `tests/minimumWageHistory/seed-test.spec.ts`

#### 7.1. MWH-017: An older vigencia cannot be created

**File:** `tests/minimumWageHistory/mutation-contracts.spec.ts`

**Steps:**
  1. With explicit shared-QA mutation authorization and inside the serial mutation suite, capture all baseline rows, click Nuevo, fill a vigencia lower than the runtime maximum plus valid numeric fields, and click Guardar once.
    - expect: The operation is rejected with title Guardar and message No se permite ingreso de vigencias anteriores a la ultima registrada.
    - expect: No new vigencia identity is present after reload and every complete baseline row remains unchanged.
    - expect: Any unexpected created identity is treated as a test failure and removed only if it is provably test-owned.

#### 7.2. MWH-018: Eliminar remains unavailable in supported list and detail states

**File:** `tests/minimumWageHistory/delete-guard.spec.ts`

**Steps:**
  1. Check Eliminar on the initial list, after selecting a prior row, after selecting the latest row, in prior-year detail, in latest-year detail, and in an untouched Nuevo form.
    - expect: Eliminar is disabled in every observed supported state.
    - expect: No delete endpoint request is sent.
    - expect: The test does not bypass the disabled control or attempt to delete shared QA data.
