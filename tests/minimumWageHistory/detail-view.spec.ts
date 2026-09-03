// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

type MinimumWageHistoryDetail = {
  vigencia: number;
  ndSalarioMinimoGob: number;
  ndSubsidioMes: number;
  ndSubsidioAlimentacion: number | null;
  ndIpc: number | null;
};

type RelationshipValidation = {
  mensaje: string | null;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;

test.describe("Encabezado detail contracts", () => {
  test("MWH-007: Direct Encabezado navigation loads the selected row through tipo=3 and detail GET", async ({
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
      "MWH-007 needs at least one runtime row",
    ).toBeGreaterThan(0);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    expect(runtimeYears).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeYears).size).toBe(runtimeRows.length);

    const latestYear = Math.max(...runtimeYears);
    const selectedYear = latestYear;

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    // 1. Single-select a runtime row, start response waits, and click Encabezado.
    const selectionValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(selectedYear) &&
          url.searchParams.get("tipo") === "1"
        );
      },
    );

    await minimumWageHistoryPage.row(selectedYear).click();

    const selectionValidationResponse =
      await selectionValidationResponsePromise;
    expect(selectionValidationResponse.ok()).toBe(true);

    const detailValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(selectedYear) &&
          url.searchParams.get("tipo") === "3"
        );
      },
    );
    const detailResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === `${rowsPath}/${selectedYear}`
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

    const detailValidation =
      (await detailValidationResponse.json()) as RelationshipValidation;
    const detail =
      (await detailResponse.json()) as MinimumWageHistoryDetail;

    expect(detailValidation.mensaje).toBeNull();
    expect(detail.vigencia).toBe(selectedYear);

    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "false",
    );

    const pageLocale =
      (await page.locator("html").getAttribute("lang")) || "en-US";
    const numericFormatter = new Intl.NumberFormat(pageLocale, {
      maximumFractionDigits: 20,
    });
    const formatNumeric = (value: number | null): string =>
      value === null ? "" : numericFormatter.format(value);

    await expect(minimumWageHistoryPage.detailYearValue).toHaveText(
      String(detail.vigencia),
    );
    await expect(
      minimumWageHistoryPage.detailGovernmentMinimumWageValue,
    ).toHaveText(formatNumeric(detail.ndSalarioMinimoGob));
    await expect(
      minimumWageHistoryPage.detailTransportationSubsidyValue,
    ).toHaveText(formatNumeric(detail.ndSubsidioMes));
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(
      detail.ndSubsidioAlimentacion === null
        ? ""
        : String(detail.ndSubsidioAlimentacion),
    );
    await expect(minimumWageHistoryPage.detailIpcValue).toHaveText(
      formatNumeric(detail.ndIpc),
    );
  });

  test("MWH-009: Latest-year detail exposes only Subsidio alimentación for editing", async ({
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
      "MWH-009 needs at least one runtime row",
    ).toBeGreaterThan(0);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    expect(runtimeYears).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeYears).size).toBe(runtimeRows.length);

    const latestYear = Math.max(...runtimeYears);

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    // 1. Derive max(vigencia), select that row, and open Encabezado.
    const selectionValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(latestYear) &&
          url.searchParams.get("tipo") === "1"
        );
      },
    );

    await minimumWageHistoryPage.row(latestYear).click();

    const selectionValidationResponse =
      await selectionValidationResponsePromise;
    expect(selectionValidationResponse.ok()).toBe(true);

    const detailValidationResponsePromise = page.waitForResponse(
      response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(latestYear) &&
          url.searchParams.get("tipo") === "3"
        );
      },
    );
    const detailResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === `${rowsPath}/${latestYear}`
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

    const detail =
      (await detailResponse.json()) as MinimumWageHistoryDetail;
    expect(detail.vigencia).toBe(latestYear);

    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const readOnlyValues = [
      minimumWageHistoryPage.detailYearValue,
      minimumWageHistoryPage.detailGovernmentMinimumWageValue,
      minimumWageHistoryPage.detailTransportationSubsidyValue,
      minimumWageHistoryPage.detailIpcValue,
    ];

    for (const readOnlyValue of readOnlyValues) {
      await expect(readOnlyValue).toBeVisible();
      await expect(readOnlyValue).toHaveCount(1);
    }

    await expect(
      minimumWageHistoryPage.detailFoodSubsidyValue,
    ).toHaveCount(0);
    await expect(
      minimumWageHistoryPage.routeHost.locator("input"),
    ).toHaveCount(1);
    await expect(
      minimumWageHistoryPage.routeHost.getByRole("spinbutton"),
    ).toHaveCount(1);
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveAttribute("type", "number");
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toBeEditable();
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(
      detail.ndSubsidioAlimentacion === null
        ? ""
        : String(detail.ndSubsidioAlimentacion),
    );

    await expect(minimumWageHistoryPage.saveButton).toBeEnabled();
    await expect(minimumWageHistoryPage.undoButton).toBeEnabled();
    await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();
  });
});
