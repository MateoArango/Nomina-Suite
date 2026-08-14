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
  test("PLC-003: Assign a concept by double-click", async ({ page }) => {
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

    // 1. Capture its initial priority membership, the available catalog total, and the priority total.
    await expect
      .poll(async () =>
        (
          await prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          )
        ).total,
      )
      .toBe(rows.length);
    await expect
      .poll(async () =>
        (
          await prioritizationPage.readPagerRange(
            prioritizationPage.priorityPagerSummary,
          )
        ).total,
      )
      .toBe(initialPriorityIds.size);
    const initialAvailableRange = await prioritizationPage.readPagerRange(
      prioritizationPage.availablePagerSummary,
    );
    const initialPriorityRange = await prioritizationPage.readPagerRange(
      prioritizationPage.priorityPagerSummary,
    );
    expect(
      initialPriorityIds.size,
      "The API priority count must match the priority pager total",
    ).toBe(initialPriorityRange.total);

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
    await expect(availableRow).toHaveCount(1);
    await expect(priorityRow).toHaveCount(0);

    try {
      // 2. Double-click the available concept row.
      await availableRow.dblclick();

      // 3. Wait for the priority row to appear.
      await expect(priorityRow).toHaveCount(1);

      // 4. Assert the available row remains present and the available catalog total is unchanged.
      await expect(availableRow).toHaveCount(1);
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          ),
        )
        .toEqual(initialAvailableRange);

      // 5. Assert the priority total increased by exactly one.
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

      // 6. Assert the save button is enabled.
      await expect(prioritizationPage.saveButton).toBeEnabled();
    } finally {
      // 7. Cancel and verify restoration.
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
