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

    // 1. Capture the available catalog total and priority total.
    const initialAvailableRange = await prioritizationPage.readPagerRange(
      prioritizationPage.availablePagerSummary,
    );
    const initialPriorityRange = await prioritizationPage.readPagerRange(
      prioritizationPage.priorityPagerSummary,
    );
    const availableRowTestIds = await prioritizationPage
      .availableVisibleRows()
      .evaluateAll(visibleRows =>
        visibleRows.map(row => row.getAttribute("data-testid") ?? ""),
      );
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
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          ),
        )
        .toEqual(initialAvailableRange);

      // 8. Assert the priority total increased by one.
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.priorityPagerSummary,
          ),
        )
        .toEqual({
          start: initialPriorityRange.start,
          end: initialPriorityRange.end + 1,
          total: initialPriorityRange.total + 1,
        });

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
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        ),
      )
      .toEqual(initialAvailableRange);
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.priorityPagerSummary,
        ),
      )
      .toEqual(initialPriorityRange);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
