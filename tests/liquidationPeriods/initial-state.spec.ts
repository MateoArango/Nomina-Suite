// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type PeriodTypeLookup = {
  tipoPeriodo: string;
  diasPeriodo: number;
  texto: string;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";
const contextUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-periodos-liq/context";
const periodTypesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-periodos-liq/lookups/dw-tipos-periodo";

test.describe("Initial state and period-type loading", () => {
  test("LP-001: Initial load requires an explicit period type", async ({
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

    // 1. Open the authenticated liquidation-period route from a fresh browser state while observing module requests.
    const contextResponsePromise = page.waitForResponse(
      response =>
        response.url() === contextUrl &&
        response.request().method() === "GET",
    );
    const periodTypesResponsePromise = page.waitForResponse(
      response =>
        response.url() === periodTypesUrl &&
        response.request().method() === "GET",
    );

    await page.goto(applicationUrl);

    const [contextResponse, periodTypesResponse] = await Promise.all([
      contextResponsePromise,
      periodTypesResponsePromise,
    ]);

    expect(contextResponse.ok()).toBe(true);
    expect(periodTypesResponse.ok()).toBe(true);
    await expect(liquidationPeriodsPage.loadingStatus).toBeAttached();
    await expect(liquidationPeriodsPage.periodTypeSelect).toHaveText("");
    await expect(liquidationPeriodsPage.visibleRows()).toHaveCount(0);
    await expect(liquidationPeriodsPage.newButton).toBeDisabled();
    await expect(liquidationPeriodsPage.saveButton).toBeDisabled();
    await expect(liquidationPeriodsPage.deleteButton).toBeDisabled();
    await expect(liquidationPeriodsPage.pageSizeButton(25)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(liquidationPeriodsPage.pagerSummary).toHaveText(
      "Sin registros",
    );
    await expect(liquidationPeriodsPage.previousPageButton).toBeDisabled();
    await expect(liquidationPeriodsPage.nextPageButton).toBeDisabled();
    expect(rowsRequests).toEqual([]);

    // 2. Validate the runtime period-type lookup instead of hard-coding option order.
    const periodTypes =
      (await periodTypesResponse.json()) as PeriodTypeLookup[];

    expect(Array.isArray(periodTypes)).toBe(true);
    expect(periodTypes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipoPeriodo: "M", diasPeriodo: 30 }),
        expect.objectContaining({ tipoPeriodo: "Q", diasPeriodo: 15 }),
      ]),
    );

    for (const periodType of periodTypes) {
      expect(periodType.tipoPeriodo).toEqual(expect.any(String));
      expect(periodType.diasPeriodo).toEqual(expect.any(Number));
      expect(periodType.texto).toEqual(expect.any(String));
    }

    await liquidationPeriodsPage.periodTypeSelect.click();

    const visibleOptions = page.locator(
      'mat-option[data-testid^="periodos-liq-type-option-"]:visible',
    );
    await expect(visibleOptions).toHaveCount(periodTypes.length);

    for (const periodType of periodTypes) {
      await expect(
        page.getByTestId(
          `periodos-liq-type-option-${periodType.tipoPeriodo.toLowerCase()}`,
        ),
      ).toHaveText(String(periodType.diasPeriodo));
    }

    expect(rowsRequests).toEqual([]);
  });
});
