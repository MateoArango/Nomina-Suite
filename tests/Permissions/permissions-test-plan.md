# Permissions Test Plan

## Application Overview

Permissions leave-management test plan, prepared 2026-10-05.

Sources: tests/Permissions/Pseudo_Plan_Permissions.md; tests/Permissions/seed-test.spec.ts; pages/Permissions.page.ts; .github/agents/playwright-test-planner.agent.md.

## Generator instructions and evidence

- Write test prose and names in English. Quoted application messages below are literal assertion data, preserved from the supplied pseudo plan.
- Import test and expect from ../fixtures/auth.fixture and PermissionsPage from ../../pages/Permissions.page. Use the supplied seed for every suite. Each numbered scenario starts in a fresh authenticated browser context at /permisos with no selected employee; never depend on a preceding scenario.
- Reuse the POM. Scope duplicated test IDs to native button/input/mat-select controls; checkbox assertions target mat-checkbox input[type="checkbox"]. Description is a native text input, not a textarea.
- Planner setup executed the seed in Chromium successfully. Read-only discovery confirmed document lookup, history/detail GETs, approved action locks, new-form defaults, compensatory Yes forcing permission No, and employee selector requests. This is MCP setup/discovery evidence, not an independently executed test run. Planned cases are not implemented or marked complete.
- Document 98452583 (MetroParques Db) is a supplied discovery starting point, not a guaranteed fixture. Resolve employee identity, kaNlTercero, history IDs, names, dates and counts at runtime. Observed employee key 10236 and approved row 432 are examples only.
- New resets start date, end date and administrative-act date to the current application date (observed 05/10/2026), clears description and act number, and defaults compensatory No, permission Yes, approval No. Establish current application date at runtime; do not hard-code today's date.
- History has seven columns (approval, employee, start, end, description, compensatory, days), not the pseudo plan's five-column list. Runtime table ID: permisos-list-table; row ID template: permisos-table-row--{rowId}; history approval/compensatory wrappers: permisos-table-approved-checkbox--{rowId}, permisos-table-compensatory-checkbox--{rowId}. History pager IDs use permisos-list-pager-*.
- Approved details disable flag checkboxes, Save and Delete. Observed date, description and act inputs were still enabled. Do not claim every input is disabled: require persistence protection and document any editable-looking controls.
- Selector waits must use matching response completion and stable visible results/empty state, not fixed sleeps; a short inspection initially still showed its loading state. Use employeeSelectorVisibleRows because off-page rows can remain hidden in the DOM.
- Out of scope: contribution-base/IBC assertions and changing the third-party-type filter. Opening the selector may load the type lookup, which is not filter coverage.
- Every case includes message expectations. If no exact message was supplied/observed, the case explicitly requires capture before generation; never invent wording, substitute generic error assertions, or omit the case.
- Unless stated runtime-confirmed, literal validation messages are supplied pseudo-plan contracts awaiting runtime verification. Exact-match the message body within the visible error dialog, separately assert title "Error", and dismiss through its visible confirmation action. Preserve accents, punctuation and unaccented "Descripcion" where supplied. Register network waits before triggering actions.
- For rejection tests, isolate one invalid condition and fill all other required fields correctly; choose a verified conflict-free range except in collision cases. Capture the underlying validation request/response even if error-report telemetry also fires. Prove no successful record mutation and reload/read back the relevant employee history. A non-2xx response alone is insufficient.
- Shared-QA record creation, updates, approval and deletion are planning coverage only; this request does not authorize executing those mutations. Generator must obtain explicit mutation authorization or use a disposable test environment, one worker, retries=0, and minimal scope. Negative saves also need a controlled fixture because an unexpected acceptance could persist data. Do not create employee or other-module records to manufacture collisions.
- Tests needing absent records/conflicts must report the missing prerequisite explicitly. Use existing approved/unapproved records or controlled isolated fixtures; do not silently replace end-to-end coverage with mocked evidence. Each lifecycle test creates its own disposable record only when authorized and cleans it up; approval can prevent cleanup and requires a disposable environment or agreed restoration procedure.

## Network contracts

API prefix: /api/v1/w-vacaciones-licencias-ascensos-permisos.
Observed GET /empleados/by-nitsd/{document}; GET /rows?kaNlTercero={runtimeEmployeeKey}&limit=200&calamidad=N; GET /rows/{runtimeRowId}; GET /lookups/empleados?limit=2000&query={encodedQuery}.
Pseudo-plan GET /empleados/{runtimeEmployeeKey} must be verified when selecting an employee.
DELETE /rows/{runtimeRowId} is supplied, not executed in discovery.
IMPORTANT: /api/v1/errores-reporte/actions/grabar is automatic error-report telemetry. It fired after a failed employee lookup; its payload identified an HTTP 404 error. Its 200 response is NOT evidence of saving a permission. Capture the real permission create/update method, endpoint, payload field names and response before implementing lifecycle assertions; these remain unverified.
Display dates use DD/MM/YYYY. Verify the actual API date representation at the boundary rather than assuming display format or inventing payload fields.

## Boundaries and unresolved contracts

The supplied document limit is 18 digits and act-number limit is 19 digits, but numeric range and JavaScript precision can be stricter than character count. Preserve digit strings, inspect transmitted values, avoid Number conversion for long identifiers, and test rounding separately. A 19-digit number is not universally valid.
Missing messages requiring discovery: empty document search, end date before start date, malformed dates, whitespace-only description, invalid numeric signs/decimals, save/update/delete success and delete confirmation. Do not infer messages from adjacent validators.
Permission/compensatory accepted combinations from the source: (Yes,No), (No,No), (No,Yes). (Yes,Yes) must not be retained. Only Yes-compensatory -> No-permission was live-confirmed.


## Test Scenarios

### 1. Initial state and employee search

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 1.1. PER-001 — Fresh page and disabled record actions

**File:** `tests/Permissions/initial-state.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). No employee selected. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Check employeeDocumentInput is empty, historyEmptyTitle/historyEmptyMessage and detail controls are visible.
  3. Assert newButton, saveButton and deleteButton are disabled; initial flags are compensatory No, permission Yes and approval No.
  4. Assert the final UI and relevant network results.
    - expect: No selected employee or history row; the page is usable without a record.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Empty title "Sin permisos"; body "Busque o seleccione un empleado para consultar sus permisos." No error dialog.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.2. PER-002 — Search an existing employee by document

**File:** `tests/Permissions/search-existing-employee.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Resolve an existing employee document from lookup data; supplied 98452583 may be used only after confirming existence. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Arm the document lookup and history response waits, fill employeeDocumentInput and click employeeSearchButton.
  3. Read employee key/name from the response; match history request kaNlTercero, limit=200 and calamidad=N.
  4. Assert the final UI and relevant network results.
    - expect: Employee identity matches runtime response; displayed history belongs to that employee; New is enabled.
    - expect: Save/Delete state depends on the loaded record, not simply on successful lookup.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog. If this employee has empty history, verify its actual empty-state wording rather than assuming a populated table.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.3. PER-003 — Search with an empty document

**File:** `tests/Permissions/search-empty-document.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). No employee selected. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Leave employeeDocumentInput empty and click employeeSearchButton.
  3. Capture whether the UI validates locally or issues a request, and inspect its visible message.
  4. Assert the final UI and relevant network results.
    - expect: No employee is selected; record actions stay disabled; no unrelated history appears.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Exact empty-document message is not supplied: discover and record the actual dialog/inline wording before generation. Do not reuse the not-found or overflow message.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.4. PER-004 — Numeric document within stated length is not found

**File:** `tests/Permissions/search-not-found.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Use 984525831213934200 after confirming it remains absent. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill employeeDocumentInput with the 18-digit string and click Search with a lookup response wait registered.
  3. Assert GET lookup returns the not-found response and inspect the visible global error dialog.
  4. Assert the final UI and relevant network results.
    - expect: No valid employee is selected; actions remain disabled; distinguish lookup response from automatic error-report POST.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "Empleado no encontrado para nit=984525831213934200". Runtime-confirmed response and dialog. For another absent value interpolate the actual transmitted document.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.5. PER-005 — Document numeric overflow

**File:** `tests/Permissions/search-overflow.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). No selected employee. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill the supplied 19-digit string 9845258312139342000; verify the input and transmitted URL preserve the tested digits.
  3. Click Search and inspect the lookup failure and error dialog.
  4. Assert the final UI and relevant network results.
    - expect: Overflow does not select an employee; no save/delete is enabled.
    - expect: If browser/backend rounds the digits, record the discrepancy instead of silently changing the assertion.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body 'For input string: "9845258312139342000"'. Supplied contract, not live-verified.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.6. PER-006 — Document length and precision boundary

**File:** `tests/Permissions/search-document-boundary.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Resolve a valid short document and absent 18-digit numeric candidate. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Search valid short document, then independently search the 18-digit candidate and the supplied 19-digit overflow value; dismiss each dialog.
  3. Compare typed digits with requested URL and actual error interpolation; do not convert long values to JavaScript Number.
  4. Assert the final UI and relevant network results.
    - expect: 18 digits must reach lookup without an invented character-limit assertion; absence is distinct from overflow.
    - expect: Document numeric range and precision limitations explicitly.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Absent 18-digit sample: "Empleado no encontrado para nit=984525831213934200"; overflow sample: 'For input string: "9845258312139342000"', each under title "Error". Valid lookup has no error.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 1.7. PER-007 — Switch employees without stale history

**File:** `tests/Permissions/switch-employees.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Resolve two existing employees with distinguishable identity/history. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Search the first employee and read its history/key.
  3. Search the second employee and wait for its identity/history requests; inspect any selected detail.
  4. Assert the final UI and relevant network results.
    - expect: Second employee identity and history replace the first; selected row and actions correspond to the second employee.
    - expect: Do not hard-code counts or names.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog for either valid lookup; if the second employee has no history, capture and assert its actual empty-state text.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

### 2. Employee selector and history

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 2.1. PER-008 — Open and close employee selector

**File:** `tests/Permissions/selector-open-close.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Start without selected employee. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Click employeeSelectorOpenButton; wait for the current employee lookup response and stable panel content.
  3. Assert query input and table headers; close with employeeSelectorCloseButton and reopen.
  4. Assert the final UI and relevant network results.
    - expect: Opening/closing does not select an employee or mutate history; controls remain usable.
    - expect: Third-party-type filtering is excluded.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; do not confuse transient loading text with empty results.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.2. PER-009 — Search selector by document and name

**File:** `tests/Permissions/selector-query.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Resolve a lookup employee's runtime document and name. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Open selector and query by document; await the matching encoded query response and visible rows.
  3. Clear query and query by a distinctive name fragment; compare displayed matching rows with returned data.
  4. Assert the final UI and relevant network results.
    - expect: Only relevant visible results appear; latest query wins; runtime identity is stable.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog for matching queries; unexpected empty results fail the matching-query scenario.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.3. PER-010 — Selector no-results message and recovery

**File:** `tests/Permissions/selector-no-results.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Choose a unique query absent from lookup results. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Open selector; fill the absent query and await its completed response and final empty state.
  3. Assert empty messages, clear query and wait for results to return.
  4. Assert the final UI and relevant network results.
    - expect: No selectable matching row; clearing the query restores actual results without reloading the page.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Sin resultados"; body "No se encontraron empleados para la consulta actual." Supplied wording awaiting stable runtime verification. No error dialog.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.4. PER-011 — Select an employee from lookup

**File:** `tests/Permissions/selector-select-employee.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Resolve a visible employee ID/document/name from runtime lookup. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Open selector, query for that employee and use employeeSelectorRow(runtimeId) or employeeSelectorCell helpers.
  3. Register employee-detail and history response waits, click the visible row and inspect the selected identity.
  4. Assert the final UI and relevant network results.
    - expect: Panel closes; document/name and history match the selected employee.
    - expect: Verify supplied GET /empleados/{runtimeKey} and runtime history key rather than fixed example 11290.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; if selected employee has empty history, capture and assert its actual empty-state wording.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.5. PER-012 — Selector page size and navigation

**File:** `tests/Permissions/selector-pagination.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Lookup must contain more than one page for navigation branches. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Open selector and use employeeSelectorPageSizeButton for 10, 25, 50 and 100; compute expected visible counts from runtime total.
  3. For a small page size navigate Next then Previous; inspect summary, visible row identities and boundary-disabled buttons.
  4. Assert the final UI and relevant network results.
    - expect: Only visible rows count; hidden off-page rows are excluded; page-size and pager summary agree with total.
    - expect: State missing multi-page data explicitly.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; no empty-results message while current lookup has rows.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.6. PER-013 — Existing employee with no permission history

**File:** `tests/Permissions/history-empty.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee whose history response has zero rows. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Search/select that employee; wait for empty history response.
  3. Assert identity remains selected, inspect actual empty-state wording and enabled New action.
  4. Assert the final UI and relevant network results.
    - expect: No history row/detail from another employee remains; Delete is disabled; capture Save state for new versus no selected record.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Pseudo-plan empty title "Sin permisos" and body "Busque o seleccione un empleado para consultar sus permisos." Verify whether selected-employee empty state uses the same wording; record any difference. No error dialog.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.7. PER-014 — History columns and selected-row detail

**File:** `tests/Permissions/history-detail.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an employee with at least one permission row. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Verify seven history columns and disabled history status checkboxes; resolve row ID from response/test ID.
  3. Arm GET /rows/{runtimeRowId}, click the row and compare dates, description, act fields and flags with detail response.
  4. Assert the final UI and relevant network results.
    - expect: Rendered values match the selected row and its response; dates use DD/MM/YYYY.
    - expect: History status checkboxes are indicators, not direct mutation controls.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; record selection must not report a missing employee or unrelated validation.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 2.8. PER-015 — Permission history pagination

**File:** `tests/Permissions/history-pagination.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Employee must have enough existing history for multiple pages. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Locate runtime permisos-list-pager controls; exercise page sizes and Next/Previous.
  3. Assert runtime summary, visible row counts and first/last-page disabled controls.
  4. Assert the final UI and relevant network results.
    - expect: History belongs to the same employee through pagination; no duplicate/missing visible page identities; no mutation.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; if insufficient existing data, report prerequisite rather than create permission rows.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

### 3. New form, flags and required validation

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 3.1. PER-016 — New resets details and preserves employee

**File:** `tests/Permissions/new-resets-form.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an employee and inspect one existing record first. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Click New; inspect dates, description, act number and native flag checkboxes.
  3. Type an unsaved description/act and click New again without Save.
  4. Assert the final UI and relevant network results.
    - expect: Employee and existing history remain; date defaults use current application day, description/act clear, flags reset to No/Yes/No.
    - expect: Delete is disabled for unsaved draft; verify Save/New enabled state; no create request.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; any reset confirmation wording must be captured if encountered.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.2. PER-017 — Compensatory and permission transitions

**File:** `tests/Permissions/compensatory-permission-flags.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select employee and click New. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Check compensatory Yes; assert compensatory No clears and permission Yes clears/No checks.
  3. Exercise compensatory No and permission Yes/No explicitly; verify all three supplied permitted pairs.
  4. Attempt permission Yes after compensatory Yes and inspect resulting mutual exclusion without saving.
  5. Assert the final UI and relevant network results.
    - expect: Accepted source pairs: (compensatory Yes, permission No), (No,No), (No,Yes); never retain (Yes,Yes).
    - expect: One choice per group; preserve approval state. Only first transition is runtime-confirmed; remaining transitions require verification.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog for legal transitions. Any incompatibility message is unprovided: capture exactly if the UI uses a dialog instead of automatically enforcing the pair.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.3. PER-018 — Approval choices in an unsaved draft

**File:** `tests/Permissions/approval-draft-flags.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select employee and click New. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Check approval Yes and assert No clears; check No and assert Yes clears.
  3. Inspect Save/Delete and checkbox state after each change without saving.
  4. Assert the final UI and relevant network results.
    - expect: Each group has one selected choice; no persisted approval change occurs.
    - expect: Discover whether draft Yes changes action state; distinguish draft choice from an already approved persisted row.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog expected for toggling; capture any actual validation wording before asserting a different contract.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.4. PER-019 — Start date is required

**File:** `tests/Permissions/required-start-date.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill every other required value correctly; clear only startDateInput and blur to commit the empty value.
  3. Click Save; await the exact error dialog and underlying validation response if issued; dismiss once asserted.
  4. Assert the final UI and relevant network results.
    - expect: Target required-field validation rejects submission; no successful permission persistence occurs.
    - expect: After reload, history is unchanged and app remains usable.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; exact body "Debe ingresar la Fecha Desde.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.5. PER-020 — End date is required

**File:** `tests/Permissions/required-end-date.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill every other required value correctly; clear only endDateInput and blur to commit the empty value.
  3. Click Save; await the exact error dialog and underlying validation response if issued; dismiss once asserted.
  4. Assert the final UI and relevant network results.
    - expect: Target required-field validation rejects submission; no successful permission persistence occurs.
    - expect: After reload, history is unchanged and app remains usable.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; exact body "Debe ingresar la Fecha Hasta.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.6. PER-021 — Description is required

**File:** `tests/Permissions/required-description.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill every other required value correctly; clear only descriptionInput and blur to commit the empty value.
  3. Click Save; await the exact error dialog and underlying validation response if issued; dismiss once asserted.
  4. Assert the final UI and relevant network results.
    - expect: Target required-field validation rejects submission; no successful permission persistence occurs.
    - expect: After reload, history is unchanged and app remains usable.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; exact body "Debe ingresar la Descripcion.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.7. PER-022 — Administrative act is required despite no asterisk

**File:** `tests/Permissions/required-administrative-act.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill every other required value correctly; clear only administrativeActInput and blur to commit the empty value.
  3. Click Save; await the exact error dialog and underlying validation response if issued; dismiss once asserted.
  4. Assert the final UI and relevant network results.
    - expect: Target required-field validation rejects submission; no successful permission persistence occurs.
    - expect: After reload, history is unchanged and app remains usable.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; exact body "Debe ingresar el Acto Administrativo.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 3.8. PER-023 — Missing-field validation order

**File:** `tests/Permissions/required-validation-order.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select employee and click New; controlled negative fixture. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Clear all required date/text/act inputs, including auto-filled dates; leave groups at valid defaults.
  3. Save and capture the first error. Fill only its field and repeat until each documented required-field error is exposed; supply conflict-free values.
  4. Assert the final UI and relevant network results.
    - expect: Validation exposes one missing condition at a time; capture actual order rather than invent one.
    - expect: Stop before a valid final save; history is unchanged.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Supplied bodies: "Debe ingresar la Fecha Desde.", "Debe ingresar la Fecha Hasta.", "Debe ingresar la Descripcion.", "Debe ingresar el Acto Administrativo.", each titled "Error". Verify actual ordering.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

### 4. Dates, description and numeric boundaries

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 4.1. PER-024 — Date input and calendar behavior

**File:** `tests/Permissions/date-calendars.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select employee and click New; do not save. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use startDateCalendarButton, endDateCalendarButton and administrativeActDateCalendarButton separately to pick identifiable dates.
  3. Compare typed DD/MM/YYYY with calendar selection; dismiss calendar and change values via input.
  4. Assert the final UI and relevant network results.
    - expect: Each calendar updates only its own field; date values match selections; date inputs are limited to observed display format.
    - expect: No permission persistence.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog for valid dates; capture any inline date validation exactly if encountered.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.2. PER-025 — End date before start date

**File:** `tests/Permissions/end-before-start.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Set end date one day before start; keep act date <= start and other required values valid.
  3. Save and inspect client/backend rejection and visible message.
  4. Assert the final UI and relevant network results.
    - expect: Reversed range must not persist; unchanged history after reload.
    - expect: Exact ordering rule must be confirmed at runtime.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No supplied exact message: capture actual end-before-start dialog/inline wording before generation; never substitute the act-date error.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.3. PER-026 — Malformed and impossible dates

**File:** `tests/Permissions/invalid-date-input.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Independently enter an impossible date such as 31/02/2026 and malformed date text into each date input; blur.
  3. Inspect input normalization and inline errors; attempt Save only in the controlled fixture if enabled.
  4. Assert the final UI and relevant network results.
    - expect: Malformed required dates cannot persist; inspect actual field value before assuming entered text was accepted.
    - expect: Optional act-date invalidity is distinguished from its being empty.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Exact parse/impossible-date wording is unprovided: capture runtime text. If invalid text is normalized to empty, assert the actual required-date message only when that validator fires.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.4. PER-027 — Administrative act date after start

**File:** `tests/Permissions/act-date-after-start.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Set administrativeActDateInput to one day after startDateInput; leave end >= start.
  3. Save and assert the specific date relation error.
  4. Assert the final UI and relevant network results.
    - expect: Act date later than start is rejected; no successful persistence.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "La Fecha Acto debe ser menor o igual a la Fecha Desde." Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.5. PER-028 — Administrative act date equal to or before start

**File:** `tests/Permissions/act-date-allowed.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Use a disposable authorized environment; each subcase has its own fresh employee/form and unused conflict-free range. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. For separate independent runs set act date equal to start and before start, with all other values valid.
  3. Save; capture actual mutation request/response and reload details by returned ID.
  4. Assert the final UI and relevant network results.
    - expect: Both boundary values persist exactly and do not trigger act-date relation validation; clean up each disposable row.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No "La Fecha Acto debe ser menor o igual a la Fecha Desde." error. Exact success wording is unprovided: capture it before generation and assert persisted detail as primary success proof.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.6. PER-029 — Administrative act date is optional

**File:** `tests/Permissions/optional-act-date.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable fixture; independent fresh form with valid required values and unused range. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Clear administrativeActDateInput, blur and Save.
  3. Reload returned record and compare stored act date to captured payload/response.
  4. Assert the final UI and relevant network results.
    - expect: Save succeeds with omitted/empty act date under the source contract; do not assume how API represents absence; clean up owned row.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No act-date required error is supplied or expected. Success wording is unprovided and must be captured. If backend rejects omission, record the exact product discrepancy.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.7. PER-030 — Description accepts exactly 200 characters

**File:** `tests/Permissions/description-max-200.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable fixture; valid new form with unused date range. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Generate deterministic ASCII descriptions of 199 and 200 characters in separate independent runs; verify input length.
  3. Save and reload each created detail; compare complete stored strings and clean up owned rows.
  4. Assert the final UI and relevant network results.
    - expect: Both lengths persist unchanged; no truncation or unintended normalization.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No "scDescripcion debe tener máximo 200 caracteres" error. Capture exact success text before generation.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.8. PER-031 — Description rejects 201 characters

**File:** `tests/Permissions/description-over-200.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Fill descriptionInput with exactly 201 deterministic ASCII characters; verify DOM value length.
  3. Save and inspect visible validation and underlying response.
  4. Assert the final UI and relevant network results.
    - expect: No persisted oversized description; existing history unchanged; distinguish client prevention from backend rejection.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Supplied exact body "scDescripcion debe tener máximo 200 caracteres". Capture actual dialog title/wrapping and retain this field-specific body; do not replace with a generic maximum-length assertion.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.9. PER-032 — Whitespace-only description

**File:** `tests/Permissions/description-whitespace.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Enter spaces only in descriptionInput, blur and attempt Save under controlled conditions.
  3. Inspect trimming and exact validation response.
  4. Assert the final UI and relevant network results.
    - expect: Determine whether required validation rejects whitespace; document acceptance as a product gap if that occurs instead of inventing behavior.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Exact whitespace behavior unverified; if trimmed to empty, expected supplied body is "Debe ingresar la Descripcion." under "Error". Capture actual wording otherwise.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.10. PER-033 — Administrative act numeric range and precision

**File:** `tests/Permissions/act-number-boundary.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Controlled disposable fixture; each value tested independently with valid dates/description. Execution mode: Authorized mutation / controlled rejection.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Test a small safe integer, an exactly representable large integer, the supplied 19-digit example 1111111111111022200, and a value beyond supported range.
  3. Preserve string input and inspect transmitted/stored number digits; separate 19-digit length from signed-integer/backend range.
  4. For accepted values reload and compare precise stored value; clean up owned records. Rejecting values must not persist.
  5. Assert the final UI and relevant network results.
    - expect: Numeric limits are measured from real payload/response; precision loss is reported, not accepted silently.
    - expect: The observed existing 19-digit value is discovery evidence, not proof every 19-digit integer is valid.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: Rejected overflow supplied body template "Numeric value ({input value}) out of range" under "Error". Verify actual backend formatting/extra parser text and use actual transmitted value. Accepted values have no overflow error; success text must be captured.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 4.11. PER-034 — Act number signs, decimals and nonnumeric input

**File:** `tests/Permissions/act-number-invalid.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Select an existing employee and click newButton. Prepare a conflict-free range, nonempty description, valid small numeric act, optional act date <= start, compensatory No, permission Yes, approval No. Explicitly clear auto-filled dates when testing missing values. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Independently try negative, decimal and nonnumeric input; use native numeric-input-compatible interaction and inspect resulting value.
  3. Save only in controlled fixture; inspect actual validation/normalization.
  4. Assert the final UI and relevant network results.
    - expect: Record actual numeric contract and ensure no silent unintended act value is persisted.
    - expect: Do not assert unsupported positive/integer rules as verified facts.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No exact sign/decimal validation message supplied: discover it. If nonnumeric input becomes empty, assert "Debe ingresar el Acto Administrativo." only when that validator is actually shown.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

### 5. Collision rejection across modules

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 5.1. PER-035 — Overlap with existing permission or compensatory

**File:** `tests/Permissions/collision-permission.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing permission/compensatory range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered permission/compensatory interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing permission/compensatory record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "El empleado se encuentra en un permiso y/o compensatorio ya registrado en el rango indicado.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.2. PER-036 — Overlap with vacation

**File:** `tests/Permissions/collision-vacation.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing vacation range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered vacation interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing vacation record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "Existe un registro de vacaciones que se cruza con las fechas registradas.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.3. PER-037 — Overlap with incapacity

**File:** `tests/Permissions/collision-incapacity.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing incapacity range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered incapacity interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing incapacity record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "El empleado se encuentra en una incapacidad en el rango indicado.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.4. PER-038 — Overlap with absence or suspension

**File:** `tests/Permissions/collision-absence.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing absence/suspension range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered absence/suspension interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing absence/suspension record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "El empleado se encuentra en una ausencia/suspensión en el rango indicado.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.5. PER-039 — Overlap with ordinary leave

**File:** `tests/Permissions/collision-license.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing ordinary leave range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered ordinary leave interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing ordinary leave record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "El empleado se encuentra en una licencia en el rango indicado.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.6. PER-040 — Overlap with calamity leave

**File:** `tests/Permissions/collision-calamity.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing employee and existing calamity leave range without creating other-module data. Start fresh, select that employee and open New. Isolate this collision type; all other required fields must be valid. Execution mode: Controlled negative Save.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Use a candidate range that overlaps the discovered calamity leave interval; set act date <= start and valid description/act/flags.
  3. Register validation response capture, click Save and assert exact error; dismiss and reload history.
  4. Assert the final UI and relevant network results.
    - expect: Existing calamity leave record remains untouched; proposed permission is absent; no successful create/update.
    - expect: Repeat full containment and partial overlap as independent parameterized runs if suitable controlled data exists; do not rely on a preceding test.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Title "Error"; body "El empleado se encuentra en licencia de calamidad en el rango indicado.". Supplied contract awaiting runtime verification.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 5.7. PER-041 — Inclusive overlap boundaries and adjacent valid dates

**File:** `tests/Permissions/collision-boundaries.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Controlled fixture with one known existing permission/compensatory interval and no other conflicts; fresh form for each subcase. Execution mode: Authorized mutation / controlled rejection.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Test exact repeated range, candidate touching existing start, and candidate touching existing end independently.
  3. Test next-day and previous-day nonoverlapping ranges independently with authorized disposable records.
  4. Capture collision rule, dates, response and persistence for each case.
  5. Assert the final UI and relevant network results.
    - expect: Exact repeat is rejected; verify whether start/end boundary inclusion matches the source range rule.
    - expect: Adjacent nonconflicting ranges persist only under authorized execution and clean up owned rows.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: Exact repeat uses "El empleado se encuentra en un permiso y/o compensatorio ya registrado en el rango indicado." under "Error". Boundary inclusion beyond exact repeat requires verification; capture success wording for adjacent accepted ranges.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

### 6. Persistence, approved protection and deletion

**Seed:** `tests/Permissions/seed-test.spec.ts`

#### 6.1. PER-042 — Approved existing record cannot be saved or deleted

**File:** `tests/Permissions/approved-protection.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Discover an existing approved permission row; do not create/approve one for this read-only scenario. Execution mode: Read-only.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Select its runtime row and inspect detail response/approved flags.
  3. Assert Save/Delete disabled and flag checkboxes disabled; inspect actual date/text/act input enabled states without saving.
  4. Reload/reselect and compare persisted detail.
  5. Assert the final UI and relevant network results.
    - expect: Persisted approved record is protected; New remains available for the employee.
    - expect: Some date/text/act inputs were enabled during discovery: do not require all controls disabled or silently dismiss this discrepancy.
    - expect: No mutation request occurs.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error modal is needed for disabled actions; do not force-click them. Capture any actual protection message only if a supported UI interaction displays it.
    - expect: No permission record is created, updated or deleted.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.2. PER-043 — Create unapproved permission and prove persistence

**File:** `tests/Permissions/create-permission.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable fixture; fresh form with unused range and runtime employee key. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Enter valid dates/description/act, compensatory No, permission Yes, approval No; Save once.
  3. Capture actual permission mutation method/URL/payload/returned ID; reload history and selected detail.
  4. Compare all stored fields, employee identity and history row indicators; delete only this owned disposable row.
  5. Assert the final UI and relevant network results.
    - expect: Exactly one intended permission persists and reloads; telemetry 200 is never counted as save success.
    - expect: Save result/row belongs to runtime employee and date range; cleanup persistence is verified.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: No error dialog; exact success text is unprovided and must be captured. Include its literal wording in generated test context.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.3. PER-044 — Create compensatory record and prove flags persist

**File:** `tests/Permissions/create-compensatory.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable fixture; fresh valid form and unused range. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Check compensatory Yes; verify permission No and approval No; enter valid required values and Save.
  3. Reload history/detail by returned ID; assert compensatory/permission status and dates; clean up owned row.
  4. Assert the final UI and relevant network results.
    - expect: Compensatory Yes/permission No persists and matches history status indicator.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No collision/validation error; capture exact save success text before generation.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.4. PER-045 — Update an existing unapproved permission

**File:** `tests/Permissions/update-unapproved.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized existing editable fixture or independently created disposable unapproved row; snapshot original fields/ID. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Select row, change one permitted detail value with a unique description; keep dates/act/flags valid.
  3. Save once; capture update request; reload same row ID and compare fields.
  4. Restore agreed original data or remove only this test's owned row; read back restoration.
  5. Assert the final UI and relevant network results.
    - expect: Same record is updated, no duplicate row is created; unrelated employee/record fields remain unchanged.
    - expect: Original range must not falsely collide with the record itself when unchanged.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: No self-overlap error; exact update-success text must be captured. If self-overlap occurs, retain exact collision wording and report the product discrepancy.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.5. PER-046 — Administrative act number may be reused

**File:** `tests/Permissions/reused-administrative-act.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable environment; existing act number from runtime detail and a separate unused range. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Enter that existing valid act number on a new valid unapproved permission.
  3. Save and reload new row; verify exact act number and no uniqueness rejection; clean up owned row.
  4. Assert the final UI and relevant network results.
    - expect: Repeated act number is accepted under supplied source contract; no duplicate date range is used.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: No act-uniqueness error is supplied or expected. Capture exact save success or unexpected rejection wording.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.6. PER-047 — Persist approval then verify record locks

**File:** `tests/Permissions/approve-and-lock.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Disposable environment or explicit restoration agreement; create this test's independent unapproved row. Approval may prevent UI cleanup. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Select owned unapproved row, choose approval Yes and Save; discover exact approval persistence mechanism.
  3. Reload row/detail; inspect approved indicators, Save/Delete and flag states.
  4. Perform agreed fixture restoration outside locked UI if necessary and verify readback.
  5. Assert the final UI and relevant network results.
    - expect: Approval persists on the intended row; subsequent Save/Delete are disabled and no further UI mutation occurs.
    - expect: Do not reuse an unrelated shared approved record or require another test to create this fixture.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: Capture exact approval/save success text; no error for valid approval. If approval persistence is unsupported, retain actual message and report the contract gap.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.7. PER-048 — Cancel deletion preserves an unapproved record

**File:** `tests/Permissions/delete-cancel.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized disposable unapproved fixture; read and snapshot row ID/details. Execution mode: Authorized controlled deletion.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Select owned row; click Delete and inspect whether a confirmation dialog exists before any destructive confirmation.
  3. If confirmation exists, record exact title/body/button names and cancel; reload history/detail.
  4. Assert the final UI and relevant network results.
    - expect: Cancel leaves record intact; no DELETE mutation occurs.
    - expect: If Delete immediately dispatches without confirmation, report that behavior and do not fabricate a cancel flow; run only in disposable environment.
  5. Check message behavior and finish this scenario independently.
    - expect: Message contract: Confirmation title/body/action labels are unprovided: capture exact runtime text before generation. No success-deletion message after cancel.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.

#### 6.8. PER-049 — Delete an unapproved disposable record

**File:** `tests/Permissions/delete-unapproved.spec.ts`

**Steps:**
  1. Start a fresh authenticated context using the shared fixture, construct PermissionsPage and call goto(). Authorized environment; independently prepare this test's disposable unapproved permission row and capture ID. Execution mode: Authorized mutation.
    - expect: URL ends in /permisos; heading and search controls are ready; no state is inherited from another test.
  2. Select owned row and click Delete; confirm only if runtime UI requests confirmation.
  3. Wait for supplied DELETE /rows/{runtimeRowId}, verify response, reload employee history and confirm row absence.
  4. Verify no unrelated row disappeared and selected form/action state is reset appropriately.
  5. Assert the final UI and relevant network results.
    - expect: Only intended record is removed; reloading proves deletion; no hard-coded ID 441.
  6. Check message behavior and finish this scenario independently.
    - expect: Message contract: Capture exact delete confirmation and delete-success text before generation; no collision/approved-protection error is expected.
    - expect: Read back history/details after reload; rejected operations preserve the original records. Clean up only this test's disposable data when applicable.
    - expect: Failure conditions: incorrect message, incorrect field/action state, wrong employee or row, incorrect response/persistence, or unmet prerequisite. Report missing prerequisites explicitly; never treat them as passing coverage.
