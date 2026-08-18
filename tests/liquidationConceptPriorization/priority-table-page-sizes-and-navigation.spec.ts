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
  test("PLC-009: Priority-table page sizes and navigation", async ({
    page,
  }) => {
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
    const expectedPriorityIds = rows
      .filter(
        (row): row is PrioritizedConcept & { kaNlOrden: number } =>
          row.kaNlOrden !== null,
      )
      .sort((first, second) => first.kaNlOrden - second.kaNlOrden)
      .map(row => String(row.kaNlConcepto));
    const priorityTotal = expectedPriorityIds.length;

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

    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.priorityPagerSummary,
        ),
      )
      .toMatchObject({ total: priorityTotal });

    test.skip(
      priorityTotal <= 10,
      "PLC-009 requires more than 10 persisted prioritized concepts",
    );

    // 1. Repeat the page-size, forward/back navigation, range, and boundary assertions from PLC-008, scoped to the priority table.
    await prioritizationPage.priorityPageSizeButton(10).click();
    await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(10);
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.priorityPagerSummary,
        ),
      )
      .toEqual({ start: 1, end: 10, total: priorityTotal });
    const firstPageIds = await readVisiblePriorityIds();
    expect(firstPageIds).toEqual(expectedPriorityIds.slice(0, 10));

    await prioritizationPage.priorityNextPageButton.click();
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.priorityPagerSummary,
        ),
      )
      .toEqual({
        start: 11,
        end: Math.min(20, priorityTotal),
        total: priorityTotal,
      });
    const secondPageIds = await readVisiblePriorityIds();
    expect(secondPageIds).toEqual(expectedPriorityIds.slice(10, 20));
    expect(secondPageIds).not.toEqual(firstPageIds);

    await prioritizationPage.priorityPreviousPageButton.click();
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.priorityPagerSummary,
        ),
      )
      .toEqual({ start: 1, end: 10, total: priorityTotal });
    await expect.poll(readVisiblePriorityIds).toEqual(firstPageIds);

    let previousSizeIds = firstPageIds;
    for (const pageSize of [25, 50, 100] as const) {
      await prioritizationPage.priorityPageSizeButton(pageSize).click();
      const expectedCount = Math.min(pageSize, priorityTotal);

      await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(
        expectedCount,
      );
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.priorityPagerSummary,
          ),
        )
        .toEqual({ start: 1, end: expectedCount, total: priorityTotal });
      const currentSizeIds = await readVisiblePriorityIds();
      expect(currentSizeIds).toEqual(expectedPriorityIds.slice(0, pageSize));
      expect(currentSizeIds.slice(0, previousSizeIds.length)).toEqual(
        previousSizeIds,
      );
      previousSizeIds = currentSizeIds;
    }

    await expect(prioritizationPage.priorityPreviousPageButton).toBeDisabled();

    const pagedPriorityIds: string[] = [];
    let priorityRange = await prioritizationPage.readPagerRange(
      prioritizationPage.priorityPagerSummary,
    );

    while (true) {
      pagedPriorityIds.push(...(await readVisiblePriorityIds()));

      if (priorityRange.end === priorityRange.total) {
        break;
      }

      const previousRange = priorityRange;
      await prioritizationPage.priorityNextPageButton.click();
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.priorityPagerSummary,
          ),
        )
        .not.toEqual(previousRange);
      priorityRange = await prioritizationPage.readPagerRange(
        prioritizationPage.priorityPagerSummary,
      );
    }

    expect(priorityRange).toEqual({
      start: Math.floor((priorityTotal - 1) / 100) * 100 + 1,
      end: priorityTotal,
      total: priorityTotal,
    });
    await expect(prioritizationPage.priorityVisibleRows()).toHaveCount(
      priorityTotal - priorityRange.start + 1,
    );
    await expect(prioritizationPage.priorityNextPageButton).toBeDisabled();
    expect(pagedPriorityIds).toEqual(expectedPriorityIds);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
