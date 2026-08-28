// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
  scPeriodo: number;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";

function isRowsRequest(url: URL): boolean {
  return url.pathname.endsWith("/w-periodos-liq/rows");
}

function isMutationRequest(method: string, url: URL): boolean {
  return method !== "GET" && url.pathname.includes("/w-periodos-liq/");
}

function inputDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

test.describe("Client-only row and selection behavior", () => {
  test("LP-004: New appends one selected empty working row without a request", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const rowsRequests: string[] = [];
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (request.method() === "GET" && isRowsRequest(url)) {
        rowsRequests.push(request.url());
      }

      if (isMutationRequest(request.method(), url)) {
        mutationRequests.push(request.url());
      }
    });

    await page.goto(applicationUrl);

    // 1. Select a runtime period type, record the baseline persisted IDs and network traffic, then click New once.
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        isRowsRequest(url) &&
        url.searchParams.get("tipoPeriodo") === "M"
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const rowsResponse = await rowsResponsePromise;
    const baselineRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(baselineRecords)).toBe(true);
    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);

    const baselinePager = await liquidationPeriodsPage.readPagerRange();
    const baselineVisibleCount = Math.min(
      baselineRecords.length,
      await liquidationPeriodsPage.selectedPageSize(),
    );
    const baselineVisibleRecords = baselineRecords.slice(
      0,
      baselineVisibleCount,
    );

    expect(baselinePager.total).toBe(baselineRecords.length);
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
      baselineVisibleCount,
    );
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);

    await liquidationPeriodsPage.newButton.click();

    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(1);

    const workingRow = liquidationPeriodsPage.emptyWorkingRow();

    await expect(workingRow).toHaveClass(/\bselected\b/);
    await expect(workingRow.locator("input")).toHaveCount(3);

    for (const input of await workingRow.locator("input").all()) {
      await expect(input).toHaveValue("");
    }

    const currentPager = await liquidationPeriodsPage.readPagerRange();

    expect(currentPager.total).toBe(baselinePager.total + 1);
    await expect(liquidationPeriodsPage.saveButton).toBeEnabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeEnabled();

    for (const record of baselineVisibleRecords) {
      const periodId = record.kaNlPeriodo;

      await expect(liquidationPeriodsPage.row(periodId)).toBeVisible();
      await expect(liquidationPeriodsPage.periodInput(periodId)).toHaveValue(
        String(record.scPeriodo),
      );
      await expect(
        liquidationPeriodsPage.startDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaInicial));
      await expect(
        liquidationPeriodsPage.endDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaFinal));
    }

    // 2. Reload the page without saving.
    await page.reload();

    await expect(liquidationPeriodsPage.periodTypeSelect).toHaveText("");
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(0);
    await expect(liquidationPeriodsPage.emptyWorkingRow()).toHaveCount(0);
    await expect(liquidationPeriodsPage.pagerSummary).toHaveText(
      "Sin registros",
    );
    await expect(liquidationPeriodsPage.newButton).toBeDisabled();
    await expect(liquidationPeriodsPage.saveButton).toBeDisabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();

    expect(rowsRequests).toHaveLength(1);
    expect(mutationRequests).toHaveLength(0);
  });
});
