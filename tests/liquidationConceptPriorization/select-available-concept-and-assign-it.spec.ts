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
  test("PLC-002: Select an available concept and assign it", async ({ page }) => {
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
    const initialPriorityIds = new Set(
      rows
        .filter(row => row.kaNlOrden !== null)
        .map(row => String(row.kaNlConcepto)),
    );

    const readAvailableTotal = async (): Promise<number> =>
      (
        await prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        )
      ).total;

    const readPriorityTotal = async (): Promise<number> => {
      const range = await prioritizationPage.readPagerRange(
        prioritizationPage.priorityPagerSummary,
      );

      // The current UI reports 1-1 de 1 for both one row and the empty state.
      if (range.start === 1 && range.end === 1 && range.total === 1) {
        return prioritizationPage.priorityVisibleRows().count();
      }

      return range.total;
    };

    // 1. Capture the available catalog total and priority total.
    const initialAvailableTotal = rows.length;
    const initialPriorityTotal = initialPriorityIds.size;
    await expect.poll(readAvailableTotal).toBe(initialAvailableTotal);
    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    const availableRowTestIds = await prioritizationPage
      .availableVisibleRows()
      .evaluateAll(visibleRows =>
        visibleRows.map(row => row.getAttribute("data-testid") ?? ""),
      );
    expect(
      availableRowTestIds.length,
      "Expected visible available rows",
    ).toBeGreaterThan(0);
    const conceptId = availableRowTestIds
      .map(testId => testId.split("--").at(-1))
      .find(id => id !== undefined && !initialPriorityIds.has(id));
    expect(
      conceptId,
      "Expected a visible available concept absent from the priority table",
    ).toBeDefined();

    const availableRow = prioritizationPage.availableConceptRow(conceptId!);
    const priorityRow = prioritizationPage.priorityConceptRow(conceptId!);

    try {
      // 2. Select the available concept by its row ID.
      await availableRow.click();

      // 3. Assert assign is enabled and remove, move-up, and move-down remain disabled.
      await expect(prioritizationPage.assignButton).toBeEnabled();
      await expect(prioritizationPage.removeButton).toBeDisabled();
      await expect(prioritizationPage.moveUpButton).toBeDisabled();
      await expect(prioritizationPage.moveDownButton).toBeDisabled();

      // 4. Click assign once.
      await prioritizationPage.assignButton.click();

      // 5. Wait until the concept row appears in the priority table.
      await expect(priorityRow).toHaveCount(1);

      // 6. Assert the concept row remains present in the available table.
      await expect(availableRow).toHaveCount(1);

      // 7. Assert the available catalog total is unchanged.
      await expect.poll(readAvailableTotal).toBe(initialAvailableTotal);

      // 8. Assert the priority total increased by one.
      await expect.poll(readPriorityTotal).toBe(initialPriorityTotal + 1);

      // 9. Assert the save button is enabled.
      await expect(prioritizationPage.saveButton).toBeEnabled();
    } finally {
      // 10. Cancel the changes and verify the initial priority membership and totals return.
      if (await prioritizationPage.saveButton.isEnabled()) {
        await prioritizationPage.cancelButton.click();
      }
    }

    await expect(priorityRow).toHaveCount(0);
    await expect(availableRow).toHaveCount(1);
    await expect.poll(readAvailableTotal).toBe(initialAvailableTotal);
    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
