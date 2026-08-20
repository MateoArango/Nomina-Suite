# Occupational Risks E2E Test Plan

## Application Overview

Validate the Occupational Risks CRUD grid at /riesgos-profesionales using the authenticated fixture, stable data-testid locators from RiesgosProfesionalesPage, and runtime API data.

Current live evidence (2026-08-19): page load calls GET /api/v1/w-riesgos-profesionales/rows and GET /lookups/dddw-actividad-riesgo; editing calls GET /rows/{id}; the Code input exposes maxlength=3; Activity is read-only and selected through the side sheet; Delete Selected is disabled without a selection. The live snapshot had 20 risks and 980 activities, but these are observations only—tests must derive totals and records at runtime.

Mutation endpoints to verify during implementation:
- POST /api/v1/w-riesgos-profesionales/actions/grabar for create/edit.
- POST /api/v1/w-riesgos-profesionales/actions/borrar for deletion.

Execution and state rules:
1. All scenarios are independent and begin from a freshly loaded authenticated page.
2. Read-only, validation, modal-cancel, and main-cancel scenarios may run normally. Tests that create, edit, or delete shared QA data must run serially unless isolated data is available.
3. Never mutate or delete a pre-existing QA row. Generate an unused three-character code by comparing candidates with the runtime /rows response; retain returned IDs and clean up in test teardown.
4. Start response/request waits before the triggering action. Do not use fixed sleeps.
5. Re-read /rows after reload to prove persistence or absence. UI feedback alone is insufficient.
6. Cleanup must be ID-scoped, run even after assertion failure, and fail visibly if baseline state is not restored.
7. Use kaNlClase and kaNlActividad as stable identities. Do not identify rows by index, mutable totals, duplicated activity codes, or display text alone.
8. Keep exact current UI messages in implementation assertions after reconfirming them live. Assert stable API status/code/message fragments; do not lock tests to full Oracle stack traces.
9. The source observation that negative percentages are accepted describes current behavior, not the desired business rule. Confirm the product decision before making RP-012 a mandatory regression.
10. If a prerequisite cannot be met safely in shared QA, skip that scenario or branch with a precise reason instead of seeding unrelated data.
11. Do not execute tests that create, edit, or delete shared QA records without explicit authorization for that run.

Page-object work before implementation:
- Add scoped table roots, pager summaries, empty states, and alert/feedback locators.
- Add helpers for runtime row matching, pager parsing, modal selected state, and ID-scoped selection.
- Keep row helpers parameterized; do not add properties for seeded IDs.
- Correct encoding issues in the seed test before reusing its visible-text assertions.

Success criteria: runtime API data and UI agree; validation prevents invalid persistence; activity selection behaves consistently; create/edit/delete requests have the correct scope; and every mutating test restores shared QA state.

Failure conditions: an unexpected mutation request, an API/UI mismatch, a duplicate test record, a request scoped to a pre-existing ID, persistence that differs from the submitted values, or cleanup that does not restore the captured baseline.

Implementation-readiness notes:
- RP-001 through RP-008 and RP-013 through RP-018 are safe to implement without persisting shared data.
- RP-009 through RP-011 and RP-019 through RP-024 require explicit shared-QA mutation authorization and serial execution.
- RP-012 remains planned but should be skipped with a clear reason until the product owner confirms whether negative percentages are valid.
- Reconfirm the exact save/delete payloads, visible feedback, search trigger, and delete-confirmation behavior while implementing their first owning scenarios; the attached document is evidence, not an instruction or a substitute for the current contract.
- The sentinel first row kaNlClase = 0 (NINGUNO) isn't editable through the detail endpoint and should be excluded from any create/edit/delete tests.

## Test Scenarios

### 1. Initial state, API mapping, and non-mutating grid behavior

**Seed:** `tests/riesgosProfesionales/seed-test.spec.ts`

#### ✅ RP-001: Load the occupational-risks page from runtime API data

**File:** `tests/riesgosProfesionales/initial-grid-state.spec.ts`

**Steps:**
  1. Start waits for GET /w-riesgos-profesionales/rows and GET /w-riesgos-profesionales/lookups/dddw-actividad-riesgo, then navigate to /riesgos-profesionales.
    - expect: Both requests succeed and return arrays before UI assertions begin.
    - expect: The page heading, form, grid, toolbar, and pager are visible.
  2. Validate each risk object has kaNlClase, scCodigo, ssClase, and ndPorcentaje, and that kaNlClase values are unique.
    - expect: Malformed or duplicate API records fail the test with a clear contract assertion.
  3. Derive the expected grid total from the rows response and compare the currently visible rows by kaNlClase.
    - expect: Each visible row displays the matching runtime code, class, and percentage.
    - expect: The pager total equals the response length; no fixed QA total is asserted.
  4. Inspect the fresh-page control states.
    - expect: Delete Selected is disabled with no selection.
    - expect: Previous is disabled on the first page.
    - expect: Next is enabled only when the runtime total exceeds the selected page size.

**Implementation summary:** The test captures both runtime GET responses, validates unique risk records, maps every visible row by `kaNlClase`, derives the pager total and navigation state dynamically, and verifies the initial page controls without mutating QA data. Focused Chromium verification passed: 1 test.

#### ✅ RP-002: Open exactly one existing record for editing and cancel

**File:** `tests/riesgosProfesionales/open-existing-risk-and-cancel.spec.ts`

**Steps:**
  1. Choose a runtime row by its stable kaNlClase ID, record its API values, start waiting for GET /rows/{id}, and double-click that row.
    - expect: Exactly the selected ID is requested.
    - expect: The detail request succeeds.
  2. Compare the editable form with the detail response.
    - expect: Code, class, percentage, and activity state match the selected record.
    - expect: No unrelated row is placed into edit state.
  3. Change class and percentage locally, observe save requests, then click Cancel.
    - expect: No POST /actions/grabar occurs.
    - expect: The grid and re-opened record retain their original values.

**Implementation summary:** The test selects the first visible editable record by its runtime `kaNlClase`, proves that only its detail endpoint is requested, compares every form field with the detail response, cancels local class and percentage changes while capturing zero save requests, and verifies the original API, grid, and re-opened form values after reload. The sentinel `kaNlClase = 0` row is excluded because it is not editable through the detail endpoint. Focused Chromium verification passed: 1 test.

#### ✅ RP-003: New and Cancel reset unsaved form state

**File:** `tests/riesgosProfesionales/new-and-cancel-reset-form.spec.ts`

**Steps:**
  1. Open a runtime record, alter its fields without saving, then click New.
    - expect: The form switches to create mode.
    - expect: Code, class, and percentage are cleared and activity returns to its default state.
  2. Enter different unsaved create values and click Cancel while observing /actions/grabar.
    - expect: No save request occurs.
    - expect: The unsaved values are discarded.
  3. Re-open the original row.
    - expect: Its persisted values are unchanged.

**Implementation summary:** The test selects a visible editable record by its runtime `kaNlClase`, changes every form field without saving, and proves that New clears the form into its default create state. It then enters a second unsaved dataset, captures zero POST requests to `/actions/grabar` when Cancel is clicked, and re-opens the original row to verify its API, form, and grid values remain unchanged. Focused Chromium verification passed: 1 test.

#### ✅ RP-004: Main-grid page sizes and navigation boundaries

**File:** `tests/riesgosProfesionales/main-grid-pagination.spec.ts`

**Steps:**
  1. Capture the runtime rows response and exercise page sizes 10, 25, 50, and 100.
    - expect: For each size, the visible row count equals min(page size, remaining runtime records).
    - expect: The pager range and total are internally consistent.
  2. When the runtime total produces multiple pages, navigate forward to the last page and then back to the first.
    - expect: Page contents match the corresponding slice of API data.
    - expect: Previous is disabled only on the first page and Next only on the last page.
  3. If the runtime dataset cannot produce a second page for any available size, skip only the multi-page navigation branch with an explicit prerequisite reason.
    - expect: The page-size and first-page assertions still run.

**Implementation summary:** The test captures the runtime risks response, validates page sizes 10, 25, 50, and 100 against visible ID slices and pager ranges, and traverses every available page forward and backward while checking both navigation boundaries. Chromium Verification passed: 1 test.

#### ✅ RP-005: Individual selection controls Delete Selected without deleting data

**File:** `tests/riesgosProfesionales/grid-selection-state.spec.ts`

**Steps:**
  1. Select one runtime row by its ID-scoped checkbox.
    - expect: Only that checkbox becomes checked.
    - expect: Delete Selected becomes enabled.
  2. Select a second row when available, then deselect each row while observing /actions/borrar.
    - expect: Selection states remain independent.
    - expect: Delete Selected becomes disabled after the final deselection.
    - expect: No delete request occurs.

**Implementation summary:** The test derives deletable visible rows from positive runtime `kaNlClase` IDs, verifies independent one-row and two-row checkbox states, confirms Delete Selected is enabled until the final deselection, and captures zero requests to `/actions/borrar`. The page-object checkbox helper now targets the native input that owns the stable `data-testid`. Focused Chromium verification passed: 1 test.

### 2. Validation and backend error contracts

**Seed:** `tests/riesgosProfesionales/seed-test.spec.ts`

#### ✅ RP-006: Required fields block save in validation order

**File:** `tests/riesgosProfesionales/required-fields.spec.ts`

**Steps:**
  1. For each isolated case—missing code, missing class, and missing percentage—click New, fill all other required fields, start counting /actions/grabar requests, and click Save.
    - expect: The field-specific alert appears with the currently observed title and message.
    - expect: No save request is sent.
    - expect: No grid record is added.
  2. Dismiss each alert and reset with Cancel before the next case.
    - expect: Each case starts from a blank create form and is independent of the previous case.

**Implementation summary:** The test exercises the missing-code, missing-class, and missing-percentage branches independently, asserts the exact live `Riesgos` alert message for each branch, captures zero POST requests to `/actions/grabar`, verifies the visible grid count remains unchanged, and proves Cancel restores a blank form between cases. Focused Chromium verification passed: 1 test.

#### ✅ RP-007: Code input enforces its three-character UI boundary

**File:** `tests/riesgosProfesionales/code-length-boundary.spec.ts`

**Steps:**
  1. Click New and fill the Code input with four characters.
    - expect: The input retains at most three characters, matching the live maxlength=3 contract.
  2. Test empty, one-character, and three-character values without persisting data.
    - expect: One and three characters are accepted by the control.
    - expect: Empty code remains subject to the required-field validation.
    - expect: No save request is sent during this UI-boundary test.

**Implementation summary:** The test confirms the live `maxlength=3` attribute, types four characters through keyboard-style input and verifies truncation to three, exercises the empty, one-character, and three-character states, asserts the exact required-code validation feedback, and captures zero POST requests to `/actions/grabar`. Focused Chromium verification passed: 1 test.

#### ✅ RP-008: Duplicate code is rejected on create without adding a row

**File:** `tests/riesgosProfesionales/duplicate-code-create.spec.ts`

**Steps:**
  1. Read an existing code from the runtime rows response, click New, enter that exact code with otherwise valid fields, and start waiting for the save response.
    - expect: The duplicate attempt is tied to current QA data, not a hard-coded code.
  2. Click Save and capture both response and user-visible feedback.
    - expect: The request fails according to the current duplicate contract.
    - expect: Feedback communicates that the record already exists.
    - expect: The count of records with that code remains exactly one.
  3. Reload the page and re-read /rows.
    - expect: No duplicate row was persisted.

**Implementation summary:** The test selects a unique existing code from the runtime `/rows` response, submits it once in create mode with otherwise valid fields, and asserts the live duplicate contract: HTTP 409, response code `CONFLICT`, and the exact visible feedback `Ya existe un registro con esos datos.` It verifies the matching API record count remains one immediately after rejection and after a fresh reload. Focused Chromium verification passed: 1 test.

#### RP-009: Percentage accepted boundaries persist exactly

**File:** `tests/riesgosProfesionales/percentage-accepted-boundaries.spec.ts`

**Steps:**
  1. For each value 0, 0.522, and 99.999, choose an unused three-character code from the runtime dataset, create a disposable record, and capture POST /actions/grabar.
    - expect: The request succeeds.
    - expect: The saved percentage is represented numerically without unintended rounding.
  2. Reload and locate each created record from the refreshed rows response.
    - expect: Each value persists and the grid matches the API.
  3. Delete only the records created by this test and verify their IDs are absent after reload.
    - expect: Cleanup succeeds even if an assertion fails.
    - expect: No pre-existing record is deleted.

#### ✅ RP-010: Percentage above database precision is rejected without persistence

**File:** `tests/riesgosProfesionales/percentage-over-maximum.spec.ts`

**Steps:**
  1. Choose an unused runtime-safe code, click New, enter otherwise valid data with percentage 100, and start waiting for POST /actions/grabar.
    - expect: Exactly one save request is made.
  2. Submit and inspect the response plus visible error state.
    - expect: The response is non-success and currently expected to be 409 with code CONFLICT.
    - expect: The assertion checks the stable status/code and a concise business-relevant message fragment, not a full Oracle stack trace.
  3. Reload and query /rows for the attempted code.
    - expect: No record was persisted.

**Implementation summary:** The test derives an unused three-character code from the runtime `/rows` response, submits percentage 100 exactly once, and asserts the live rejection contract: HTTP 409, response code `CONFLICT`, the concise precision-error fragment, and the exact visible feedback `El porcentaje ingresado no puede ser superior al 100%`. It reloads from a response wait and verifies the attempted code is absent from the refreshed dataset. Focused Chromium verification passed: 1 test.

#### RP-011: Class length boundary distinguishes accepted data from current server failure

**File:** `tests/riesgosProfesionales/class-length-boundary.spec.ts`

**Steps:**
  1. Create a disposable record with a 50-character class value and a runtime-safe unused code.
    - expect: The save succeeds and the full 50-character value persists after reload.
  2. Attempt another create with a 51-character class value while capturing the save response and visible feedback.
    - expect: The record is not persisted.
    - expect: Document the currently observed non-success status; if it remains 503 with ORA-12899, assert only a stable 'value too large' fragment and record the 503/raw-database-message behavior as a product gap.
  3. Delete the accepted disposable record and verify cleanup.
    - expect: Only test-owned data is removed.

#### RP-012: Negative percentage captures observed behavior as a product contract decision

**File:** `tests/riesgosProfesionales/negative-percentage-contract.spec.ts`

**Steps:**
  1. Create a disposable record with percentage -10 using an unused three-character code and capture the save response.
    - expect: The test records whether the current application accepts or rejects the value; the source observation says it is currently accepted.
  2. If accepted, reload and verify -10 persisted; if rejected, assert the actual stable error contract.
    - expect: The automated assertion is aligned with the product owner's approved rule before this test is promoted to the required regression suite.
    - expect: Acceptance of a negative risk percentage is logged separately as a business-rule gap, not presented as desirable behavior.
  3. If the record was created, delete it by its returned/runtime ID and verify absence.
    - expect: Shared QA state is restored.

### 3. Activity lookup and modal behavior

**Seed:** `tests/riesgosProfesionales/seed-test.spec.ts`

#### ✅ RP-013: Activity modal loads and maps runtime lookup data

**File:** `tests/riesgosProfesionales/activity-modal-initial-state.spec.ts`

**Steps:**
  1. Start waiting for GET /lookups/dddw-actividad-riesgo, open the page, click New, and open the activity modal.
    - expect: The lookup succeeds before table assertions.
    - expect: The modal heading, search, table, page-size controls, Accept, Cancel, and Close are visible.
  2. Validate unique kaNlActividad IDs and compare visible rows by ID with scCodActividad and ssActividad from the response.
    - expect: Rendered activity data matches the runtime lookup response.
    - expect: The pager total is derived from the response; 980 is not hard-coded.
  3. Inspect the initial selection and close with Cancel.
    - expect: No activity is applied and the main activity field remains at its original/default value.

**Implementation summary:** The test captures the runtime activity lookup, validates unique `kaNlActividad` records, maps the visible rows to `scCodActividad` and `ssActividad`, derives the pager total dynamically, verifies the modal controls, and confirms Cancel leaves the original activity value unchanged. Focused Chromium verification passed: 1 test.

#### RP-014: Activity selection is single-select and Accept applies the latest choice

**File:** `tests/riesgosProfesionales/activity-single-select-accept.spec.ts`

**Steps:**
  1. Click New, open the modal, and choose two different runtime activity rows in sequence.
    - expect: Only the latest row has the selected state.
  2. Click Accept.
    - expect: The modal closes.
    - expect: The read-only main activity field shows the latest activity, not the first one.
  3. Click Cancel on the main form.
    - expect: No save request occurs and no record is created.

#### RP-015: Activity Cancel and Close discard a pending selection

**File:** `tests/riesgosProfesionales/activity-dismiss-selection.spec.ts`

**Steps:**
  1. Capture the main activity value, open the modal, select a different activity, and click modal Cancel.
    - expect: The modal closes and the main activity value is unchanged.
  2. Repeat with the Close control in the modal header.
    - expect: Close has the same discard behavior as Cancel.
    - expect: No save request occurs.

#### RP-016: Double-clicking an activity applies it directly

**File:** `tests/riesgosProfesionales/activity-double-click.spec.ts`

**Steps:**
  1. Click New, open the modal, and double-click one runtime activity row without clicking Accept.
    - expect: The modal closes immediately.
    - expect: The main activity field reflects the double-clicked activity.
  2. Cancel the main form.
    - expect: No record is persisted.

#### RP-017: Activity search handles matches, duplicates, and no-results

**File:** `tests/riesgosProfesionales/activity-search.spec.ts`

**Steps:**
  1. Derive a selective search term from the runtime lookup data, enter it in the modal search, and trigger search according to the current control behavior.
    - expect: Every visible result matches the term according to the app's search semantics.
    - expect: The pager range and filtered total are internally consistent.
  2. When duplicate displayed activity codes exist, verify rows remain distinguishable by kaNlActividad.
    - expect: Assertions never identify an activity only by duplicated scCodActividad or text.
  3. Search for a generated value absent from the lookup response.
    - expect: A clear empty result is shown, navigation controls reflect zero/one-page state, and Accept cannot apply a nonexistent activity.
  4. Clear search.
    - expect: The full runtime total and first-page results return.

### 4. CRUD persistence and safe deletion

**Seed:** `tests/riesgosProfesionales/seed-test.spec.ts`

#### RP-018: Create a complete record, verify persistence, and clean up

**File:** `tests/riesgosProfesionales/create-risk-with-activity.spec.ts`

**Steps:**
  1. Read /rows and deterministically choose an unused three-character code; select one activity by runtime kaNlActividad; record the baseline total.
    - expect: The test does not depend on hard-coded shared-QA records.
  2. Click New, fill valid code, class, and percentage, apply the selected activity, start waiting for POST /actions/grabar, and click Save once.
    - expect: Exactly one successful save request occurs.
    - expect: The request identifies create mode and contains the entered values plus selected activity ID according to the observed contract.
  3. Reload, re-read /rows, locate the record by its returned/runtime ID and code, then open its detail.
    - expect: The total increased by one.
    - expect: All fields, including activity, persisted.
  4. Delete only the created ID and reload.
    - expect: The disposable record is absent and the baseline total is restored.

#### RP-019: Save again without New updates the same record

**File:** `tests/riesgosProfesionales/repeated-save-updates-current-record.spec.ts`

**Steps:**
  1. Create one disposable record and retain its returned/runtime ID.
    - expect: The created record is uniquely identifiable.
  2. Without clicking New, change only its percentage and click Save once while capturing the request.
    - expect: The save targets the existing record rather than creating a second row.
  3. Reload and compare rows by ID and code.
    - expect: Exactly one matching row exists.
    - expect: Its percentage is updated and the total did not increase after the second save.
  4. Delete the disposable record and verify absence.
    - expect: Cleanup restores shared QA state.

#### RP-020: Edit with unchanged code persists other fields and can be restored

**File:** `tests/riesgosProfesionales/edit-risk-keeping-code.spec.ts`

**Steps:**
  1. Create a disposable record, reload, capture its complete persisted detail, and double-click its ID-scoped row.
    - expect: Edit mode loads the correct /rows/{id} response.
  2. Keep the code unchanged, modify class and percentage, save once, and reload.
    - expect: The save succeeds without a duplicate error.
    - expect: The same ID contains the new values.
  3. Restore the captured values or delete the disposable record, then verify the final state.
    - expect: The test leaves no mutation behind.

#### RP-021: Edit to another record's code is rejected without overwriting either row

**File:** `tests/riesgosProfesionales/edit-risk-to-duplicate-code.spec.ts`

**Steps:**
  1. Create two disposable records with distinct unused codes and capture both IDs and complete details.
    - expect: Both records exist and are owned by the test.
  2. Open the first record, replace its code with the second record's code, and save while capturing the response and feedback.
    - expect: The duplicate edit is rejected.
    - expect: No third row is created.
  3. Reload and compare both IDs with their captured details.
    - expect: Neither record was overwritten by the failed edit.
  4. Delete both test-owned records and verify absence.
    - expect: Cleanup is ID-scoped and complete.

#### RP-022: Delete one disposable record and verify request scope

**File:** `tests/riesgosProfesionales/delete-single-risk.spec.ts`

**Steps:**
  1. Create one disposable record, reload, and select only its ID-scoped checkbox.
    - expect: Only the test-owned row is selected and Delete Selected is enabled.
  2. Start waiting for POST /actions/borrar and click Delete Selected; handle a confirmation only if the current UI presents one.
    - expect: Exactly one delete request occurs.
    - expect: Its IDs payload contains only the disposable ID.
    - expect: The response succeeds.
  3. Reload and re-read /rows.
    - expect: The deleted ID is absent and all captured pre-existing IDs remain present.

#### RP-023: Delete multiple disposable records in one scoped operation

**File:** `tests/riesgosProfesionales/delete-multiple-risks.spec.ts`

**Steps:**
  1. Create at least two disposable records, retain their IDs, reload, and select only those ID-scoped checkboxes.
    - expect: No pre-existing row is selected.
  2. Start counting /actions/borrar requests and click Delete Selected; confirm only if prompted.
    - expect: One batched delete request is sent.
    - expect: Its IDs set equals the created IDs exactly, regardless of array order.
  3. Reload and compare /rows with the baseline.
    - expect: All disposable IDs are absent.
    - expect: Every baseline ID remains and the baseline total is restored.
