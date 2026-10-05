// spec: specs/priorizacion-liq-conceptos-test-plan.md
// seed: tests/seed.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { PriorizacionLiqConceptosPage } from "../../pages/PriorizacionLiqConceptos.page";

type PrioritizedConcept = {
  kaNlConcepto: number;
  kaNlOrden: number | null;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/rows";

test.describe("Liquidation Concept Prioritization", () => {
  test("PLC-005: Move a prioritized concept upward", async ({ page }) => {
    const prioritizationPage = new PriorizacionLiqConceptosPage(page);
    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/priorizacion-conceptos");
    await expect(page).toHaveURL(/\/priorizacion-conceptos/);

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);
    const rows = (await rowsResponse.json()) as PrioritizedConcept[];
    const initialPriorityTotal = rows.filter(
      row => row.kaNlOrden !== null,
    ).length;

    const readPriorityTotal = async (): Promise<number> => {
      const range = await prioritizationPage.readPagerRange(
        prioritizationPage.priorityPagerSummary,
      );

      if (range.start === 1 && range.end === 1 && range.total === 1) {
        return prioritizationPage.priorityVisibleRows().count();
      }

      return range.total;
    };

    const readAvailableTotal = async (): Promise<number> =>
      (
        await prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        )
      ).total;

    const readVisiblePriorityIds = async (): Promise<string[]> =>
      prioritizationPage.priorityVisibleRows().evaluateAll(priorityRows =>
        priorityRows.map(priorityRow => {
          const testId = priorityRow.getAttribute("data-testid");
          if (!testId) {
            throw new Error("Priority row is missing its data-testid");
          }

          return testId.split("--").at(-1)!;
        }),
      );

    await expect.poll(readAvailableTotal).toBe(rows.length);
    const initialAvailableTotal = await readAvailableTotal();
    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    test.skip(
      initialPriorityTotal < 2,
      "PLC-005 requires at least two persisted prioritized concepts",
    );

    await prioritizationPage.priorityPageSizeButton(100).click();

    // 1. Capture the visible ordered concept-ID array.
    await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(
      Math.min(initialPriorityTotal, 100),
    );
    const initialOrderedIds = await readVisiblePriorityIds();

    // 2. Record the selected concept ID and its preceding neighbor ID.
    const precedingConceptId = initialOrderedIds[0];
    const selectedConceptId = initialOrderedIds[1];
    expect(precedingConceptId).toBeDefined();
    expect(selectedConceptId).toBeDefined();
    const selectedRow = prioritizationPage.priorityConceptRow(selectedConceptId!);

    try {
      // 3. Select the concept and assert move-up is enabled.
      await selectedRow.click();
      await expect(prioritizationPage.moveUpButton).toBeEnabled();

      // 4. Click move-up once.
      await prioritizationPage.moveUpButton.click();

      // 5. Re-read the ordered ID array.
      const expectedOrderedIds = [...initialOrderedIds];
      [expectedOrderedIds[0], expectedOrderedIds[1]] = [
        expectedOrderedIds[1],
        expectedOrderedIds[0],
      ];
      await expect.poll(readVisiblePriorityIds).toEqual(expectedOrderedIds);
      const reorderedIds = await readVisiblePriorityIds();

      // 6. Assert the selected concept and preceding neighbor swapped positions.
      expect(reorderedIds[0]).toBe(selectedConceptId);
      expect(reorderedIds[1]).toBe(precedingConceptId);

      // 7. Assert every other visible concept retained its relative order.
      expect(reorderedIds.slice(2)).toEqual(initialOrderedIds.slice(2));

      // 8. Assert both list totals are unchanged.
      await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
      await expect.poll(readAvailableTotal).toBe(initialAvailableTotal);

      // 9. Assert save is enabled.
      await expect(prioritizationPage.saveButton).toBeEnabled();
    } finally {
      // 10. Cancel and verify the original order returns.
      if (await prioritizationPage.saveButton.isEnabled()) {
        await prioritizationPage.cancelButton.click();
      }
    }

    await expect.poll(readVisiblePriorityIds).toEqual(initialOrderedIds);
    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
