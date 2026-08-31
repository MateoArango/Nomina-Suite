// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";

function isRowsRequest(url: URL): boolean {
  return url.pathname.endsWith("/w-periodos-liq/rows");
}

function isMutationRequest(method: string, url: URL): boolean {
  return method !== "GET" && url.pathname.includes("/w-periodos-liq/");
}

test.describe("Client-only row and selection behavior", () => {
  test("LP-007: Persisted-row selection enables only single-record deletion", async ({
    page,
  }) => {
    const liquidationPeriodsPage = new LiquidationPeriodsPage(page);
    const mutationRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (isMutationRequest(request.method(), url)) {
        mutationRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(applicationUrl);

    // 1. Load a type with at least one runtime record and select one row by kaNlPeriodo without clicking Delete.
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
    const runtimeRecords =
      (await rowsResponse.json()) as LiquidationPeriodRecord[];

    expect(rowsResponse.ok()).toBe(true);
    expect(Array.isArray(runtimeRecords)).toBe(true);
    expect(
      runtimeRecords.length,
      "LP-007 needs two persisted rows to verify exclusive selection",
    ).toBeGreaterThanOrEqual(2);

    const firstPeriodId = runtimeRecords[0].kaNlPeriodo;
    const secondPeriodId = runtimeRecords[1].kaNlPeriodo;
    const selectedRows =
      liquidationPeriodsPage.table.locator("tbody tr.selected");

    await expect(liquidationPeriodsPage.row(firstPeriodId)).toBeVisible();
    await expect(liquidationPeriodsPage.row(secondPeriodId)).toBeVisible();
    await expect(selectedRows).toHaveCount(0);
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();

    await liquidationPeriodsPage.row(firstPeriodId).click();

    await expect(selectedRows).toHaveCount(1);
    await expect(liquidationPeriodsPage.row(firstPeriodId)).toHaveClass(
      /\bselected\b/,
    );
    await expect(liquidationPeriodsPage.row(secondPeriodId)).not.toHaveClass(
      /\bselected\b/,
    );
    await expect(liquidationPeriodsPage.deleteButton).toBeEnabled();
    expect(mutationRequests).toHaveLength(0);

    // 2. Try to select another row while the first remains selected.
    await liquidationPeriodsPage.row(secondPeriodId).click();

    await expect(selectedRows).toHaveCount(1);
    await expect(liquidationPeriodsPage.row(firstPeriodId)).not.toHaveClass(
      /\bselected\b/,
    );
    await expect(liquidationPeriodsPage.row(secondPeriodId)).toHaveClass(
      /\bselected\b/,
    );
    await expect(liquidationPeriodsPage.deleteButton).toBeEnabled();
    expect(mutationRequests).toHaveLength(0);
  });
});
