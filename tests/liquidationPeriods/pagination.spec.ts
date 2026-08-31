// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";
const pageSizes = [10, 25, 50, 100] as const;

function isRowsRequest(url: URL): boolean {
  return (
    url.pathname.endsWith("/w-periodos-liq/rows") &&
    url.searchParams.get("tipoPeriodo") === "M"
  );
}

async function readVisiblePeriodIds(
  liquidationPeriodsPage: LiquidationPeriodsPage,
): Promise<number[]> {
  const testIds = await liquidationPeriodsPage.visibleRows().evaluateAll(rows =>
    rows.map(row => row.getAttribute("data-testid")),
  );

  return testIds.map(testId => {
    const match = /^periodos-liq-table-row--(\d+)$/.exec(testId ?? "");

    if (!match) {
      throw new Error(
        `Unexpected liquidation-period row test ID: "${testId}"`,
      );
    }

    return Number(match[1]);
  });
}

async function expectRuntimePage(
  liquidationPeriodsPage: LiquidationPeriodsPage,
  runtimeRecords: LiquidationPeriodRecord[],
  pageSize: (typeof pageSizes)[number],
  pageIndex: number,
): Promise<void> {
  const startOffset = pageIndex * pageSize;
  const expectedRecords = runtimeRecords.slice(
    startOffset,
    startOffset + pageSize,
  );
  const expectedIds = expectedRecords.map(record => record.kaNlPeriodo);
  const finalPage = startOffset + expectedRecords.length >= runtimeRecords.length;

  await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
    expectedRecords.length,
  );
  expect(await readVisiblePeriodIds(liquidationPeriodsPage)).toEqual(
    expectedIds,
  );
  await expect
    .poll(() => liquidationPeriodsPage.readPagerRange())
    .toEqual({
      start: startOffset + 1,
      end: startOffset + expectedRecords.length,
      total: runtimeRecords.length,
    });

  if (pageIndex === 0) {
    await expect(liquidationPeriodsPage.previousPageButton).toBeDisabled();
  } else {
    await expect(liquidationPeriodsPage.previousPageButton).toBeEnabled();
  }

  if (finalPage) {
    await expect(liquidationPeriodsPage.nextPageButton).toBeDisabled();
  } else {
    await expect(liquidationPeriodsPage.nextPageButton).toBeEnabled();
  }
}

test.describe("Runtime-derived pagination", () => {
  test("LP-008: Page sizes and navigation follow the current runtime total", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);

    await page.goto(applicationUrl);

    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return response.request().method() === "GET" && isRowsRequest(url);
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const rowsResponse = await rowsResponsePromise;
    const runtimeRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(runtimeRecords)).toBe(true);
    expect(
      runtimeRecords.length,
      "LP-008 needs at least one runtime record to exercise pagination",
    ).toBeGreaterThan(0);
    expect(
      runtimeRecords.map(record => record.kaNlPeriodo),
    ).toEqual(runtimeRecords.map(record => expect.any(Number)));

    // 1. Load a type and exercise page sizes 10, 25, 50, and 100 using stable test IDs.
    for (const pageSize of pageSizes) {
      await liquidationPeriodsPage.pageSizeButton(pageSize).click();

      await expect(
        liquidationPeriodsPage.pageSizeButton(pageSize),
      ).toHaveAttribute("aria-pressed", "true");
      expect(await liquidationPeriodsPage.selectedPageSize()).toBe(pageSize);
      await expectRuntimePage(
        liquidationPeriodsPage,
        runtimeRecords,
        pageSize,
        0,
      );
    }

    // 2. For any size that produces multiple pages, navigate forward to the final page and back to the first.
    const navigationPageSize = pageSizes.find(
      pageSize => runtimeRecords.length > pageSize,
    );

    if (navigationPageSize === undefined) {
      test.info().annotations.push({
        type: "skip",
        description:
          "LP-008 navigation branch requires more than 10 runtime records; all current records fit on one page",
      });
    } else {
      await liquidationPeriodsPage.pageSizeButton(navigationPageSize).click();
      const pageCount = Math.ceil(
        runtimeRecords.length / navigationPageSize,
      );

      await expectRuntimePage(
        liquidationPeriodsPage,
        runtimeRecords,
        navigationPageSize,
        0,
      );

      for (let pageIndex = 1; pageIndex < pageCount; pageIndex += 1) {
        await liquidationPeriodsPage.nextPageButton.click();
        await expectRuntimePage(
          liquidationPeriodsPage,
          runtimeRecords,
          navigationPageSize,
          pageIndex,
        );
      }

      for (let pageIndex = pageCount - 2; pageIndex >= 0; pageIndex -= 1) {
        await liquidationPeriodsPage.previousPageButton.click();
        await expectRuntimePage(
          liquidationPeriodsPage,
          runtimeRecords,
          navigationPageSize,
          pageIndex,
        );
      }
    }
  });
});
