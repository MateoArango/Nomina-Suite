// spec: specs/priorizacion-liq-conceptos-test-plan.md
// seed: tests/seed.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { PriorizacionLiqConceptosPage } from "../../pages/PriorizacionLiqConceptos.page";

type PrioritizedConcept = {
  kaNlConcepto: number;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/rows";

test.describe("Liquidation Concept Prioritization", () => {
  test("PLC-008: Available-table page sizes and navigation", async ({
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
    const expectedAvailableIdSet = new Set(
      rows.map(row => String(row.kaNlConcepto)),
    );
    const availableTotal = expectedAvailableIdSet.size;

    const readVisibleAvailableIds = async (): Promise<string[]> =>
      prioritizationPage.availableVisibleRows().evaluateAll(availableRows =>
        availableRows.map(availableRow => {
          const testId = availableRow.getAttribute("data-testid");
          if (!testId) {
            throw new Error("Available row is missing its data-testid");
          }

          return testId.split("--").at(-1)!;
        }),
      );

    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        ),
      )
      .toMatchObject({ total: availableTotal });

    test.skip(
      availableTotal <= 10,
      "PLC-008 requires more than 10 available concepts",
    );

    // 1. Select page size 10.
    await prioritizationPage.availablePageSizeButton(10).click();

    // 2. Assert at most 10 available rows are visible and the pager range is correct.
    await expect(prioritizationPage.availableVisibleRows()).toHaveCount(10);
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        ),
      )
      .toEqual({ start: 1, end: 10, total: availableTotal });
    const firstPageIds = await readVisibleAvailableIds();
    expect(firstPageIds.every(id => expectedAvailableIdSet.has(id))).toBe(true);

    // 3. Navigate forward and assert the range and visible concept-ID array change.
    await prioritizationPage.availableNextPageButton.click();
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        ),
      )
      .toEqual({
        start: 11,
        end: Math.min(20, availableTotal),
        total: availableTotal,
      });
    const secondPageIds = await readVisibleAvailableIds();
    expect(secondPageIds.every(id => expectedAvailableIdSet.has(id))).toBe(true);
    expect(secondPageIds).not.toEqual(firstPageIds);

    // 4. Navigate backward and assert the first-page range and IDs return.
    await prioritizationPage.availablePreviousPageButton.click();
    await expect
      .poll(async () =>
        prioritizationPage.readPagerRange(
          prioritizationPage.availablePagerSummary,
        ),
      )
      .toEqual({ start: 1, end: 10, total: availableTotal });
    await expect.poll(readVisibleAvailableIds).toEqual(firstPageIds);

    // 5. Repeat the visible-row and range assertions for sizes 25, 50, and 100.
    let previousSizeIds = firstPageIds;
    for (const pageSize of [25, 50, 100] as const) {
      await prioritizationPage.availablePageSizeButton(pageSize).click();
      const expectedCount = Math.min(pageSize, availableTotal);

      await expect(prioritizationPage.availableVisibleRows()).toHaveCount(
        expectedCount,
      );
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          ),
        )
        .toEqual({
          start: 1,
          end: expectedCount,
          total: availableTotal,
        });
      const currentSizeIds = await readVisibleAvailableIds();
      expect(currentSizeIds.slice(0, previousSizeIds.length)).toEqual(
        previousSizeIds,
      );
      expect(currentSizeIds.every(id => expectedAvailableIdSet.has(id))).toBe(
        true,
      );
      previousSizeIds = currentSizeIds;
    }

    // 6. Assert previous is disabled on the first page and next is disabled on the final page.
    await expect(prioritizationPage.availablePreviousPageButton).toBeDisabled();

    const pagedAvailableIds: string[] = [];
    let availableRange = await prioritizationPage.readPagerRange(
      prioritizationPage.availablePagerSummary,
    );

    while (true) {
      pagedAvailableIds.push(...(await readVisibleAvailableIds()));

      if (availableRange.end === availableRange.total) {
        break;
      }

      const previousRange = availableRange;
      await prioritizationPage.availableNextPageButton.click();
      await expect
        .poll(async () =>
          prioritizationPage.readPagerRange(
            prioritizationPage.availablePagerSummary,
          ),
        )
        .not.toEqual(previousRange);
      availableRange = await prioritizationPage.readPagerRange(
        prioritizationPage.availablePagerSummary,
      );
    }

    expect(availableRange).toEqual({
      start: Math.floor((availableTotal - 1) / 100) * 100 + 1,
      end: availableTotal,
      total: availableTotal,
    });
    await expect(prioritizationPage.availableVisibleRows()).toHaveCount(
      availableTotal - availableRange.start + 1,
    );
    await expect(prioritizationPage.availableNextPageButton).toBeDisabled();
    expect(pagedAvailableIds).toHaveLength(availableTotal);
    expect(new Set(pagedAvailableIds)).toEqual(expectedAvailableIdSet);
    await expect(prioritizationPage.saveButton).toBeDisabled();
  });
});
