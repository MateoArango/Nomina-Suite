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

async function expectGridToMatchResponse(
  liquidationPeriodsPage: LiquidationPeriodsPage,
  records: LiquidationPeriodRecord[],
): Promise<void> {
  const visibleCount = Math.min(
    records.length,
    await liquidationPeriodsPage.selectedPageSize(),
  );

  await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(visibleCount);

  for (const record of records.slice(0, visibleCount)) {
    const periodId = record.kaNlPeriodo;

    await expect(liquidationPeriodsPage.row(periodId)).toBeVisible();
    await expect(liquidationPeriodsPage.periodInput(periodId)).toHaveValue(
      inputPeriod(record.scPeriodo),
    );
    await expect(liquidationPeriodsPage.startDateInput(periodId)).toHaveValue(
      inputDate(record.fechaInicial),
    );
    await expect(liquidationPeriodsPage.endDateInput(periodId)).toHaveValue(
      inputDate(record.fechaFinal),
    );
  }
}

test.describe("Initial state and period-type loading", () => {
  test("LP-003: Switching type replaces the grid without mixing identities", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const requestedTypes: PeriodType[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (
        request.method() === "GET" &&
        url.pathname.endsWith("/w-periodos-liq/rows")
      ) {
        const periodType = url.searchParams.get("tipoPeriodo");

        if (periodType === "M" || periodType === "Q") {
          requestedTypes.push(periodType);
        }
      }
    });

    await page.goto(applicationUrl);

    // 1. Load one type, retain its response IDs, then switch to the other type after starting a new rows wait.
    const firstMonthlyResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" && isRowsRequest(url, "M")
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const firstMonthlyResponse = await firstMonthlyResponsePromise;
    const firstMonthlyRecords =
      (await firstMonthlyResponse.json()) as LiquidationPeriodRecord[];

    expect(firstMonthlyResponse.ok()).toBe(true);
    expect(Array.isArray(firstMonthlyRecords)).toBe(true);

    for (const record of firstMonthlyRecords) {
      expect(record.scDiasLiquidacion).toBe("M");
      expect(record.kaNlPeriodo).toEqual(expect.any(Number));
    }

    await expectGridToMatchResponse(
      liquidationPeriodsPage,
      firstMonthlyRecords,
    );

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
    expect(Array.isArray(fortnightlyRecords)).toBe(true);

    for (const record of fortnightlyRecords) {
      expect(record.scDiasLiquidacion).toBe("Q");
      expect(record.kaNlPeriodo).toEqual(expect.any(Number));
    }

    expect(requestedTypes).toEqual(["M", "Q"]);
    await expectGridToMatchResponse(
      liquidationPeriodsPage,
      fortnightlyRecords,
    );

    const fortnightlyIds = new Set(
      fortnightlyRecords.map(record => record.kaNlPeriodo),
    );

    for (const staleRecord of firstMonthlyRecords.filter(
      record => !fortnightlyIds.has(record.kaNlPeriodo),
    )) {
      await expect(
        liquidationPeriodsPage.row(staleRecord.kaNlPeriodo),
      ).toHaveCount(0);
    }

    await expect(liquidationPeriodsPage.newButton).toBeEnabled();
    await expect(liquidationPeriodsPage.saveButton).toBeEnabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();

    // 2. Switch back and compare the fresh response with the remounted grid.
    const freshMonthlyResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" && isRowsRequest(url, "M")
      );
    });

    await liquidationPeriodsPage.periodTypeSelect.click();
    await page.getByTestId("periodos-liq-type-option-m").click();

    const freshMonthlyResponse = await freshMonthlyResponsePromise;
    const freshMonthlyRecords =
      (await freshMonthlyResponse.json()) as LiquidationPeriodRecord[];

    expect(freshMonthlyResponse.ok()).toBe(true);
    expect(Array.isArray(freshMonthlyRecords)).toBe(true);

    for (const record of freshMonthlyRecords) {
      expect(record.scDiasLiquidacion).toBe("M");
      expect(record.kaNlPeriodo).toEqual(expect.any(Number));
    }

    expect(requestedTypes).toEqual(["M", "Q", "M"]);
    await expectGridToMatchResponse(
      liquidationPeriodsPage,
      freshMonthlyRecords,
    );

    const freshMonthlyIds = new Set(
      freshMonthlyRecords.map(record => record.kaNlPeriodo),
    );

    for (const staleRecord of fortnightlyRecords.filter(
      record => !freshMonthlyIds.has(record.kaNlPeriodo),
    )) {
      await expect(
        liquidationPeriodsPage.row(staleRecord.kaNlPeriodo),
      ).toHaveCount(0);
    }
  });
});
