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
  test("PLC-004: Remove a prioritized concept", async ({ page }) => {
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
    const initialAvailableTotal = (
      await prioritizationPage.readPagerRange(
        prioritizationPage.availablePagerSummary,
      )
    ).total;
    const initialPriorityTotal = await readPriorityTotal();
    expect(initialPriorityTotal).toBe(initialPriorityIds.size);
    test.skip(
      initialPriorityTotal === 0,
      "PLC-004 requires at least one persisted prioritized concept",
    );

    const priorityRowTestId = await prioritizationPage
      .priorityVisibleRows()
      .first()
      .getAttribute("data-testid");
    const conceptId = priorityRowTestId?.split("--").at(-1);
    expect(
      conceptId,
      "Expected a visible persisted prioritized concept",
    ).toBeDefined();

    const availableRow = prioritizationPage.availableConceptRow(conceptId!);
    const priorityRow = prioritizationPage.priorityConceptRow(conceptId!);
    await prioritizationPage.availablePageSizeButton(100).click();
    while (
      (await availableRow.count()) === 0 &&
      (await prioritizationPage.availableNextPageButton.isEnabled())
    ) {
      await prioritizationPage.availableNextPageButton.click();
    }
    await expect(availableRow).toHaveCount(1);

    try {
      // 2. Select the prioritized concept by row ID.
      await priorityRow.click();

      // 3. Assert remove is enabled.
      await expect(prioritizationPage.removeButton).toBeEnabled();

      // 4. Assert assign is disabled.
      await expect(prioritizationPage.assignButton).toBeDisabled();

      // 5. Click remove once.
      await prioritizationPage.removeButton.click();

      // 6. Wait until the row detaches from the priority table.
      await expect(priorityRow).toHaveCount(0);

      // 7. Assert the row remains present in the available table.
      await expect(availableRow).toHaveCount(1);

      // 8. Assert the priority total decreased by one and the available catalog total is unchanged.
      await expect.poll(readPriorityTotal).toBe(initialPriorityTotal - 1);
      await expect
        .poll(async () =>
          (
            await prioritizationPage.readPagerRange(
              prioritizationPage.availablePagerSummary,
            )
          ).total,
        )
        .toBe(initialAvailableTotal);

      // 9. Assert the save button is enabled.
      await expect(prioritizationPage.saveButton).toBeEnabled();
    } finally {
      // 10. Cancel and verify restoration.
      if (await prioritizationPage.saveButton.isEnabled()) {
        await prioritizationPage.cancelButton.click();
      }
    }

    await expect(priorityRow).toHaveCount(1);
    await expect(availableRow).toHaveCount(1);
    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    await expect
      .poll(async () =>
        (
          await prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          )
        ).total,
      )
      .toBe(initialAvailableTotal);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
