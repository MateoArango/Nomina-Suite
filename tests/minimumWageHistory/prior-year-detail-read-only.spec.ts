// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;

test.describe("Encabezado detail contracts", () => {
  test("MWH-008: Prior-year detail renders every field as read-only", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const rowsResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === rowsPath
      );
    });
    const initialRelationshipResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("tipo") === "1"
        );
      },
    );

    await page.goto(applicationUrl);

    const [rowsResponse, initialRelationshipResponse] = await Promise.all([
      rowsResponsePromise,
      initialRelationshipResponsePromise,
    ]);

    expect(rowsResponse.ok()).toBe(true);
    expect(initialRelationshipResponse.ok()).toBe(true);

    const runtimeRows =
      (await rowsResponse.json()) as MinimumWageHistoryRow[];
    expect(
      runtimeRows.length,
      "MWH-008 needs a latest and a prior runtime year",
    ).toBeGreaterThan(1);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    expect(runtimeYears).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeYears).size).toBe(runtimeRows.length);

    const latestYear = Math.max(...runtimeYears);
    const priorYear = runtimeYears
      .filter(year => year < latestYear)
      .sort((left, right) => right - left)[0];

    if (priorYear === undefined) {
      throw new Error("MWH-008 could not derive a prior runtime year");
    }

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    // 1. Choose any runtime row whose vigencia is lower than max(vigencia), then open Encabezado.
    const selectionValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(priorYear) &&
          url.searchParams.get("tipo") === "1"
        );
      },
    );

    await minimumWageHistoryPage.row(priorYear).click();

    const selectionValidationResponse =
      await selectionValidationResponsePromise;
    expect(selectionValidationResponse.ok()).toBe(true);

    const detailValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(priorYear) &&
          url.searchParams.get("tipo") === "3"
        );
      },
    );
    const detailResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === `${rowsPath}/${priorYear}`
      );
    });

    await minimumWageHistoryPage.detailTab.click();

    const [detailValidationResponse, detailResponse] =
      await Promise.all([
        detailValidationResponsePromise,
        detailResponsePromise,
      ]);

    expect(detailValidationResponse.ok()).toBe(true);
    expect(detailResponse.ok()).toBe(true);
    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const readOnlyValues = [
      minimumWageHistoryPage.detailYearValue,
      minimumWageHistoryPage.detailGovernmentMinimumWageValue,
      minimumWageHistoryPage.detailTransportationSubsidyValue,
      minimumWageHistoryPage.detailFoodSubsidyValue,
      minimumWageHistoryPage.detailIpcValue,
    ];

    const detailFields = minimumWageHistoryPage.routeHost.locator(
      ".field-pair",
    );
    await expect(detailFields).toHaveCount(5);

    for (const detailField of await detailFields.all()) {
      await expect(detailField).toBeVisible();
    }

    for (const readOnlyValue of readOnlyValues) {
      await expect(readOnlyValue).toBeAttached();
      await expect(readOnlyValue).toHaveCount(1);
    }

    await expect(
      minimumWageHistoryPage.routeHost.locator(".field-pair input"),
    ).toHaveCount(0);
    await expect(
      minimumWageHistoryPage.routeHost.getByRole("spinbutton"),
    ).toHaveCount(0);

    await expect(minimumWageHistoryPage.saveButton).toBeEnabled();
    await expect(minimumWageHistoryPage.undoButton).toBeEnabled();
    await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();
  });
});
