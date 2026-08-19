# Liquidation Concept Prioritization Test Plan

**Plan summary:** Validates concept assignment, removal, ordering, pagination, cancellation, saving, and persistence in the prioritization dual-listbox.

## Scope

Validate the dual-listbox behavior on `/priorizacion-conceptos`, including selection, assignment, removal, ordering, pagination, cancel, save, and persistence.

This plan uses the stable `data-testid` locators exposed by `PriorizacionLiqConceptosPage`. Row assertions must use the concept ID and row content, never a row index.

The available-concepts table is the catalog and source of truth. Assigning a concept adds it to the priority table but does not remove it from the available table or decrease the available total. Removing a priority assignment removes only the priority-table entry; the available catalog and its total remain unchanged.

## Test Summary

- **PLC-001:** Verifies API-backed initial data, table contents, totals, ordering, and default control states.
- **PLC-002:** Verifies button-based assignment and cancellation without changing the available catalog.
- **PLC-003:** Verifies double-click assignment adds one priority entry and can be canceled.
- **PLC-004:** Verifies removal affects only priority membership and cancel restores it.
- **PLC-005:** Verifies a prioritized concept moves up exactly one position.
- **PLC-006:** Verifies a prioritized concept moves down exactly one position.
- **PLC-007:** Verifies invalid first-item and last-item moves leave priority order unchanged.
- **PLC-008:** Verifies available-catalog pagination, page sizes, ranges, and navigation boundaries.
- **PLC-009:** Verifies priority-table pagination works independently from the available catalog.
- **PLC-010:** Verifies saving concept `1001`, persistence after reload, API data, and cleanup.

## Pre-rule for PLC-009

Before running PLC-009, assign and save enough records from the available table so that the priority table contains at least 11 persisted records. The available table remains unchanged because it is the source catalog. Eleven priority records are required to produce a second page when the page size is 10.

## Risk and State Management

This page edits shared prioritization data. Before implementing or running tests that save changes:

1. Capture the complete initial priority order as an array of concept IDs.
2. Capture the initial available and priority totals from both pager summaries.
3. Make each non-persistence scenario reversible with the cancel action.
4. For a save/persistence scenario, restore the captured order and membership in cleanup and save the restored state.
5. Run state-mutating scenarios serially unless each worker has isolated data.
6. Fail cleanup loudly if the original state cannot be restored.

The save request still needs to be observed and documented. Prefer API-backed setup and restoration if the discovered save contract safely supports it.

## Page-Load API Contract

Opening `/priorizacion-conceptos` requests:

1. `GET https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/conceptos`
2. `GET https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/rows`

The `/conceptos` response is the available-catalog source. It returns an array with:

- `kaNlConcepto`: unique concept ID used by the row `data-testid`.
- `ssCodigo`: displayed concept code.
- `ssConcepto`: displayed concept name.
- `scSigno`: displayed sign.

The `/rows` response returns the same concept fields plus:

- `kaNlOrden`: one-based priority position, or `null` when the concept is not prioritized.

Both supplied snapshots contain the same 352 unique concept IDs. In the `/rows` snapshot, ten concepts have unique contiguous priority positions from 1 through 10, and 342 have a `null` priority position. These counts describe the supplied snapshots only; tests must derive expected totals from the intercepted responses at runtime.

Page-load assertions must verify:

- Both requests occur after navigation and succeed before table assertions begin.
- Both responses contain unique concept IDs and expose the same concept-ID set.
- The available-table total equals the `/conceptos` response-array length.
- The priority-table total equals the number of `/rows` records where `kaNlOrden !== null`.
- Priority rows are ordered by ascending `kaNlOrden`.
- Each available row maps its ID, code, name, and sign to the corresponding `/conceptos` object.
- Each priority row maps to its corresponding non-null ordered `/rows` object.
- Assigning and removing priority membership changes only the client-side priority state until save; it does not remove entries from the `/conceptos` catalog.

## Page Object Updates Before Test Implementation

Add reusable locators and helpers to `PriorizacionLiqConceptosPage`:

- Available-table and priority-table roots.
- Pager summaries scoped to each table.
- Success feedback locator.
- Row selection helpers for each table.
- A helper that returns visible concept IDs in their current order.
- A helper that reads `{ start, end, total }` from a scoped pager summary.
- A helper that captures all priority IDs across pages without fixed delays.
- A helper that restores the original membership and order.

Keep concept-specific rows parameterized by ID. Do not add one property per seeded concept.

## Common Assertions

- Use `availableConceptRow(id)` and `priorityConceptRow(id)` for membership.
- After assignment, wait for the priority row count to become one and assert the available row remains present.
- After removal, wait for the priority row count to become zero and assert the available row remains present.
- Assert the available catalog total remains unchanged after assignment and removal.
- Assert transfer and reorder buttons with `toBeEnabled()` and `toBeDisabled()`.
- Assert pager totals before and after transfers.
- For reordering, compare the complete visible ID array before and after the action.
- Do not use `waitForTimeout()`.
- Scope cell and pager assertions to the relevant table or row.
- Assert the save button changes from disabled to enabled after the first successful mutation.

## Test Scenarios

### ✅ PLC-001: Initial dual-listbox state and controls

**Priority:** P0

**Starting state:** Page loaded with no row selected and no unsaved changes.

1. Start waiting for both documented page-load responses.
2. Open the prioritization page.
3. Assert both requests use their documented endpoints and succeed.
4. Validate that both responses are arrays with their documented fields and unique concept IDs.
5. Assert both responses expose the same concept-ID set.
6. Derive the expected available total from `/conceptos` and the ordered priority rows from `/rows`.
7. Assert both tables and both scoped pager summaries are visible.
8. Assert the available total equals the `/conceptos` response-array length.
9. Assert the priority total equals the number of non-null `kaNlOrden` values from `/rows`. When none exist, verify the empty-state row and its current `1-1 de 1` pager behavior.
10. Assert the visible available rows match their `/conceptos` data.
11. Assert the visible priority rows follow ascending `kaNlOrden` and match their `/rows` data.
12. Assert the assign, remove, move-up, and move-down buttons are disabled.
13. Assert the save button is disabled.
14. Assert the cancel button is available.
15. Verify the pager ranges are internally consistent with their totals.

**Expected result:** The available list represents `/conceptos`, the priority list represents ordered `/rows` records, no action is possible without a valid selection, and the page has no pending changes.

**Implementation note:** The test loops through the visible rows in both tables and compares each one with its matching API record. This validates the displayed code, concept, sign, priority position, and order without hardcoded records.

### ✅ PLC-002: Select an available concept and assign it

**Priority:** P0

**Starting state:** Choose at runtime a concept present in the available table and absent from the priority table.

1. Capture the available catalog total and priority total.
2. Select the available concept by its row ID.
3. Assert assign is enabled and remove, move-up, and move-down remain disabled.
4. Click assign once.
5. Wait until the concept row appears in the priority table.
6. Assert the concept row remains present in the available table.
7. Assert the available catalog total is unchanged.
8. Assert the priority total increased by one.
9. Assert the save button is enabled.
10. Cancel the changes and verify the initial priority membership and totals return.

**Expected result:** Exactly one priority assignment is added, the available catalog stays unchanged, and cancel restores the original priority state.

### ✅ PLC-003: Assign a concept by double-click

**Priority:** P1

**Starting state:** Choose at runtime a concept present only in the available table.

1. Capture its initial priority membership, the available catalog total, and the priority total.
2. Double-click the available concept row.
3. Wait for the priority row to appear.
4. Assert the available row remains present and the available catalog total is unchanged.
5. Assert the priority total increased by exactly one.
6. Assert the save button is enabled.
7. Cancel and verify restoration.

**Expected result:** Double-click adds the same single priority assignment as the assign button without changing or duplicating the available catalog entry.

### ✅ PLC-004: Remove a prioritized concept

**Priority:** P0
**Default:**The range always says for only one record or empty records 1-1 de 1
**Starting state:** Choose at runtime a concept present in both the available catalog and the priority table.

1. Capture the available catalog total and priority total.
2. Select the prioritized concept by row ID.
3. Assert remove is enabled.
4. Assert assign is disabled.
5. Click remove once.
6. Wait until the row detaches from the priority table.
7. Assert the row remains present in the available table.
8. Assert the priority total decreased by one and the available catalog total is unchanged.
9. Assert the save button is enabled.
10. Cancel and verify restoration.

**Expected result:** Exactly one priority assignment is removed, the available catalog stays unchanged, and cancel restores the assignment.

### ✅ PLC-005: Move a prioritized concept upward

**Priority:** P0

**Starting state:** Select a priority concept that has a visible preceding neighbor and is not the first item.

1. Capture the visible ordered concept-ID array.
2. Record the selected concept ID and its preceding neighbor ID.
3. Select the concept and assert move-up is enabled.
4. Click move-up once.
5. Re-read the ordered ID array.
6. Assert the selected concept and preceding neighbor swapped positions.
7. Assert every other visible concept retained its relative order.
8. Assert both list totals are unchanged.
9. Assert save is enabled.
10. Cancel and verify the original order returns.

**Expected result:** The selected concept moves up exactly one position and its neighbor moves down exactly one position.

### ✅ PLC-006: Move a prioritized concept downward

**Priority:** P0

**Starting state:** Select a priority concept that has a visible following neighbor and is not the last item.

1. Capture the visible ordered concept-ID array.
2. Record the selected concept ID and its following neighbor ID.
3. Select the concept and assert move-down is enabled.
4. Click move-down once.
5. Re-read the ordered ID array.
6. Assert the selected concept and following neighbor swapped positions.
7. Assert every other visible concept retained its relative order.
8. Assert both list totals are unchanged.
9. Cancel and verify the original order returns.

**Expected result:** The selected concept moves down exactly one position and its neighbor moves up exactly one position.

### ✅ PLC-007: Reorder boundary states

**Priority:** P1

**Starting state:** Priority list contains at least two concepts.

1. Select the first prioritized concept and assert both reorder buttons remain enabled.
2. Click move-up and verify the selected concept remains at index 0 and the ordered ID array is unchanged.
3. Navigate to the final priority page if necessary.
4. Select the last prioritized concept and assert both reorder buttons remain enabled.
5. Click move-down and verify the selected concept remains at the final index and the ordered ID array is unchanged.
6. Assert Save remains disabled because neither boundary action changed state.

**Current Behavior:** Reorder buttons remain enabled at both boundaries, but clicking the unavailable boundary action is silently ignored.
**Expected result:** Invalid boundary reordering leaves the selected concept at the same index, preserves the ordered ID array, and does not enable Save.


### PLC-008: Available-table page sizes and navigation

**Priority:** P1

**Starting state:** Available total exceeds one page at size 10.

1. Select page size 10.
2. Assert at most 10 available rows are visible and the pager range is correct.
3. Navigate forward and assert the range and visible concept-ID array change.
4. Navigate backward and assert the first-page range and IDs return.
5. Repeat the visible-row and range assertions for sizes 25, 50, and 100.
6. Assert previous is disabled on the first page and next is disabled on the final page.

**Expected result:** Page-size and navigation controls display the correct subset without changing membership or order.

### ✅ PLC-009: Priority-table page sizes and navigation

**Priority:** P1

**Starting state:** Priority total exceeds one page at size 10.

1. Repeat the page-size, forward/back navigation, range, and boundary assertions from PLC-008, scoped to the priority table.

**Expected result:** Priority pagination works independently from available pagination.

### ✅ PLC-010: Save and reload persist concept 1001

**Priority:** P0

**Starting state:** Concept `1001` (`SUELDO ORDINARIO ADMINISTRATIVO`) exists in the available catalog and is not prioritized. Capture its initial `/rows` membership before making changes.

1. Locate concept `1001` in the available table and assert its row displays `SUELDO ORDINARIO ADMINISTRATIVO`.
2. Double-click concept `1001` and assert it appears exactly once in the priority table.
3. Assert Save changes from disabled to enabled.
4. Start waiting for the prioritization save response, then click Save.
5. Assert the mutation request uses the documented method and endpoint and that its payload contains concept `1001` once with the priority order shown in the UI.
6. Assert the save response is successful and Save returns to disabled or another explicit saved-state indicator appears.
7. Reload the page and wait for a fresh `GET /rows` response.
8. Assert the response reports a non-null `kaNlOrden` for concept `1001`.
9. Navigate to the priority page containing concept `1001` and assert its persisted row displays the expected ID, name, and order.
10. In a `finally` block, if this test persisted concept `1001`, reload the current server state, remove only concept `1001`, save the cleanup, reload again, and assert `/rows` reports `kaNlOrden === null` for concept `1001`.

**Expected result:** Saving persists concept `1001` and its priority order across reload, the save API contract matches the UI state, and the `finally` cleanup restores concept `1001` to its original unprioritized state.

## Seed Test Refactoring Map

The recorded seed should be treated as discovery evidence, not retained as the final assertion structure.

- Replace direct test IDs with `PriorizacionLiqConceptosPage` properties and methods.
- Remove the unused `JuzgadosPage` import.
- Move authentication to a fixture or login page object and load credentials from environment configuration.
- Replace broad cell lookups with row-scoped assertions by concept ID.
- Replace partial pager text assertions with scoped parsed-total assertions.
- Replace visibility-only button checks with enabled/disabled assertions.
- Replace single-row reorder assertions with before/after array comparisons for both swapped rows.
- Remove the repeated page-size click unless it is retained as an explicit idempotency scenario.
- Add deterministic cleanup so the seed never leaves shared prioritization data changed.
- Keep tests serial until isolated setup and restoration are proven reliable.

## Exit Criteria

- All P0 scenarios pass in Chromium without retries.
- No fixed timeout is used.
- Every saved mutation is restored and verified.
- Tests use stable row IDs and scoped table assertions.
- Transfer totals and complete reorder results are asserted.
- The documented page-load contract is asserted, and the save contract is documented before its scenarios are implemented.
