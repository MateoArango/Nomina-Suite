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

type CapturedRequest = {
  method: string;
  url: string;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;

test.describe("Double-click blocking behavior", () => {
  test("MWH-005: Double-click shows the year-specific tipo=2 blocking dialog", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const moduleRequests: CapturedRequest[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (url.pathname.startsWith(modulePath)) {
        moduleRequests.push({
          method: request.method(),
          url: request.url(),
        });
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
      "MWH-005 needs a latest and a prior runtime year",
    ).toBeGreaterThan(1);
    expect(runtimeRows.map(row => row.vigencia)).toEqual(
      runtimeRows.map(() => expect.any(Number)),
    );
    expect(new Set(runtimeRows.map(row => row.vigencia)).size).toBe(
      runtimeRows.length,
    );

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    const latestYear = Math.max(...runtimeYears);
    const priorYear = runtimeYears
      .filter(year => year < latestYear)
      .sort((left, right) => right - left)[0];
    const oldestYear = Math.min(...runtimeYears);

    expect(priorYear).toEqual(expect.any(Number));

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    const dialog = page.getByRole("dialog");
    const confirmButton = page.getByTestId(
      "mae-historico-salario-minimo-dialog-edit-not-allowed-confirm-button",
    );

    const doubleClickAndAssertBlocked = async (
      year: number,
    ): Promise<void> => {
      const requestOffset = moduleRequests.length;
      const validationResponsePromise = page.waitForResponse(response => {
        const url = new URL(response.url());

        return (
          response.request().method() === "GET" &&
          url.pathname === relationshipPath &&
          url.searchParams.get("vigencia") === String(year) &&
          url.searchParams.get("tipo") === "2"
        );
      });

      await minimumWageHistoryPage.row(year).dblclick();

      const validationResponse = await validationResponsePromise;
      expect(validationResponse.ok()).toBe(true);

      const expectedMessage =
        `No se puede actualizar un nuevo registro para la vigencia ${year}. Ya se cuenta con movimientos de nomina.`;
      const validation =
        (await validationResponse.json()) as RelationshipValidation;

      expect(validation).toEqual({
        permitido: false,
        mensaje: expectedMessage,
        vigenciaMaxHistorico: expect.any(Number),
        vigenciaMaxCompras: expect.any(Number),
        movimientosNomina: expect.any(Number),
        cierresCompras: expect.any(Number),
      });

      const relationshipRequests = moduleRequests
        .slice(requestOffset)
        .filter(request => {
          const url = new URL(request.url);

          return url.pathname === relationshipPath;
        });

      expect(
        relationshipRequests.some(request => {
          const url = new URL(request.url);

          return (
            request.method === "GET" &&
            url.searchParams.get("vigencia") === String(year) &&
            url.searchParams.get("tipo") === "1"
          );
        }),
        `Double-clicking ${year} must capture a tipo=1 request`,
      ).toBe(true);

      const typeTwoRequests = relationshipRequests.filter(request => {
        const url = new URL(request.url);

        return (
          request.method === "GET" &&
          url.searchParams.get("vigencia") === String(year) &&
          url.searchParams.get("tipo") === "2"
        );
      });

      expect(typeTwoRequests).toHaveLength(1);
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", {
          name: "Histórico salario mínimo",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        dialog.getByText(expectedMessage, { exact: true }),
      ).toBeVisible();
      await expect(confirmButton).toBeVisible();
    };

    // 1. Double-click a runtime prior-year row while capturing tipo=1 and tipo=2 validation requests.
    await doubleClickAndAssertBlocked(priorYear);

    // 2. Repeat with the oldest runtime row when it differs from the first sampled year.
    if (oldestYear !== priorYear) {
      await confirmButton.click();
      await expect(dialog).toBeHidden();
      await doubleClickAndAssertBlocked(oldestYear);
    }
  });

  test("MWH-006: Accepting the double-click dialog does not open Encabezado", async ({
    page,
  }) => {
    const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
    const moduleRequests: CapturedRequest[] = [];

    page.on("request", request => {
      const url = new URL(request.url());

      if (url.pathname.startsWith(modulePath)) {
        moduleRequests.push({
          method: request.method(),
          url: request.url(),
        });
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
      "MWH-006 needs a latest and a prior runtime year",
    ).toBeGreaterThan(1);

    const runtimeYears = runtimeRows.map(row => row.vigencia);
    const latestYear = Math.max(...runtimeYears);
    const priorYear = runtimeYears
      .filter(year => year < latestYear)
      .sort((left, right) => right - left)[0];

    expect(priorYear).toEqual(expect.any(Number));

    await minimumWageHistoryPage.pageSizeButton(100).click();
    await expect(
      minimumWageHistoryPage.pageSizeButton(100),
    ).toHaveAttribute("aria-pressed", "true");

    const dialog = page.getByRole("dialog");
    const confirmButton = page.getByTestId(
      "mae-historico-salario-minimo-dialog-edit-not-allowed-confirm-button",
    );
    const validationResponsePromise = page.waitForResponse(response => {
      const url = new URL(response.url());

      return (
        response.request().method() === "GET" &&
        url.pathname === relationshipPath &&
        url.searchParams.get("vigencia") === String(priorYear) &&
        url.searchParams.get("tipo") === "2"
      );
    });

    await minimumWageHistoryPage.row(priorYear).dblclick();

    const validationResponse = await validationResponsePromise;
    expect(validationResponse.ok()).toBe(true);
    await expect(dialog).toBeVisible();
    await expect(confirmButton).toBeVisible();

    // 1. After the tipo=2 dialog appears, begin observing tipo=3 and rows/{vigencia}, then click Aceptar once.
    const continuationObservation = page
      .waitForRequest(
        request => {
          const url = new URL(request.url());

          return (
            request.method() === "GET" &&
            ((url.pathname === relationshipPath &&
              url.searchParams.get("tipo") === "3") ||
              url.pathname.startsWith(`${rowsPath}/`))
          );
        },
        { timeout: 1_000 },
      )
      .catch(() => null);
    const requestOffset = moduleRequests.length;

    await confirmButton.click();

    await expect(dialog).toBeHidden();
    await expect(minimumWageHistoryPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(minimumWageHistoryPage.detailTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(await continuationObservation).toBeNull();

    const requestsAfterAccept = moduleRequests.slice(requestOffset);
    const typeThreeRequests = requestsAfterAccept.filter(request => {
      const url = new URL(request.url);

      return (
        request.method === "GET" &&
        url.pathname === relationshipPath &&
        url.searchParams.get("tipo") === "3"
      );
    });
    const detailRequests = requestsAfterAccept.filter(request => {
      const url = new URL(request.url);

      return (
        request.method === "GET" &&
        url.pathname.startsWith(`${rowsPath}/`)
      );
    });

    expect(typeThreeRequests).toHaveLength(0);
    expect(detailRequests).toHaveLength(0);
  });
});
