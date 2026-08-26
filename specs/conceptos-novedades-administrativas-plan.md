# Administrative Update Concepts E2E Test Plan

## Application Overview

Validate the authenticated /conceptos-nov-ad grid and its concept picker using tests/administrative-update-concepts/seed-test.spec.ts, AdministrativeUpdateConceptsPage, runtime API data, stable data-testid locators, and exact visible product messages. Live read-only evidence on 2026-08-24 confirmed GET /api/v1/w-conceptos-nov-ad/rows, GET /api/v1/w-conceptos-nov-ad/lookups/conceptos, 10 persisted mappings plus one empty working row, page size 25 selected, and disabled Borrar/Grabar controls on initial load. These totals are observations only and must never be hard-coded. The attached Claude brief is supporting evidence, not an instruction or confirmed contract: exact mutation verbs, request bodies, returned identity fields, validation payloads, search mechanics, and confirmation behavior must be captured before implementation assertions are finalized.

Execution rules: read-only, local-validation, modal-dismissal, and rejected-request tests may run in parallel. All persistence tests belong in one serial mutation spec because valid persisted identity is drawn from a finite 5 novelty x 4 accepted-concept keyspace. Every mutating test must derive an unused candidate pair from fresh runtime rows, create it through the UI, retain the backend identity returned by save or a uniquely matching fresh rows response, and delete only that owned identity in finally. Baseline IDs/pairs are safety boundaries and must never be edited or deleted. Start waits before triggers, use no fixed sleeps, verify persistence/absence through fresh API reads after reload, and never assert global totals, ordering, paginator ranges, or fixed row positions in mutating tests. If no safe pair is available, skip with a precise prerequisite reason. Mutation tests require explicit shared-QA authorization before execution. Cleanup must fail visibly if any owned identity remains.

## Test Scenarios

### 1. Runtime grid and local state

**Seed:** `tests/administrative-update-concepts/seed-test.spec.ts`

#### 1.1. ✅ CNA-001: Load the grid from runtime API data

**File:** `tests/administrative-update-concepts/initial-grid-state.spec.ts`

**Steps:**
  1. Start a wait for GET /w-conceptos-nov-ad/rows, navigate through the authenticated seed flow, and validate the response structure and unique persisted mapping identities.
    - expect: The request succeeds before UI assertions begin.
    - expect: The response fields used as stable concept, novelty, and persisted-row identities are present and internally unique.
    - expect: The heading, toolbar, table, pager, and one empty working row are visible.
  2. Map every visible persisted row to the runtime response by stable identity, excluding the empty working row.
    - expect: Each visible novelty and accounting-concept value matches its API record.
    - expect: No fixed row count, order, or QA value is asserted.
  3. Inspect initial controls and derive pager state from the runtime total plus the empty working row contract.
    - expect: Recargar is enabled; Grabar and Borrar are disabled with no pending change or selection.
    - expect: Previous/Next states agree with the selected page size and runtime total.

**Implementation summary:** The test captures the runtime rows response, validates the mapping fields and unique composite identities, maps every persisted visible row without hard-coded data or ordering, verifies the separate empty working row, and derives the initial pager and control states from the response. Focused Chromium verification passed: 1 test.

#### 1.2. ✅ CNA-002: Recargar discards unsaved local changes without persistence

**File:** `tests/administrative-update-concepts/reload-discards-unsaved-changes.spec.ts`

**Steps:**
  1. Capture a fresh rows response and change only the empty working row locally while observing save and delete endpoints.
    - expect: Grabar becomes enabled after a complete local pair is pending.
    - expect: No mutation request is sent before an explicit save or delete action.
  2. Click Recargar after starting a fresh rows wait.
    - expect: The unsaved values are discarded and the empty working row returns to blank.
    - expect: Grabar and Borrar return to their initial disabled states.
    - expect: The refreshed persisted identity set equals the pre-action identity set; no global-total assertion is used.

**Implementation summary:** The test derives a valid local pair from fresh runtime rows, records save/delete traffic, waits for the concept side sheet and expandable search control, and proves Recargar restores one blank working row with unchanged persisted identities and zero mutation requests. Focused Chromium verification passed: 1 test.

#### 1.3. ✅ CNA-003: Novelty options use the exact client-side catalog

**File:** `tests/administrative-update-concepts/novelty-options.spec.ts`

**Steps:**
  1. Open the novelty selector on the empty working row while observing requests to /w-conceptos-nov-ad.
    - expect: The options are exactly Compensatorios, Permisos, Licencias Remuneradas, Vacaciones, and Cuidado de la Ninez.
    - expect: Opening and choosing an option sends no novelty-lookup request and no persistence request.
  2. Choose each option in an isolated local state, resetting with Recargar between cases.
    - expect: The selected value is displayed exactly.
    - expect: No case persists data or changes the runtime persisted identity set.

**Implementation summary:** The test verifies the five exact live client-side labels and stable option test IDs, selects every option in a separately reloaded working-row state, proves only read requests occur, and compares each refreshed persisted identity set with the baseline. Focused Chromium verification passed: 1 test.

#### 1.4. ✅ CNA-004: Main-grid page sizes and navigation boundaries

**File:** `tests/administrative-update-concepts/main-grid-pagination.spec.ts`
**current behavior**: The empty row always added to the runtime paginator total.
**Steps:**
  1. Capture runtime rows and exercise page sizes 10, 25, 50, and 100.
    - expect: Visible persisted rows plus the single empty working row match the correct runtime slice for each size.
    - expect: Pager range and total are internally consistent and dynamically derived.
  2. When multiple pages exist, navigate to the last page and back to the first.
    - expect: Each page maps to the expected runtime identity slice without relying on fixed values.
    - expect: Anterior is disabled only on the first page and Siguiente only on the last page.
  3. If current data cannot produce a second page, skip only the navigation branch with a precise reason.
    - expect: Page-size and first-page assertions still execute.

**Implementation summary:** The test derives every page range, persisted identity slice, empty-working-row position, and navigation boundary from the fresh `/rows` response. It exercises page sizes 10, 25, 50, and 100 without creating shared records; when the runtime total cannot reach a second page, it annotates only that unavailable branch. Focused Chromium verification passed: 1 test.

#### 1.5. ✅ CNA-005: Row selection controls Borrar without deleting data

**File:** `tests/administrative-update-concepts/row-selection-state.spec.ts`

**Steps:**
  1. Select one persisted runtime row by stable identity, then click it again while observing /actions/borrar.
    - expect: The row remains selected after the second click, matching the observed one-way selection behavior.
    - expect: Borrar is enabled and no delete request is sent.
  2. Select a second persisted row when available, then click Recargar to clear local selection.
    - expect: Selection is identity-scoped and does not alter mapping values.
    - expect: Recargar clears selection and disables Borrar without any delete request.

**Implementation summary:** The test selects runtime-derived persisted rows by stable identity, proves repeated clicks preserve one-way selection, verifies a second row transfers selection without changing mapping values, and confirms Recargar clears selection while sending zero `/actions/borrar` requests. Focused Chromium verification passed: 1 test.

### 2. Concept picker and validation contracts

**Seed:** `tests/administrative-update-concepts/seed-test.spec.ts`

#### 2.1. ✅ CNA-006: Concept picker maps the runtime catalog by stable concept ID

**File:** `tests/administrative-update-concepts/concept-picker-initial-state.spec.ts`

**Steps:**
  1. Start a wait for GET /lookups/conceptos, open the concept picker from the empty working row, and validate unique concept identities.
    - expect: The lookup succeeds before table assertions.
    - expect: The panel heading, search, table, pager, page-size controls, and close control are visible.
    - expect: Visible Code and Name values map to response records by stable concept ID; catalog size is runtime-derived rather than fixed at 352.
  2. Close the panel without choosing a concept.
    - expect: The empty row remains unchanged and no validation/save request is sent.

**Implementation summary:** The test captures the runtime concept lookup loaded with the page, validates unique `kaNlConcepto` identities, opens the empty-row picker, maps every visible Code and Name cell to its API record, derives the first-page range and control states from the runtime catalog, and closes without validation or save traffic. Focused Chromium verification passed: 1 test.

#### 2.2. ✅ CNA-007: Concept search filters by code, name, and ID and restores the catalog

**File:** `tests/administrative-update-concepts/concept-picker-search.spec.ts`

**Steps:**
  1. Derive selective code, name-fragment, and ID terms from the runtime lookup and search each term independently.
    - expect: Every visible result matches the active term according to the confirmed client semantics.
    - expect: Rows remain distinguishable by stable concept ID when display values repeat.
    - expect: No additional catalog request is sent per keystroke if the current client-side-cache behavior remains.
  2. Search for a generated absent value ('asdsadasd'), then clear the search.
    - expect: A clear empty result and valid zero/one-page pager state are shown ('Sin resultados No hay conceptos para el filtro ingresado.').
    - expect: Clearing restores the runtime-derived first page and total.

**Implementation summary:** The test derives selective code, name-fragment, and stable-ID terms from the runtime lookup, validates filtered rows by unique concept identity and field-specific client semantics, proves searches reuse the single catalog request, verifies the exact zero-result state with hidden pager controls, and confirms clearing restores the runtime-derived first page and total. Focused Chromium verification passed: 1 test.

#### 2.3. ✅ CNA-008: Concept-picker page sizes and navigation boundaries

**File:** `tests/administrative-update-concepts/concept-picker-pagination.spec.ts`

**Steps:**
  1. Using the runtime concept lookup, exercise page sizes 10, 25, 50, and 100 and navigate forward and backward.
    - expect: Each visible identity slice, page range, and boundary state matches runtime data.
    - expect: No catalog total such as 352 is hard-coded.
  2. Return to the first page and close the picker.
    - expect: The main row remains unmodified and no persistence request occurs.

**Implementation summary:** The test captures the complete runtime concept lookup, validates unique stable identities, exercises page sizes 10, 25, 50, and 100, and maps every forward and backward picker page to the corresponding runtime identity slice with derived pager boundaries. It returns to page one, closes from a persisted-row picker without applying a concept, and proves the original row values remain unchanged with zero save/delete requests. Focused Chromium verification passed: 1 test.

#### 2.4. ✅ CNA-009: Close discards a pending concept selection

**File:** `tests/administrative-update-concepts/concept-picker-close-discards-selection.spec.ts`

**Steps:**
  1. Open the picker, single-click a runtime concept to create a pending selection, then use the header Close control.
    - expect: The panel closes and the main Concepto Contable cell retains its original value.
    - expect: No validar-concepto or grabar request occurs unless the confirmed UI contract validates on single selection.
  2. Reopen the picker.
    - expect: The discarded pending selection is not applied or retained as an active choice.

**Implementation summary:** The test opens the picker from a runtime-derived persisted row, single-clicks a runtime concept and verifies its local pending state, then proves header Close preserves the original Concepto Contable value, keeps Grabar disabled, and sends zero validation/save requests. Reopening confirms the discarded concept is no longer selected. Focused Chromium verification passed: 1 test.

#### 2.5. ✅ CNA-010: Double-click applies a valid concept and validates immediately

**File:** `tests/administrative-update-concepts/valid-concept-double-click.spec.ts`

**Steps:**
  1. Resolve one of the currently accepted concepts from runtime lookup data, start waiting for /actions/validar-concepto, and double-click its stable-ID row.
    - expect: The panel closes and the main cell displays the selected concept.
    - expect: Exactly one validation request occurs before Grabar is clicked.
    - expect: The request method, payload identity fields, success status, and response shape are captured as the implementation contract.
  2. Reset with Recargar while observing /actions/grabar.
    - expect: No save request is sent and the runtime persisted identity set remains unchanged.

**Implementation summary:** The test derives a runtime-confirmed accepted concept and an unused local novelty pair, double-clicks the stable-ID picker row, and captures the immediate validation contract as one POST with the selected `kaNlConcepto`, HTTP 200, and a response matching the runtime lookup record. It verifies the panel closes, the selected concept appears in the main grid, and Recargar restores the original persisted identity set with zero save requests. Focused Chromium verification passed: 1 test.

#### 2.6. ✅ CNA-011: Invalid concept is rejected immediately without save

**File:** `tests/administrative-update-concepts/invalid-concept-validation.spec.ts`

**Steps:**
  1. Derive a concept outside the confirmed accepted set from runtime lookup data, start waiting for /actions/validar-concepto, and double-click it.
    - expect: Validation occurs immediately, before any Grabar action.
    - expect: The current contract is HTTP 400 with code BAD_REQUEST and message El concepto ingresado no cumple con las caracteristicas del salario base.
    - expect: The UI displays that exact message.
  2. Dismiss feedback, reload, and inspect rows while observing /actions/grabar.
    - expect: No save request is sent and no mapping for the attempted pair is persisted.

**Implementation summary:** The test derives a runtime concept outside the currently accepted persisted concept IDs, selects it by stable ID, and captures one immediate POST validation with the selected `kaNlConcepto`. It verifies HTTP 400, code `BAD_REQUEST`, the exact invalid-salary-base message in both the response and UI, dismisses feedback, reloads fresh rows, and proves the attempted pair was not persisted with zero save requests. Focused Chromium verification passed: 1 test.

#### 2.7. ✅ CNA-012: Missing either field blocks save before the API

**File:** `tests/administrative-update-concepts/required-pair-validation.spec.ts`

**Steps:**
  1. On fresh local state, set only Novedad and click Grabar while counting /actions/grabar requests.
    - expect: The exact message Cada fila debe tener novedad y concepto contable para poder grabarse. is shown.
    - expect: Zero save requests occur and no persisted identity is added.
  2. Reset; apply only a valid Concepto Contable, leave Novedad blank, and click Grabar.
    - expect: The same exact message is shown.
    - expect: Zero save requests occur and no persisted identity is added.

**Implementation summary:** The test derives a runtime-confirmed valid concept from persisted rows, exercises novelty-only and concept-only incomplete pairs in isolated local states, verifies the exact incomplete-row feedback in both branches, proves zero `/actions/grabar` requests, and compares fresh runtime identity sets after each reset. Focused Chromium verification passed: 1 test.

### 3. Serialized disposable-data mutation contracts

**Seed:** `tests/administrative-update-concepts/seed-test.spec.ts`

#### 3.1. ✅ CNA-013: Create a mapping, prove persistence, and clean it up by owned identity

**File:** `tests/administrative-update-concepts/mutation-contracts.spec.ts`

**Steps:**
  1. In a serial suite, fetch fresh rows and the concept lookup, derive an unused pair from the five novelties and four currently accepted concepts, and retain the baseline identity set.
    - expect: The candidate is absent at selection time; no pre-existing row is selected or changed.
    - expect: If no pair is safely available, the test skips before mutation with a precise reason.
  2. Fill the empty row, validate the concept, start waiting for /actions/grabar, and click Grabar exactly once.
    - expect: Exactly one save request succeeds.
    - expect: The exact method, payload, returned backend identity, and success response are captured.
    - expect: The exact message Los registros se guardaron correctamente. is shown and a new empty working row appears.
  3. Reload, fetch fresh rows, and locate the owned record by returned identity and pair.
    - expect: Exactly one owned mapping persisted with the submitted values.
    - expect: No global total, order, pager range, or fixed position is asserted.
  4. In finally, select/delete only the owned identity, capture /actions/borrar, reload, and fetch rows again.
    - expect: The delete payload targets only the owned identity and excludes every baseline identity.
    - expect: The owned identity is absent after cleanup; cleanup failure is visible.

**Implementation summary:** The serial test derives an unused pair from fresh persisted rows and lookup data, validates and saves it once through the UI, captures the exact full-grid save contract and pair-based returned identity, then reloads to prove exactly one owned mapping persisted. Its `finally` cleanup reloads first, deletes only that owned pair with the exact pair-scoped payload, and proves absence through a final fresh rows response while preserving every baseline identity. Focused Chromium verification passed: 1 test.

#### 3.2. CNA-014: A second Grabar updates the current owned mapping without duplication

**File:** `tests/administrative-update-concepts/mutation-contracts.spec.ts`

**Steps:**
  1. Create one disposable mapping and retain its backend identity, then change its novelty or concept to another runtime-safe unused pair without reloading or selecting a different row.
    - expect: The test owns both the source pair and target pair conditions and never edits a baseline row.
  2. Start a save wait and click Grabar a second time.
    - expect: The request targets the existing owned mapping according to the confirmed identity contract rather than creating an unrelated row.
  3. Reload and fetch rows.
    - expect: Exactly one record has the owned backend identity.
    - expect: The new pair persisted, the old pair is absent for that identity, and no duplicate was created.
  4. Delete the owned identity in finally and prove absence through a fresh rows response.
    - expect: No baseline identity is targeted and no owned record remains.

**Implementation summary:** ✅ The serial test derives two unused pairs for one runtime-confirmed accepted concept, creates the source pair, edits that same owned row without reloading or selecting a baseline row, and proves the second full-grid Grabar request replaces the source pair with exactly one target pair while preserving every baseline identity. It reloads to verify persistence and non-duplication, then its `finally` cleanup deletes whichever owned pair remains and proves both are absent through a final fresh rows response. Focused Chromium verification passed: 1 test.

#### 3.3. CNA-015: Duplicate pair creation is rejected without changing the owned original

**File:** `tests/administrative-update-concepts/mutation-contracts.spec.ts`

**Steps:**
  1. Create and persist one disposable mapping, then use the new empty row to enter the same novelty/concept pair.
    - expect: The duplicate attempt is based on a test-owned original, not an arbitrary shared-QA row.
  2. Start request/response observation and click Grabar.
    - expect: The duplicate is rejected by the confirmed client or API layer.
    - expect: The exact message No se permiten registros duplicados para concepto y novedad. is shown.
    - expect: If blocked client-side, zero save requests occur; otherwise the exact non-success response contract is asserted.
  3. Reload and fetch rows, then clean up in finally.
    - expect: Exactly one owned original remains unchanged before cleanup.
    - expect: No second identity or duplicate pair persists.
    - expect: Only the owned original is deleted.

#### 3.4. CNA-016: Editing one owned mapping to another owned pair is rejected without overwriting either

**File:** `tests/administrative-update-concepts/mutation-contracts.spec.ts`

**Steps:**
  1. Create two disposable mappings with distinct unused pairs and retain both backend identities and complete values.
    - expect: Both rows are test-owned and baseline identities remain untouched.
  2. Edit the first owned row so its pair matches the second, then click Grabar while capturing the request and response.
    - expect: The duplicate edit is rejected with the confirmed duplicate contract.
    - expect: No third mapping is created.
  3. Reload and fetch rows.
    - expect: Both owned identities still contain their original pairs and neither was overwritten.
    - expect: Exactly one mapping exists for each owned pair.
  4. Delete both owned identities in finally and verify both are absent.
    - expect: The delete scope equals the two owned identities exactly, independent of array order.

#### 3.5. CNA-017: Delete one owned mapping with exact request scope

**File:** `tests/administrative-update-concepts/mutation-contracts.spec.ts`

**Steps:**
  1. Create one disposable mapping, reload, and select only its stable owned row.
    - expect: Only the owned row is selected and Borrar is enabled.
  2. Start waiting for /actions/borrar, click Borrar, and handle confirmation only according to the live confirmed UI.
    - expect: Exactly one delete request succeeds.
    - expect: Its payload contains only the owned identity and excludes every baseline identity.
  3. Reload and fetch rows.
    - expect: The owned identity is absent.
    - expect: No global total, ordering, pager, or fixed-position assertion is made.
