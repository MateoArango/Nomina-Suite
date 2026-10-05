// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type PeriodType = "M" | "Q";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
  scDiasLiquidacion: PeriodType;
  scPeriodo: number | null;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";

function isRowsRequest(url: URL, periodType: PeriodType): boolean {
  return (
    url.pathname.endsWith("/w-periodos-liq/rows") &&
    url.searchParams.get("tipoPeriodo") === periodType
  );
}

function inputDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

function inputPeriod(value: number | null): string {
  return value === null ? "" : String(value);
}

test.describe("Initial state and period-type loading", () => {
  test("LP-002: Monthly and fortnightly selections load the matching runtime grid", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const rowsRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (
        request.method() === "GET" &&
        url.pathname.endsWith("/w-periodos-liq/rows")
      ) {
        rowsRequests.push(request.url());
      }
    });

    await page.goto(applicationUrl);

    // 1. Start a rows-response wait, select monthly (M / visible value 30), and validate the response.
    const monthlyResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" && isRowsRequest(url, "M")
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const monthlyResponse = await monthlyResponsePromise;
    const monthlyRecords =
      (await monthlyResponse.json()) as LiquidationPeriodRecord[];

    expect(monthlyResponse.ok()).toBe(true);
    expect(
      rowsRequests.filter(requestUrl =>
        isRowsRequest(new URL(requestUrl), "M"),
      ),
    ).toHaveLength(1);
    expect(Array.isArray(monthlyRecords)).toBe(true);

    for (const record of monthlyRecords) {
      expect(record.scDiasLiquidacion).toBe("M");
      expect(record.kaNlPeriodo).toEqual(expect.any(Number));
    }

    // 2. Map every visible persisted row to the monthly response by kaNlPeriodo.
    const monthlyVisibleCount = Math.min(
      monthlyRecords.length,
      await liquidationPeriodsPage.selectedPageSize(),
    );
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
      monthlyVisibleCount,
    );

    for (const record of monthlyRecords.slice(0, monthlyVisibleCount)) {
      const periodId = record.kaNlPeriodo;

      await expect(liquidationPeriodsPage.row(periodId)).toBeVisible();
      await expect(
        liquidationPeriodsPage.periodInput(periodId),
      ).toHaveValue(inputPeriod(record.scPeriodo));
      await expect(
        liquidationPeriodsPage.startDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaInicial));
      await expect(
        liquidationPeriodsPage.endDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaFinal));
    }

    // 3. Repeat from a fresh state for fortnightly (Q / visible value 15).
    await page.goto(applicationUrl);

    const fortnightlyResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" && isRowsRequest(url, "Q")
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-q").click();

    const fortnightlyResponse = await fortnightlyResponsePromise;
    const fortnightlyRecords =
      (await fortnightlyResponse.json()) as LiquidationPeriodRecord[];

    expect(fortnightlyResponse.ok()).toBe(true);
    expect(
      rowsRequests.filter(requestUrl =>
        isRowsRequest(new URL(requestUrl), "Q"),
      ),
    ).toHaveLength(1);
    expect(Array.isArray(fortnightlyRecords)).toBe(true);

    for (const record of fortnightlyRecords) {
      expect(record.scDiasLiquidacion).toBe("Q");
      expect(record.kaNlPeriodo).toEqual(expect.any(Number));
    }

    const fortnightlyVisibleCount = Math.min(
      fortnightlyRecords.length,
      await liquidationPeriodsPage.selectedPageSize(),
    );
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(
      fortnightlyVisibleCount,
    );

    for (const record of fortnightlyRecords.slice(
      0,
      fortnightlyVisibleCount,
    )) {
      const periodId = record.kaNlPeriodo;

      await expect(liquidationPeriodsPage.row(periodId)).toBeVisible();
      await expect(
        liquidationPeriodsPage.periodInput(periodId),
      ).toHaveValue(inputPeriod(record.scPeriodo));
      await expect(
        liquidationPeriodsPage.startDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaInicial));
      await expect(
        liquidationPeriodsPage.endDateInput(periodId),
      ).toHaveValue(inputDate(record.fechaFinal));
    }
  });
});
