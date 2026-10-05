// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const rowsPath = "/api/v1/w-mae-historico-salario-minimo/rows";
const pageSizes = [10, 25, 50, 100] as const;

async function readVisibleYears(
  minimumWageHistoryPage: MinimumWageHistoryPage,
): Promise<number[]> {
  const testIds = await minimumWageHistoryPage
    .visibleRows()
    .evaluateAll(rows => rows.map(row => row.getAttribute("data-testid")));

  return testIds.map(testId => {
    const match =
      /^mae-historico-salario-minimo-list-table-row--(\d+)$/.exec(
        testId ?? "",
      );

    if (!match) {
      throw new Error(
        `Unexpected minimum-wage-history row test ID: "${testId}"`,
      );
    }

    return Number(match[1]);
  });
}

async function expectRuntimePage(
  minimumWageHistoryPage: MinimumWageHistoryPage,
  runtimeRows: MinimumWageHistoryRow[],
  pageSize: (typeof pageSizes)[number],
  pageIndex: number,
): Promise<void> {
  const startOffset = pageIndex * pageSize;
  const expectedRows = runtimeRows.slice(
    startOffset,
    startOffset + pageSize,
  );
  const expectedYears = expectedRows.map(row => row.vigencia);
  const isFinalPage =
    startOffset + expectedRows.length >= runtimeRows.length;

  await expect(minimumWageHistoryPage.visibleRows()).toHaveCount(
    expectedRows.length,
  );
  expect(await readVisibleYears(minimumWageHistoryPage)).toEqual(
    expectedYears,
  );
  await expect
    .poll(() => minimumWageHistoryPage.readPagerRange())
    .toEqual({
      start: startOffset + 1,
      end: startOffset + expectedRows.length,
      total: runtimeRows.length,
    });

  if (pageIndex === 0) {
    await expect(minimumWageHistoryPage.previousPageButton).toBeDisabled();
  } else {
    await expect(minimumWageHistoryPage.previousPageButton).toBeEnabled();
  }

  if (isFinalPage) {
    await expect(minimumWageHistoryPage.nextPageButton).toBeDisabled();
  } else {
    await expect(minimumWageHistoryPage.nextPageButton).toBeEnabled();
  }
}

test.describe("Runtime list view and pagination", () => {
  test("MWH-003: Page-size controls and navigation follow the runtime total", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        url.pathname === rowsPath && response.request().method() === "GET"
      );
    });

    await page.goto(applicationUrl);

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const runtimeRows =
      (await rowsResponse.json()) as MinimumWageHistoryRow[];

    expect(Array.isArray(runtimeRows)).toBe(true);
    expect(
      runtimeRows.length,
      "MWH-003 needs at least one runtime row to exercise pagination",
    ).toBeGreaterThan(0);
    expect(runtimeRows.map(row => row.vigencia)).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );

    // 1. Exercise page sizes 10, 25, 50, and 100 through stable page-size test IDs.
    for (const pageSize of pageSizes) {
      await minimumWageHistoryPage.pageSizeButton(pageSize).click();

      await expect(
        minimumWageHistoryPage.pageSizeButton(pageSize),
      ).toHaveAttribute("aria-pressed", "true");
      expect(await minimumWageHistoryPage.selectedPageSize()).toBe(
        pageSize,
      );
      await expectRuntimePage(
        minimumWageHistoryPage,
        runtimeRows,
        pageSize,
        0,
      );
    }

    // 2. For any size that produces multiple pages, navigate to the final page and back to the first; otherwise validate the single-page state.
    const navigationPageSize = pageSizes.find(
      pageSize => runtimeRows.length > pageSize,
    );

    if (navigationPageSize === undefined) {
      await expectRuntimePage(
        minimumWageHistoryPage,
        runtimeRows,
        100,
        0,
      );
      test.info().annotations.push({
        type: "prerequisite",
        description:
          "MWH-003 multi-page navigation requires more than 10 runtime rows; all current rows fit on one page",
      });
    } else {
      await minimumWageHistoryPage
        .pageSizeButton(navigationPageSize)
        .click();

      const pageCount = Math.ceil(
        runtimeRows.length / navigationPageSize,
      );

      await expectRuntimePage(
        minimumWageHistoryPage,
        runtimeRows,
        navigationPageSize,
        0,
      );

      for (let pageIndex = 1; pageIndex < pageCount; pageIndex += 1) {
        await minimumWageHistoryPage.nextPageButton.click();
        await expectRuntimePage(
          minimumWageHistoryPage,
          runtimeRows,
          navigationPageSize,
          pageIndex,
        );
      }

      for (let pageIndex = pageCount - 2; pageIndex >= 0; pageIndex -= 1) {
        await minimumWageHistoryPage.previousPageButton.click();
        await expectRuntimePage(
          minimumWageHistoryPage,
          runtimeRows,
          navigationPageSize,
          pageIndex,
        );
      }
    }
  });
});
