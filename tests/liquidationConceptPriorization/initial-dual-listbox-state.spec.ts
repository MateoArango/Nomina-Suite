// spec: specs/priorizacion-liq-conceptos-test-plan.md
// seed: tests/seed.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { PriorizacionLiqConceptosPage } from "../../pages/PriorizacionLiqConceptos.page";

type Concept = {
  kaNlConcepto: number;
  ssCodigo: string;
  ssConcepto: string | null;
  scSigno: string;
};

type PrioritizedConcept = Concept & {
  kaNlOrden: number | null;
};

const conceptsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/conceptos";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/rows";

function expectValidConcept(concept: Concept): void {
  expect(concept.kaNlConcepto).toEqual(expect.any(Number));
  expect(concept.ssCodigo).toEqual(expect.any(String));
  expect(
    concept.ssConcepto === null || typeof concept.ssConcepto === "string",
  ).toBe(true);
  expect(concept.scSigno).toEqual(expect.any(String));
}

test.describe("Liquidation Concept Prioritization", () => {
  test("PLC-001: Initial dual-listbox state and controls", async ({ page }) => {
    const prioritizationPage = new PriorizacionLiqConceptosPage(page);

    // 1. Start waiting for both documented page-load responses.
    const conceptsResponsePromise = page.waitForResponse(
      response => response.url() === conceptsUrl && response.request().method() === "GET",
    );
    const rowsResponsePromise = page.waitForResponse(
      response => response.url() === rowsUrl && response.request().method() === "GET",
    );

    // 2. Open the prioritization page.
    await page.goto("https://nomina-qa.adacsc.co/priorizacion-conceptos");
    await expect(page).toHaveURL(/\/priorizacion-conceptos/);

    // 3. Assert both requests use their documented endpoints and succeed.
    const [conceptsResponse, rowsResponse] = await Promise.all([
      conceptsResponsePromise,
      rowsResponsePromise,
    ]);
    expect(conceptsResponse.ok()).toBe(true);
    expect(rowsResponse.ok()).toBe(true);

    // 4. Validate that both responses are arrays with their documented fields and unique concept IDs.
    const concepts = (await conceptsResponse.json()) as Concept[];
    const rows = (await rowsResponse.json()) as PrioritizedConcept[];
    expect(Array.isArray(concepts)).toBe(true);
    expect(Array.isArray(rows)).toBe(true);
    expect(concepts.length).toBeGreaterThan(0);
    expect(rows.length).toBeGreaterThan(0);
    concepts.forEach(expectValidConcept);
    rows.forEach(row => {
      expectValidConcept(row);
      expect(row.kaNlOrden === null || Number.isInteger(row.kaNlOrden)).toBe(true);
    });
    expect(new Set(concepts.map(concept => concept.kaNlConcepto)).size).toBe(
      concepts.length,
    );
    expect(new Set(rows.map(row => row.kaNlConcepto)).size).toBe(rows.length);

    // 5. Assert both responses expose the same concept-ID set.
    const conceptIds = concepts.map(concept => concept.kaNlConcepto).sort((a, b) => a - b);
    const rowIds = rows.map(row => row.kaNlConcepto).sort((a, b) => a - b);
    expect(rowIds).toEqual(conceptIds);

    // 6. Derive the expected available total and ordered priority rows from the responses.
    const conceptsById = new Map(
      concepts.map(concept => [concept.kaNlConcepto, concept]),
    );
    const prioritizedRows = rows
      .filter((row): row is PrioritizedConcept & { kaNlOrden: number } =>
        row.kaNlOrden !== null,
      )
      .sort((a, b) => a.kaNlOrden - b.kaNlOrden);

    // 7. Assert both tables and both scoped pager summaries are visible.
    await expect(prioritizationPage.availableTable).toBeVisible();
    await expect(prioritizationPage.priorityTable).toBeVisible();
    await expect(prioritizationPage.availablePagerSummary).toBeVisible();
    await expect(prioritizationPage.priorityPagerSummary).toBeVisible();

    // 8. Assert the available total equals the concepts response-array length.
    const availableRange = await prioritizationPage.readPagerRange(
      prioritizationPage.availablePagerSummary,
    );
    expect(availableRange.total).toBe(concepts.length);

    // 9. Assert the priority total represents the non-null priority positions.
    const priorityRange = await prioritizationPage.readPagerRange(
      prioritizationPage.priorityPagerSummary,
    );
    if (prioritizedRows.length === 0) {
      // Current empty-state behavior: the placeholder is counted as one pager row.
      await expect(
        prioritizationPage.priorityTable.getByText("Sin conceptos priorizados"),
      ).toBeVisible();
      await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(0);
      expect(priorityRange).toEqual({ start: 1, end: 1, total: 1 });
    } else {
      expect(priorityRange.total).toBe(prioritizedRows.length);
    }

    // 10. Assert the visible available rows match their concepts response data.
    for (const row of await prioritizationPage.availableVisibleRows().all()) {
      const testId = await row.getAttribute("data-testid");
      const id = Number(testId?.split("--").at(-1));
      const concept = conceptsById.get(id);
      expect(concept, `Missing concept response data for row ${id}`).toBeDefined();
      await expect(row.locator("td")).toHaveText([
        concept!.ssCodigo,
        concept!.ssConcepto ?? "",
        concept!.scSigno,
      ]);
    }

    // 11. Assert visible priority rows follow ascending priority and match rows response data.
    const visiblePriorityRows = await prioritizationPage.priorityVisibleRows().all();
    for (const [index, row] of visiblePriorityRows.entries()) {
      const expectedRow = prioritizedRows[index];
      expect(expectedRow).toBeDefined();
      await expect(row).toHaveAttribute(
        "data-testid",
        `priorizacion-conceptos-priority-table-concept-row--${expectedRow!.kaNlConcepto}`,
      );
      await expect(row.locator("td")).toHaveText([
        String(expectedRow!.kaNlOrden),
        expectedRow!.ssCodigo,
        expectedRow!.ssConcepto ?? "",
        expectedRow!.scSigno,
      ]);
    }

    // 12. Assert all transfer and reorder buttons are disabled without a selection.
    await expect(prioritizationPage.assignButton).toBeDisabled();
    await expect(prioritizationPage.removeButton).toBeDisabled();
    await expect(prioritizationPage.moveUpButton).toBeDisabled();
    await expect(prioritizationPage.moveDownButton).toBeDisabled();

    // 13. Assert the save button is disabled with no pending changes.
    await expect(prioritizationPage.saveButton).toBeDisabled();

    // 14. Assert the cancel button is available.
    await expect(prioritizationPage.cancelButton).toBeEnabled();

    // 15. Verify both pager ranges are internally consistent with their totals.
    for (const range of [availableRange, priorityRange]) {
      expect(range.start).toBe(range.total === 0 ? 0 : 1);
      expect(range.end).toBeGreaterThanOrEqual(range.start);
      expect(range.end).toBeLessThanOrEqual(range.total);
    }
  });
});
