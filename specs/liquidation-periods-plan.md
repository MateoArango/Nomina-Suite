# Liquidation Periods E2E Test Plan

## Application Overview

Plan the authenticated /periodos-liq module with stable data-testid locators, runtime API mapping, a dedicated LiquidationPeriodsPage, and the existing lightweight seed. Read-only QA exploration on 2026-08-28 confirmed that initial load calls /context and /lookups/dw-tipos-periodo but does not select a default or call /rows; M displays 30 and Q displays 15; selecting a type calls GET /w-periodos-liq/rows?tipoPeriodo=<type>; rows and inputs are keyed by kaNlPeriodo; page sizes are 10/25/50/100; size 10 persists across a Q-to-M switch; a true reload resets the blank type and size 25; persisted input elements expose no native min/max/step/maxlength/pattern/required constraints; and no bulk-delete controls exist. Runtime counts and values are observations only and must not be hard-coded. A client-only check also confirmed that Delete on an unsaved selected row sends no request and is a no-op. The supplied automation brief is requirements evidence, not a confirmed live mutation contract. Save/delete payloads, feedback, persisted invalid values, decimal conversion, and date-range behavior require explicit shared-QA mutation authorization before execution. All persistence scenarios must live in one serial spec because playwright.config.ts is fully parallel: derive unique disposable tuples from fresh rows, capture the created kaNlPeriodo, preserve baseline IDs, reload for every persistence assertion, and clean up only owned IDs in finally. Skip only unmet safe prerequisites or the specified skip-if-fixed validation gaps; hard behavior regression locks must fail on change.

## Test Scenarios

### 1. Initial state and period-type loading

**Seed:** `tests/liquidationPeriods/seed-test.spec.ts`

#### 1.1. LP-001: Initial load requires an explicit period type

**File:** `tests/liquidationPeriods/initial-state.spec.ts`

**Steps:**
  1. Open the authenticated liquidation-period route from a fresh browser state while observing module requests.
    - expect: The context and period-type lookup requests succeed.
    - expect: No rows request is sent before a type is selected.
    - expect: The type selector is blank, the grid has no rows, New/Save/Delete are disabled, page size 25 is selected, and the pager reports no records.
  2. Validate the runtime period-type lookup instead of hard-coding option order.
    - expect: The lookup contains M with 30 days and Q with 15 days.
    - expect: The visible choices map to those runtime records using stable option test IDs.

    **Implementation summary:** The test captures the initial context and lookup requests, asserts that no rows request is sent until a type is selected, and validates the runtime lookup values and stable test IDs without hard-coded assumptions about order or content.

#### 1.2. ✅ LP-002: Monthly and fortnightly selections load the matching runtime grid

**File:** `tests/liquidationPeriods/period-type-loading.spec.ts`

**Steps:**
  1. Start a rows-response wait, select monthly (M / visible value 30), and validate the response.
    - expect: Exactly one GET request is sent with tipoPeriodo=M and succeeds.
    - expect: Every returned record has the monthly type and a stable kaNlPeriodo identity.
  2. Map every visible persisted row to the monthly response by kaNlPeriodo.
    - expect: Row and input test IDs use the returned ID.
    - expect: Period, start date, and end date values match the API record, including null dates rendered as empty inputs.
    - expect: No fixed total, order, period value, or date is asserted.
  3. Repeat from a fresh state for fortnightly (Q / visible value 15).
    - expect: Exactly one GET request is sent with tipoPeriodo=Q and succeeds.
    - expect: Every returned record has the fortnightly type and every visible row maps to its runtime record by ID.

**Implementation summary:** The test captures exactly one runtime rows response for each period type, validates every record's `scDiasLiquidacion` and stable `kaNlPeriodo`, and maps the visible API slice by ID to the period and nullable date inputs without hard-coded totals, ordering, or values. Focused Chromium verification passed: 1 test.

#### 1.3. ✅ LP-003: Switching type replaces the grid without mixing identities

**File:** `tests/liquidationPeriods/period-type-switch.spec.ts`

**Steps:**
  1. Load one type, retain its response IDs, then switch to the other type after starting a new rows wait.
    - expect: The second request uses the newly selected type.
    - expect: Visible persisted IDs and values match only the second response; stale rows from the first response are absent.
    - expect: New and Save are enabled after a valid type loads; Delete remains disabled until a row is selected.
  2. Switch back and compare the fresh response with the remounted grid.
    - expect: The original type is requested again.
    - expect: The UI is rebuilt from the latest response rather than from stale client state.

**Implementation summary:** The test captures the runtime M, Q, and fresh M responses in sequence, maps each visible grid slice to its current response by `kaNlPeriodo`, proves identities unique to the previous type are removed, and verifies the enabled New/Save and disabled Delete states. Focused Chromium verification passed: 1 test.

### 2. Client-only row and selection behavior

**Seed:** `tests/liquidationPeriods/seed-test.spec.ts`

#### 2.1. LP-004: New appends one selected empty working row without a request

**File:** `tests/liquidationPeriods/client-state.spec.ts`

**Steps:**
  1. Select a runtime period type, record the baseline persisted IDs and network traffic, then click New once.
    - expect: No save, delete, or additional rows request is sent.
    - expect: Exactly one ID-less empty row is appended and selected.
    - expect: The pager total increases by one, Save and Delete are enabled, and all baseline persisted rows remain unchanged.
  2. Reload the page without saving.
    - expect: The type returns to blank, the grid is empty, and the client-only row is gone.
    - expect: No mutation request was sent.

#### 2.2. LP-005: Repeated New clicks append distinct client-only rows

**File:** `tests/liquidationPeriods/client-state.spec.ts`

**Steps:**
  1. Load a type and click New multiple times, one completed action at a time.
    - expect: Each completed click adds exactly one additional ID-less empty row.
    - expect: No backend request is sent by any New action.
    - expect: The paginator total and visible slice account for all working rows without changing persisted IDs.
  2. Reload without saving.
    - expect: All working rows are discarded and no mutation remains.

#### 2.3. LP-006: @bug Delete is a no-op for an unsaved selected row

**File:** `tests/liquidationPeriods/client-state.spec.ts`

**Steps:**
  1. Load a type, click New once, and observe the delete endpoint while clicking Delete on the selected unsaved row.
    - expect: Zero delete requests are sent.
    - expect: The unsaved row remains selected and present; current behavior is a client-side no-op.
    - expect: This is a hard regression lock: a behavior change fails for human review rather than self-skipping.
  2. Reload the page.
    - expect: The unsaved row disappears without persistence and baseline IDs remain unchanged.

#### 2.4. LP-007: Persisted-row selection enables only single-record deletion

**File:** `tests/liquidationPeriods/row-selection.spec.ts`

**Steps:**
  1. Load a type with at least one runtime record and select one row by kaNlPeriodo without clicking Delete.
    - expect: Exactly one row has selected state and Delete becomes enabled.
    - expect: Selection alone sends no mutation request.
  2. Inspect the complete module for multi-select or batch-delete controls.
    - expect: There are no checkboxes, select-all control, or delete-selected control.
    - expect: Only the single Delete action is available; no baseline record is deleted during this test.

### 3. Runtime-derived pagination

**Seed:** `tests/liquidationPeriods/seed-test.spec.ts`

#### 3.1. LP-008: Page sizes and navigation follow the current runtime total

**File:** `tests/liquidationPeriods/pagination.spec.ts`

**Steps:**
  1. Load a type and exercise page sizes 10, 25, 50, and 100 using stable test IDs.
    - expect: The selected size exposes aria-pressed=true.
    - expect: Visible IDs equal the correct runtime response slice and the pager summary is derived from the current total.
    - expect: No fixed QA count or row order is asserted beyond the API order returned for that run.
  2. For any size that produces multiple pages, navigate forward to the final page and back to the first.
    - expect: Previous is disabled only on the first page and Next only on the final page.
    - expect: Each page maps to the expected runtime ID slice.
    - expect: If runtime data cannot create a second page, only the navigation branch is skipped with a precise prerequisite reason.

#### 3.2. LP-009: Page size persists across a type switch and resets on reload

**File:** `tests/liquidationPeriods/pagination.spec.ts`

**Steps:**
  1. Choose a non-default page size, switch from one type to the other, and wait for the new rows response.
    - expect: The chosen page size remains selected after the type switch.
    - expect: The new grid range and visible count are recalculated from the new type's runtime total.
  2. Perform a true page reload.
    - expect: The type selector resets to blank, no rows request is sent until a new selection, and page size returns to 25.
    - expect: Transient page index, selection, and working-row state are cleared.

### 4. Serialized owned-record persistence contracts

**Seed:** `tests/liquidationPeriods/seed-test.spec.ts`

#### 4.1. LP-010: Save one valid owned period, prove persistence, and clean it up

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. In a serial suite, fetch fresh rows for one type, retain every baseline kaNlPeriodo, and derive a unique period/date tuple that is absent at mutation time.
    - expect: The candidate does not collide with any runtime tuple.
    - expect: If no safe candidate exists, the test skips before mutation with a precise reason.
    - expect: Shared-QA mutation execution requires explicit authorization for that run.
  2. Add and fill one working row, start save observation, and click Save exactly once.
    - expect: Capture the exact POST body and confirm whether Save submits the complete grid or only changed rows.
    - expect: The owned tuple and selected type are represented correctly, no baseline row is unintentionally changed, and the response succeeds.
    - expect: The exact supplied success-alert title and message are shown; these literals must be reconfirmed on the first authorized run.
  3. Perform a true reload, reselect the type, and capture a fresh rows response.
    - expect: Exactly one record matches the owned tuple.
    - expect: Its stable kaNlPeriodo and persisted values match the submission; the assertion does not rely on immediate DOM state, global totals, ordering, or fixed positions.
  4. In finally, reload first, select only the owned ID, capture one delete request, then reload and read rows again.
    - expect: The delete contract targets only the owned ID and excludes every baseline ID.
    - expect: The owned ID is absent afterward, all baseline IDs remain, and cleanup failure is visible.

#### 4.2. LP-011: @bug Save with no changes still sends a request

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Load a type, retain the complete baseline response, make no edits and add no rows, then click Save while observing the save endpoint.
    - expect: Exactly one save POST is sent even though the grid is unchanged.
    - expect: The exact request-body shape and current success feedback are asserted.
    - expect: This is a hard regression lock and requires explicit mutation authorization.
  2. Reload, reselect the type, and compare fresh rows by stable ID and complete values.
    - expect: Every baseline record remains unchanged and no new identity appears.
    - expect: A behavior change fails for review rather than self-skipping.

#### 4.3. LP-012: Delete removes exactly one test-owned persisted record

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Create one disposable period using the LP-010 ownership rules, reload, and locate it by captured kaNlPeriodo.
    - expect: The record exists exactly once and no baseline row is selected.
  2. Select the owned row and click Delete while capturing the request and any confirmation or feedback.
    - expect: Exactly one delete POST is sent.
    - expect: The observed payload targets only the owned record; there is no batch delete.
    - expect: Any confirmation and response contract are captured before final assertions are implemented.
  3. Reload and capture fresh rows in the test body and again in failure-safe cleanup.
    - expect: The owned ID is absent and all baseline IDs remain.
    - expect: Finally cleanup is idempotent and removes only the owned record if the primary delete did not complete.

### 5. Serialized field contracts and documented validation gaps

**Seed:** `tests/liquidationPeriods/seed-test.spec.ts`

#### 5.1. LP-013: Decimal period persists using the current integer conversion

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Create a uniquely identifiable working row with period 5.5 and valid dates, then save under the owned-record rules.
    - expect: The number input accepts the decimal during entry.
    - expect: Capture the exact outgoing representation and successful response.
  2. Reload and locate the owned record by stable ID or unique tuple.
    - expect: The persisted period is 5 according to the supplied expected contract; this is a direct assertion, not a bug skip.
    - expect: The owned record is removed in finally.

#### 5.2. LP-014: @bug Very long period input follows the current overflow or persistence contract

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Enter a 1000-character repeated-digit value in a uniquely identifiable working row and determine the user-visible input value before Save.
    - expect: No min, max, step, maxlength, or pattern constraint is assumed.
    - expect: If explicit input validation now rejects or safely truncates the value, self-skip with a message that the validation gap appears closed and a replacement rejection test is needed.
  2. If the value remains accepted, click Save once and capture the exact request, response, feedback, and fresh rows result.
    - expect: If it persists, assert the exact persisted representation by owned ID and clean it up.
    - expect: If the current server fails at an overflow/database layer rather than product validation, assert that exact non-success contract and prove no owned record persisted.
    - expect: Do not silently pass on any outcome.

#### 5.3. LP-015: @bug Negative period remains accepted until validation is added

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Create a uniquely identifiable row with period -5 and valid dates, then save and reload under the owned-record rules.
    - expect: If -5 is blocked or rejected by explicit validation, self-skip with a message that the gap appears closed and a rejection assertion should replace this bug test.
    - expect: Otherwise exactly one owned record persists with period -5.
  2. Delete the owned ID in finally.
    - expect: No baseline record is touched and the owned ID is absent from fresh rows.

#### 5.4. LP-016: @bug Invalid start date follows the current null-persistence contract

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Using user-like date entry only, attempt an impossible calendar start date on a uniquely identifiable row, then Save and reload.
    - expect: If the browser control or application now blocks the impossible date or the API rejects it through explicit validation, self-skip with a message that the gap appears closed.
    - expect: Do not use JavaScript to bypass native input behavior.
  2. When the current bug remains reproducible, locate the owned record after reload.
    - expect: The start date persisted as null according to the supplied contract while the remaining owned values identify the row.
    - expect: The owned ID is removed in finally.

#### 5.5. LP-017: @bug Invalid end date follows the current null-persistence contract

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Repeat the impossible-date workflow for the end-date field using a distinct owned tuple.
    - expect: If explicit validation blocks or rejects the value, self-skip with the same closed-gap guidance.
    - expect: Otherwise the save request and response are captured once.
  2. Reload and inspect the owned record.
    - expect: The end date persists as null if the documented bug remains.
    - expect: The exact owned ID is removed in finally without touching baseline data.

#### 5.6. LP-018: @bug End date earlier than start date is accepted

**File:** `tests/liquidationPeriods/mutation-contracts.spec.ts`

**Steps:**
  1. Create a uniquely identifiable row whose valid end date is earlier than its valid start date, then Save while observing client and server validation.
    - expect: Exactly one current save attempt is captured and no validation feedback blocks it according to the supplied contract.
    - expect: This is a hard regression lock, not a self-skipping invalid-input test.
  2. Reload, locate the owned record, and compare both dates.
    - expect: The reversed date range persists unchanged for the owned ID.
    - expect: If the behavior changes, the test fails for deliberate human review.
    - expect: The owned ID is removed in finally.
