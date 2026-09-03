// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

type RelationshipValidation = {
  mensaje: string | null;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = modulePath + "/rows";
const relationshipPath = modulePath + "/actions/validar-relacion";
const deletePath = modulePath + "/actions/eliminar";

test.describe("Creation and deletion guards", () => {
  test("MWH-018: Eliminar remains unavailable in supported list and detail states", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const observedDeleteRequests: string[] = [];

    page.on("request", request => {
      if (new URL(request.url()).pathname === deletePath) {
        observedDeleteRequests.push(request.url());
      }
    });

    const assertDeleteUnavailable = async (): Promise<void> => {
      await expect(minimumWageHistoryPage.deleteButton).toBeDisabled();
      expect(observedDeleteRequests).toHaveLength(0);
    };

    const selectYear = async (year: number): Promise<void> => {
      const selectionResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(year) &&
          url.searchParams.get("tipo") === "1"
        );
      });

      await minimumWageHistoryPage.row(year).click();

      const selectionResponse = await selectionResponsePromise;
      expect(selectionResponse.ok()).toBe(true);
      await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
        "aria-selected",
        "true",
      );
    };

    const openDetail = async (year: number): Promise<void> => {
      const detailValidationResponsePromise = page.waitForResponse(
        response => {
          const url = new URL(response.url());

          return (
            response.request().method() === "GET" &&
            url.pathname === relationshipPath &&
            url.searchParams.get("vigencia") === String(year) &&
            url.searchParams.get("tipo") === "3"
          );
        },
      );
      const detailResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === rowsPath + "/" + year
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
      const detail = (await detailResponse.json()) as MinimumWageHistoryRow;

      expect(detailValidation.mensaje).toBeNull();
      expect(detail.vigencia).toBe(year);
      await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
        "aria-selected",
        "true",
      );
    };

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

    const [rowsResponse, initialRelationshipResponse] =
      await Promise.all([
        rowsResponsePromise,
        initialRelationshipResponsePromise,
      ]);

    expect(rowsResponse.ok()).toBe(true);
    expect(initialRelationshipResponse.ok()).toBe(true);

    const runtimeRows =
      (await rowsResponse.json()) as MinimumWageHistoryRow[];
    expect(
      runtimeRows.length,
      "MWH-018 needs at least two runtime rows",
    ).toBeGreaterThanOrEqual(2);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    expect(runtimeYears).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeYears).size).toBe(runtimeRows.length);

    const latestYear = Math.max(...runtimeYears);
    const priorYear = Math.max(
      ...runtimeYears.filter(year => year < latestYear),
    );

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    // 1. Check Eliminar on the initial list, after selecting a prior row, after selecting the latest row, in prior-year detail, in latest-year detail, and in an untouched Nuevo form.
    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await assertDeleteUnavailable();

    await selectYear(priorYear);
    await assertDeleteUnavailable();

    await openDetail(priorYear);
    await expect(
      minimumWageHistoryPage.routeHost.locator("input"),
    ).toHaveCount(0);
    await assertDeleteUnavailable();

    await minimumWageHistoryPage.listTab.click();
    await selectYear(latestYear);
    await assertDeleteUnavailable();

    await openDetail(latestYear);
    await expect(
      minimumWageHistoryPage.detailFoodSubsidyInput,
    ).toHaveCount(1);
    await assertDeleteUnavailable();

    await minimumWageHistoryPage.createButton.click();

    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.detailYearInput).toHaveValue("");
    await expect(
      minimumWageHistoryPage.routeHost.getByRole("spinbutton"),
    ).toHaveCount(5);
    await assertDeleteUnavailable();

    expect(observedDeleteRequests).toHaveLength(0);
  });
});
