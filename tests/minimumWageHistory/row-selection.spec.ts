// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
};

type RelationshipValidation = {
  permitido: boolean;
  mensaje: string | null;
  vigenciaMaxHistorico: number;
  vigenciaMaxCompras: number;
  movimientosNomina: number;
  cierresCompras: number;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;

test.describe("Selection and validation relationships", () => {
  test("MWH-004: Single selection validates the selected runtime year and remains on Lista", async ({
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
      "MWH-004 needs a latest and a prior runtime year",
    ).toBeGreaterThan(1);
    expect(runtimeRows.map(row => row.vigencia)).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeRows.map(row => row.vigencia)).size).toBe(
      runtimeRows.length,
    );

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    const latestYear = Math.max(...runtimeYears);
    const priorYears = runtimeYears
      .filter(year => year < latestYear)
      .sort((left, right) => right - left);
    const priorYear = priorYears[0];
    const oldestYear = Math.min(...runtimeYears);

    expect(priorYear).toEqual(expect.any(Number));

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    const moduleRequests: { method: string; url: string }[] = [];
    page.on("request", request => {
      const url = new URL(request.url());

      if (url.pathname.startsWith(modulePath)) {
        moduleRequests.push({
          method: request.method(),
          url: request.url(),
        });
      }
    });

    const selectAndAssertRuntimeYear = async (
      year: number,
    ): Promise<RelationshipValidation> => {
      const actionRequestOffset = moduleRequests.length;
      const validationResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(year) &&
          url.searchParams.get("tipo") === "1"
        );
      });

      const selectedRow = minimumWageHistoryPage.row(year);
      await selectedRow.click();

      const validationResponse = await validationResponsePromise;
      expect(validationResponse.ok()).toBe(true);

      const validation =
        (await validationResponse.json()) as RelationshipValidation;

      expect(validation).toEqual({
        permitido: false,
        mensaje: null,
        vigenciaMaxHistorico: expect.any(Number),
        vigenciaMaxCompras: expect.any(Number),
        movimientosNomina: expect.any(Number),
        cierresCompras: expect.any(Number),
      });

      await expect(selectedRow).toHaveClass(
        /(?:^|\s)row--selected(?:\s|$)/,
      );
      await expect(
        minimumWageHistoryPage.table.locator(
          "tbody tr.row--selected",
        ),
      ).toHaveCount(1);
      await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
        "aria-selected",
        "false",
      );

      const actionRequests = moduleRequests.slice(actionRequestOffset);
      const relationshipRequests = actionRequests.filter(request => {
        const url = new URL(request.url);

        return url.pathname === relationshipPath;
      });

      expect(
        relationshipRequests.length,
        `Selecting ${year} must send a relationship validation request`,
      ).toBeGreaterThan(0);

      for (const request of relationshipRequests) {
        const url = new URL(request.url);

        expect(request.method).toBe("GET");
        expect(url.searchParams.get("vigencia")).toBe(String(year));
        expect(url.searchParams.get("tipo")).toBe("1");
      }

      const detailRequests = actionRequests.filter(request => {
        const url = new URL(request.url);

        return (
          request.method === "GET" &&
          url.pathname.startsWith(`${rowsPath}/`)
        );
      });

      expect(detailRequests).toHaveLength(0);

      return validation;
    };

    // 1. Select the runtime latest row by max(vigencia) while observing validar-relacion requests.
    await selectAndAssertRuntimeYear(latestYear);

    // 2. Select one prior runtime row and, when available, the oldest runtime row.
    await selectAndAssertRuntimeYear(priorYear);

    if (oldestYear !== latestYear && oldestYear !== priorYear) {
      await selectAndAssertRuntimeYear(oldestYear);
    }
  });
});
