// spec: specs/minimum-wage-history-plan.md
// seed: tests/minimumWageHistory/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { MinimumWageHistoryPage } from "../../pages/MinimumWageHistory.page";

type MinimumWageHistoryRow = {
  vigencia: number;
  ndSalarioMinimoGob: number;
  ndSubsidioMes: number;
  ndSubsidioAlimentacion: number | null;
  ndIpc: number | null;
  ndPorcentajePension: number | null;
  codigoMempresa: string;
  usuarioEmpresa: string;
  fechaActualiza: string;
  usuarioActualiza: number | null;
};

type SavePayload = {
  row: MinimumWageHistoryRow;
  isNuevo: boolean;
  vigenciaOriginal: number;
  codigoAplicacion: number;
  codigoUsuario: number;
};

const applicationUrl =
  "https://nomina-qa.adacsc.co/mae-historico-salario-minimo";
const modulePath = "/api/v1/w-mae-historico-salario-minimo";
const rowsPath = `${modulePath}/rows`;
const savePath = `${modulePath}/actions/grabar`;
const relationshipPath = `${modulePath}/actions/validar-relacion`;
const successMessage = "El registro ha sido procesado correctamente";

test.describe.serial(
  "Serialized latest-year persistence and validation contracts",
  () => {
    test("MWH-014: Valid integer and decimal subsidies save as a complete-row update", async ({
      page,
    }) => {
      test.setTimeout(120_000);

      const minimumWageHistoryPage = new MinimumWageHistoryPage(page);
      const observedSaveRequests: string[] = [];
      let originalBaseline: MinimumWageHistoryRow | undefined;

      page.on("request", request => {
        const url = new URL(request.url());

        if (
          request.method() === "POST" &&
          url.pathname === savePath
        ) {
          observedSaveRequests.push(request.url());
        }
      });

      const isRowsResponse = (url: string): boolean =>
        new URL(url).pathname === rowsPath;

      const loadFreshRows = async (
        action: () => Promise<unknown>,
      ): Promise<MinimumWageHistoryRow[]> => {
        const rowsResponsePromise = page.waitForResponse(
          response =>
            response.request().method() === "GET" &&
            isRowsResponse(response.url()),
        );
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

        await action();

        const [rowsResponse, initialRelationshipResponse] =
          await Promise.all([
            rowsResponsePromise,
            initialRelationshipResponsePromise,
          ]);

        expect(rowsResponse.ok()).toBe(true);
        expect(initialRelationshipResponse.ok()).toBe(true);

        const rows = (await rowsResponse.json()) as MinimumWageHistoryRow[];
        expect(rows.length, "MWH-014 needs at least one runtime row").toBeGreaterThan(
          0,
        );
        expect(rows.map(row => row.vigencia)).toEqual(
          rows.map(() => expect.any(Number)),
        );

        return rows;
      };

      const openDetail = async (
        year: number,
      ): Promise<MinimumWageHistoryRow> => {
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
            url.pathname === `${rowsPath}/${year}`
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

        const detailValidation = (await detailValidationResponse.json()) as {
          mensaje: string | null;
        };
        const detail =
          (await detailResponse.json()) as MinimumWageHistoryRow;

        expect(detailValidation.mensaje).toBeNull();
        expect(detail.vigencia).toBe(year);

        return detail;
      };

      const restoreOriginalBaseline = async (): Promise<void> => {
        if (!originalBaseline) {
          return;
        }

        const currentRows = await loadFreshRows(() => page.reload());
        const currentRow = currentRows.find(
          row => row.vigencia === originalBaseline!.vigencia,
        );

        expect(
          currentRow,
          "The captured latest-year row must still exist during cleanup",
        ).toBeDefined();

        if (
          currentRow!.ndSubsidioAlimentacion !==
          originalBaseline.ndSubsidioAlimentacion
        ) {
          await openDetail(originalBaseline.vigencia);
          await minimumWageHistoryPage.detailFoodSubsidyInput.fill(
            originalBaseline.ndSubsidioAlimentacion === null
              ? ""
              : String(originalBaseline.ndSubsidioAlimentacion),
          );

          const restoreResponsePromise = page.waitForResponse(response => {
            const url = new URL(response.url());

            return (
              response.request().method() === "POST" &&
              url.pathname === savePath
            );
          });

          await minimumWageHistoryPage.saveButton.click();

          const restoreResponse = await restoreResponsePromise;
          expect(restoreResponse.ok()).toBe(true);
          expect(restoreResponse.request().postDataJSON()).toMatchObject({
            row: originalBaseline,
            isNuevo: false,
            vigenciaOriginal: originalBaseline.vigencia,
          });
        }

        const restoredRows = await loadFreshRows(() => page.reload());
        expect(
          restoredRows.find(
            row => row.vigencia === originalBaseline!.vigencia,
          ),
        ).toEqual(originalBaseline);
      };

      const initialRows = await loadFreshRows(() => page.goto(applicationUrl));
      const initialYears = initialRows.map(row => row.vigencia);
      expect(new Set(initialYears).size).toBe(initialRows.length);

      const latestYear = Math.max(...initialYears);
      originalBaseline = initialRows.find(
        row => row.vigencia === latestYear,
      );
      expect(originalBaseline).toBeDefined();

      const baselineSubsidy =
        originalBaseline!.ndSubsidioAlimentacion ?? 0;
      const integerSubsidy = Math.max(
        0,
        Math.floor(baselineSubsidy) + 1,
      );
      const decimalSubsidy = integerSubsidy + 0.5;

      expect(integerSubsidy).not.toBe(baselineSubsidy);
      expect(decimalSubsidy).not.toBe(baselineSubsidy);

      const iterations = [
        { name: "integer subsidy", submittedSubsidy: integerSubsidy },
        { name: "decimal subsidy", submittedSubsidy: decimalSubsidy },
      ];

      for (const iteration of iterations) {
        await test.step(iteration.name, async () => {
          try {
            // 1. Fetch the latest complete row, retain the baseline, edit only Subsidio alimentación, and click Guardar once while capturing POST /actions/grabar.
            const freshRows = await loadFreshRows(() => page.reload());
            const freshBaseline = freshRows.find(
              row => row.vigencia === latestYear,
            );

            expect(freshBaseline).toEqual(originalBaseline);

            const detail = await openDetail(latestYear);
            expect(detail).toEqual(freshBaseline);

            await expect(
              minimumWageHistoryPage.detailFoodSubsidyInput,
            ).toHaveValue(
              freshBaseline!.ndSubsidioAlimentacion === null
                ? ""
                : String(freshBaseline!.ndSubsidioAlimentacion),
            );

            await minimumWageHistoryPage.detailFoodSubsidyInput.fill(
              String(iteration.submittedSubsidy),
            );
            await expect(
              minimumWageHistoryPage.detailFoodSubsidyInput,
            ).toHaveValue(String(iteration.submittedSubsidy));

            const saveRequestCountBeforeClick =
              observedSaveRequests.length;
            const saveResponsePromise = page.waitForResponse(response => {
              const url = new URL(response.url());

              return (
                response.request().method() === "POST" &&
                url.pathname === savePath
              );
            });

            await minimumWageHistoryPage.saveButton.click();

            const saveResponse = await saveResponsePromise;
            expect(observedSaveRequests).toHaveLength(
              saveRequestCountBeforeClick + 1,
            );
            expect(saveResponse.ok()).toBe(true);

            const expectedUpdatedRow = {
              ...freshBaseline!,
              ndSubsidioAlimentacion: iteration.submittedSubsidy,
            };
            const savePayload =
              saveResponse.request().postDataJSON() as SavePayload;

            expect(savePayload.isNuevo).toBe(false);
            expect(savePayload.vigenciaOriginal).toBe(latestYear);
            expect(savePayload.row).toEqual(expectedUpdatedRow);
            expect(savePayload.codigoAplicacion).toEqual(
              expect.any(Number),
            );
            expect(savePayload.codigoUsuario).toEqual(expect.any(Number));

            const saveResponseRows =
              (await saveResponse.json()) as MinimumWageHistoryRow[];
            expect(
              saveResponseRows.find(row => row.vigencia === latestYear),
            ).toEqual(expectedUpdatedRow);

            await expect(
              page.getByRole("dialog").getByRole("heading", {
                name: "Guardar",
                exact: true,
              }),
            ).toBeVisible();
            await expect(
              page.getByRole("dialog").getByText(successMessage, {
                exact: true,
              }),
            ).toBeVisible();

            // 2. Reload, re-fetch the latest row, and compare complete-row persistence for this independent iteration.
            const persistedRows = await loadFreshRows(() => page.reload());
            expect(
              persistedRows.find(row => row.vigencia === latestYear),
            ).toEqual(expectedUpdatedRow);
          } finally {
            // 2. In finally, restore the complete original subsidy for the same vigencia, reload, and prove the full baseline row is restored.
            await restoreOriginalBaseline();
          }
        });
      }
    });
  },
);
