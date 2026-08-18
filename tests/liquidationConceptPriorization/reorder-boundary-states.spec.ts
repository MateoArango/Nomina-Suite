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
  test("PLC-007: Reorder boundary states", async ({ page }) => {
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

    await expect.poll(readPriorityTotal).toBe(initialPriorityTotal);
    test.skip(
      initialPriorityTotal < 2,
      "PLC-007 requires at least two persisted prioritized concepts",
    );

    await prioritizationPage.priorityPageSizeButton(100).click();
    await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(
      Math.min(initialPriorityTotal, 100),
    );

    // 1. Select the first prioritized concept and assert both reorder buttons remain enabled.
    const firstPageIds = await readVisiblePriorityIds();
    const firstConceptId = firstPageIds[0];
    expect(firstConceptId).toBeDefined();
    await prioritizationPage.priorityConceptRow(firstConceptId!).click();
    await expect(prioritizationPage.moveUpButton).toBeEnabled();
    await expect(prioritizationPage.moveDownButton).toBeEnabled();

    // 2. Click move-up and verify the selected concept remains at index 0 and the ordered ID array is unchanged.
    await prioritizationPage.moveUpButton.click();
    await expect.poll(readVisiblePriorityIds).toEqual(firstPageIds);
    expect((await readVisiblePriorityIds()).indexOf(firstConceptId!)).toBe(0);
    await expect(prioritizationPage.saveButton).toBeDisabled();

    // 3. Navigate to the final priority page if necessary.
    let priorityRange = await prioritizationPage.readPagerRange(
      prioritizationPage.priorityPagerSummary,
    );
    while (priorityRange.end < priorityRange.total) {
      await prioritizationPage.priorityNextPageButton.click();
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.priorityPagerSummary,
          ),
        )
        .not.toEqual(priorityRange);
      priorityRange = await prioritizationPage.readPagerRange(
        prioritizationPage.priorityPagerSummary,
      );
    }

    // 4. Select the last prioritized concept and assert both reorder buttons remain enabled.
    const finalPageIds = await readVisiblePriorityIds();
    const lastIndex = finalPageIds.length - 1;
    const lastConceptId = finalPageIds[lastIndex];
    expect(lastConceptId).toBeDefined();
    await prioritizationPage.priorityConceptRow(lastConceptId!).click();
    await expect(prioritizationPage.moveUpButton).toBeEnabled();
    await expect(prioritizationPage.moveDownButton).toBeEnabled();

    // 5. Click move-down and verify the selected concept remains at the final index and the ordered ID array is unchanged.
    await prioritizationPage.moveDownButton.click();
    await expect.poll(readVisiblePriorityIds).toEqual(finalPageIds);
    expect((await readVisiblePriorityIds()).indexOf(lastConceptId!)).toBe(
      lastIndex,
    );

    // 6. Assert Save remains disabled because neither boundary action changed state.
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
