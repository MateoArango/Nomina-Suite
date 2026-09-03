// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

type MinimumWageHistoryDetail = {
  vigencia: number;
  ndSubsidioAlimentacion: number | null;
};

type RelationshipValidation = {
  mensaje: string | null;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;
const errorReportPath = "/api/v1/pb-messages/f-mensajes-sistema";

test.describe("Client-only edit, undo, and dirty-navigation behavior", () => {
  test("MWH-010: Deshacer restores the latest saved subsidy without a data mutation", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const saveRequests: string[] = [];
    const errorReportRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (
        request.method() === "POST" &&
        (url.pathname === rowsPath ||
          url.pathname.startsWith(`${rowsPath}/`))
      ) {
        saveRequests.push(request.url());
      }

      if (
        request.method() === "POST" &&
        url.pathname === errorReportPath
      ) {
        errorReportRequests.push(request.url());
      }
    });

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
      "MWH-010 needs at least one runtime row",
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

    // 1. Open the latest runtime row in Encabezado, capture its original subsidy, enter a distinct valid value, and observe module requests.
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

    const detailValidation =
      (await detailValidationResponse.json()) as RelationshipValidation;
    const detail =
      (await detailResponse.json()) as MinimumWageHistoryDetail;

    expect(detailValidation.mensaje).toBeNull();
    expect(detail.vigencia).toBe(latestYear);

    const originalSubsidy =
      detail.ndSubsidioAlimentacion === null
        ? ""
        : String(detail.ndSubsidioAlimentacion);
    const unsavedSubsidy =
      originalSubsidy === "1" ? "2" : "1";
    const baselineSaveRequestCount = saveRequests.length;
    const baselineErrorReportRequestCount =
      errorReportRequests.length;

    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(originalSubsidy);
    await minimumWageHistoryPage.detailFoodSubsidyInput.fill(
      unsavedSubsidy,
    );

    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(unsavedSubsidy);
    expect(saveRequests).toHaveLength(baselineSaveRequestCount);
    expect(errorReportRequests).toHaveLength(
      baselineErrorReportRequestCount,
    );

    // 2. Click Deshacer once.
    await minimumWageHistoryPage.undoButton.click();

    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveCount(0);
    await expect(minimumWageHistoryPage.createButton).toBeEnabled();
    await expect(minimumWageHistoryPage.saveButton).toBeDisabled();
    await expect(minimumWageHistoryPage.undoButton).toBeDisabled();
    await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();

    const pageLocale =
      (await page.locator("html").getAttribute("lang")) || "en-US";
    const formattedOriginalSubsidy =
      detail.ndSubsidioAlimentacion === null
        ? ""
        : new Intl.NumberFormat(pageLocale, {
            maximumFractionDigits: 20,
          }).format(detail.ndSubsidioAlimentacion);

    await expect(
      minimumWageHistoryPage.row(latestYear).locator("td").nth(3),
    ).toHaveText(formattedOriginalSubsidy);
    expect(saveRequests).toHaveLength(baselineSaveRequestCount);
    expect(errorReportRequests).toHaveLength(
      baselineErrorReportRequestCount,
    );
  });

  test("MWH-011: Lista is blocked while the latest-row subsidy is dirty", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const rowMutationRequests: string[] = [];
    const errorReportRequests: string[] = [];

    page.on("request", request => {
      const url = new URL(request.url());
      const method = request.method();

      if (
        !["GET", "HEAD", "OPTIONS"].includes(method) &&
        (url.pathname === rowsPath ||
          url.pathname.startsWith(`${rowsPath}/`))
      ) {
        rowMutationRequests.push(request.url());
      }

      if (method === "POST" && url.pathname === errorReportPath) {
        errorReportRequests.push(request.url());
      }
    });

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
      "MWH-011 needs at least one runtime row",
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

    // 1. Open the latest row in Encabezado, change only Subsidio alimentación without saving, start request observation, and click Lista.
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

    const originalSubsidy =
      detail.ndSubsidioAlimentacion === null
        ? ""
        : String(detail.ndSubsidioAlimentacion);
    const unsavedSubsidy = originalSubsidy === "1" ? "2" : "1";

    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(originalSubsidy);
    await minimumWageHistoryPage.detailFoodSubsidyInput.fill(
      unsavedSubsidy,
    );

    const baselineRowMutationRequestCount =
      rowMutationRequests.length;
    const baselineErrorReportRequestCount =
      errorReportRequests.length;
    const errorReportRequestPromise = page.waitForRequest(request => {
      const url = new URL(request.url());

      return (
        request.method() === "POST" &&
        url.pathname === errorReportPath
      );
    });

    await minimumWageHistoryPage.listTab.click();

    const errorReportRequest = await errorReportRequestPromise;
    expect(new URL(errorReportRequest.url()).pathname).toBe(
      errorReportPath,
    );
    await expect(
      minimumWageHistoryPage.discardUnsavedChangesDialog,
    ).toBeVisible();
    await expect(
      minimumWageHistoryPage.discardUnsavedChangesDialog.getByRole(
        "heading",
        { name: "Nomina", exact: true },
      ),
    ).toBeVisible();
    await expect(
      minimumWageHistoryPage.discardUnsavedChangesDialog.getByText(
        "Debe grabar o deshacer los cambios en el documento para ver la lista.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveValue(unsavedSubsidy);
    expect(errorReportRequests).toHaveLength(
      baselineErrorReportRequestCount + 1,
    );
    expect(rowMutationRequests).toHaveLength(
      baselineRowMutationRequestCount,
    );

    // 2. Dismiss the dialog and click Deshacer.
    await minimumWageHistoryPage.discardUnsavedChangesConfirmButton.click();
    await minimumWageHistoryPage.undoButton.click();

    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.table).toBeVisible();
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveCount(0);

    const pageLocale =
      (await page.locator("html").getAttribute("lang")) || "en-US";
    const formattedOriginalSubsidy =
      detail.ndSubsidioAlimentacion === null
        ? ""
        : new Intl.NumberFormat(pageLocale, {
            maximumFractionDigits: 20,
          }).format(detail.ndSubsidioAlimentacion);

    await expect(
      minimumWageHistoryPage.row(latestYear).locator("td").nth(3),
    ).toHaveText(formattedOriginalSubsidy);
    expect(rowMutationRequests).toHaveLength(
      baselineRowMutationRequestCount,
    );
  });
});
