# Liquidation Concept Prioritization Test Plan

## Scope

Validate the dual-listbox behavior on `/priorizacion-conceptos`, including selection, assignment, removal, ordering, pagination, cancel, save, and persistence.

This plan uses the stable `data-testid` locators exposed by `PriorizacionLiqConceptosPage`. Row assertions must use the concept ID and row content, never a row index.

The available-concepts table is the catalog and source of truth. Assigning a concept adds it to the priority table but does not remove it from the available table or decrease the available total. Removing a priority assignment removes only the priority-table entry; the available catalog and its total remain unchanged.

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

### PLC-008: Selection changes the valid action set

**Priority:** P1

**Starting state:** No selection.

1. Assert all four transfer/reorder buttons are disabled.
2. Select an available concept and verify only assign is enabled.
3. Select a priority concept and verify remove is enabled and reorder buttons reflect its position.
4. Change the selected priority concept and verify button states update for the new position.
5. Clear or cancel the selection and verify all action buttons return to their default disabled state.

**Expected result:** Buttons always represent the currently selected row and list context.

### PLC-009: Available-table page sizes and navigation

**Priority:** P1

**Starting state:** Available total exceeds one page at size 10.

1. Select page size 10.
2. Assert at most 10 available rows are visible and the pager range is correct.
3. Navigate forward and assert the range and visible concept-ID array change.
4. Navigate backward and assert the first-page range and IDs return.
5. Repeat the visible-row and range assertions for sizes 25, 50, and 100.
6. Assert previous is disabled on the first page and next is disabled on the final page.

**Expected result:** Page-size and navigation controls display the correct subset without changing membership or order.

### PLC-010: Priority-table page sizes and navigation

**Priority:** P1

**Starting state:** Priority total exceeds one page at size 10.

1. Repeat the page-size, forward/back navigation, range, and boundary assertions from PLC-009, scoped to the priority table.
2. Verify the available-table page and page size are not changed by priority-table navigation.

**Expected result:** Priority pagination works independently from available pagination.

### PLC-011: Transfer updates pagination boundaries

**Priority:** P1

**Starting state:** Use a page size where at least one list has multiple pages.

1. Capture ranges, totals, current pages, and visible row counts for both tables.
2. Assign one available concept.
3. Assert the priority total increases by one and its range remains valid.
4. Assert the available catalog total, range, and current page remain unchanged.
5. Verify priority navigation-button states update if the assignment creates a page boundary.
6. Remove the same concept.
7. Assert the original priority total and valid page boundaries return while the available catalog remains unchanged.
8. Cancel any remaining changes.

**Expected result:** Priority pagination remains consistent as assignments change, while available-catalog pagination and total remain unchanged.

### PLC-012: Cancel discards membership and ordering changes

**Priority:** P0

**Starting state:** Capture initial membership, complete priority order, and totals.

1. Assign one available concept.
2. Reorder a non-boundary prioritized concept.
3. Remove a different prioritized concept.
4. Assert save is enabled.
5. Click cancel.
6. Verify the complete membership, priority order, totals, and disabled save state match the captured baseline.
7. Reload the page and verify the baseline still persists.

**Expected result:** Cancel discards every unsaved change, including transfers and ordering.

### PLC-013: Save and reload persist changes

**Priority:** P0

**Starting state:** Capture the complete initial membership and priority order for cleanup.

1. Make one deterministic assignment or removal and one deterministic reorder.
2. Assert save changed from disabled to enabled after the first mutation.
3. Start waiting for the save response, then click save.
4. Assert the request method, payload membership, and priority order match the UI state.
5. Assert the response is successful and success feedback appears.
6. Assert save returns to disabled or another explicit saved-state indicator appears.
7. Reload the page.
8. Verify the saved membership and complete priority order persist.
9. Restore the captured baseline, save it, reload, and verify restoration.

**Expected result:** Saved transfers and ordering survive reload, and cleanup restores shared QA data.

### PLC-014: Save failure preserves recoverable unsaved state

**Priority:** P1

**Starting state:** Intercept the documented save endpoint and force a server failure.

1. Make one reversible change.
2. Force the save request to return an error response.
3. Click save.
4. Assert error feedback is visible and success feedback is absent.
5. Assert the changed UI state remains available for retry or cancel.
6. Assert save remains enabled.
7. Remove the interception and cancel to restore the baseline.

**Expected result:** A failed save is reported accurately and does not falsely present the data as persisted.

### PLC-015: Rapid or repeated action does not duplicate a transfer

**Priority:** P2

**Starting state:** Choose one available concept.

1. Select the concept.
2. Trigger assign twice rapidly using the safest supported interaction.
3. Wait for the assignment to settle.
4. Assert the available catalog still contains exactly one matching row and the priority table contains exactly one.
5. Assert the available catalog total is unchanged and the priority total increased by exactly one.
6. Cancel and verify restoration.

**Expected result:** A concept cannot be duplicated by repeated user input.

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
