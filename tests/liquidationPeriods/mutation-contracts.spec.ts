// spec: specs/liquidation-periods-plan.md
// seed: tests/liquidationPeriods/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { LiquidationPeriodsPage } from "../../pages/LiquidationPeriods.page";

type PeriodType = "M" | "Q";

type LiquidationPeriodRecord = {
  kaNlPeriodo: number;
  scDiasLiquidacion: PeriodType;
  scPeriodo: number;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

type SubmittedPeriod = {
  kaNlPeriodo: number | null;
  scDiasLiquidacion: PeriodType;
  scPeriodo: number;
  fechaInicial: string | null;
  fechaFinal: string | null;
};

const applicationUrl = "https://nomina-qa.adacsc.co/periodos-liq";
const apiBase = "https://nomina-qa-api.adacsc.co/api/v1/w-periodos-liq";
const saveUrl = `${apiBase}/actions/grabar`;
const deleteUrl = `${apiBase}/actions/eliminar`;
const periodType: PeriodType = "M";
const submittedValues = {
  scPeriodo: 1,
  fechaInicial: "2026-01-01",
  fechaFinal: "2026-01-30",
};

function isRowsResponse(url: string): boolean {
  const parsedUrl = new URL(url);

  return (
    parsedUrl.pathname.endsWith("/w-periodos-liq/rows") &&
    parsedUrl.searchParams.get("tipoPeriodo") === periodType
  );
}

function rowIds(rows: LiquidationPeriodRecord[]): Set<number> {
  return new Set(rows.map(row => row.kaNlPeriodo));
}

function inputDate(value: string | null): string {
  return value?.slice(0, 10) ?? "";
}

test.describe("Serialized owned-record persistence contracts", () => {
  test.describe.configure({ mode: "serial" });

  test("LP-009: Save one valid owned period, prove persistence, and clean it up", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const saveRequests: Request[] = [];
    const ownedIds = new Set<number>();
    let baselineIds = new Set<number>();
    let authorization: string | undefined;

    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };

    const readRows = async (): Promise<LiquidationPeriodRecord[]> => {
      if (!authorization) {
        throw new Error(
          "The authenticated rows request did not provide an authorization header.",
        );
      }

      const response = await page.request.get(
        `${apiBase}/rows?tipoPeriodo=${periodType}`,
        { headers: { authorization } },
      );
      expect(response.ok()).toBe(true);
      return (await response.json()) as LiquidationPeriodRecord[];
    };

    const reloadAndSelectType = async (): Promise<LiquidationPeriodRecord[]> => {
      await page.reload();
      const rowsResponsePromise = page.waitForResponse(response =>
        response.request().method() === "GET" && isRowsResponse(response.url()),
      );
      await periodsPage.periodTypeSelect.click();
      await page.getByTestId("periodos-liq-type-option-m").click();
      const response = await rowsResponsePromise;
      expect(response.ok()).toBe(true);
      return (await response.json()) as LiquidationPeriodRecord[];
    };

    try {
      // 1. In a serial suite, fetch fresh rows for one type and retain every baseline kaNlPeriodo. Use any valid period and date values for the new row.
      await page.goto(applicationUrl);
      const initialRowsResponsePromise = page.waitForResponse(response =>
        response.request().method() === "GET" && isRowsResponse(response.url()),
      );
      await periodsPage.periodTypeSelect.click();
      await page.getByTestId("periodos-liq-type-option-m").click();

      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      const initialRows =
        (await initialRowsResponse.json()) as LiquidationPeriodRecord[];
      baselineIds = rowIds(initialRows);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(authorization).toBeTruthy();
      expect(baselineIds.size).toBe(initialRows.length);

      // 2. Add and fill one working row, start save observation, and click Save exactly once.
      await periodsPage.newButton.click();
      const workingRow = periodsPage.emptyWorkingRow();
      await expect(workingRow).toHaveCount(1);
      const inputs = workingRow.locator("input");
      await inputs.nth(0).fill(String(submittedValues.scPeriodo));
      await inputs.nth(1).fill(submittedValues.fechaInicial);
      await inputs.nth(2).fill(submittedValues.fechaFinal);

      page.on("request", recordSaveRequest);
      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.saveButton.click();

      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBe(true);
      expect(saveRequests).toHaveLength(1);

      const savePayload = saveResponse.request().postDataJSON() as {
        tipoPeriodo?: PeriodType;
        rows?: SubmittedPeriod[];
      };
      expect(savePayload).toEqual({
        tipoPeriodo: periodType,
        rows: expect.any(Array),
      });
      const submittedRows = savePayload.rows!;
      const submittedOwnedRows = submittedRows.filter(
        row =>
          row.kaNlPeriodo === null &&
          row.scDiasLiquidacion === periodType &&
          row.scPeriodo === submittedValues.scPeriodo &&
          inputDate(row.fechaInicial) === submittedValues.fechaInicial &&
          inputDate(row.fechaFinal) === submittedValues.fechaFinal,
      );
      expect(submittedOwnedRows).toHaveLength(1);

      const submittedBaselineIds = new Set(
        submittedRows
          .map(row => row.kaNlPeriodo)
          .filter((id): id is number => typeof id === "number"),
      );
      expect([...submittedBaselineIds].sort((a, b) => a - b)).toEqual(
        [...baselineIds].sort((a, b) => a - b),
      );
      for (const baselineRow of initialRows) {
        expect(
          submittedRows.find(
            row => row.kaNlPeriodo === baselineRow.kaNlPeriodo,
          ),
        ).toEqual(baselineRow);
      }

      const successDialog = page.getByRole("dialog");
      await expect(successDialog).toBeVisible();
      await expect(
        successDialog.getByRole("heading", { name: "Grabar periodo" }),
      ).toBeVisible();
      await expect(successDialog).toContainText(
        "La informacion se guardo correctamente.",
      );
      await successDialog.getByRole("button", { name: "Aceptar" }).click();

      // 3. Perform a true reload, reselect the type, and capture a fresh rows response.
      const persistedRows = await reloadAndSelectType();
      const newRows = persistedRows.filter(
        row => !baselineIds.has(row.kaNlPeriodo),
      );
      expect(newRows).toHaveLength(1);

      const ownedRecord = newRows[0];
      ownedIds.add(ownedRecord.kaNlPeriodo);
      expect(ownedRecord).toMatchObject({
        scDiasLiquidacion: periodType,
        scPeriodo: submittedValues.scPeriodo,
      });
      expect(inputDate(ownedRecord.fechaInicial)).toBe(
        submittedValues.fechaInicial,
      );
      expect(inputDate(ownedRecord.fechaFinal)).toBe(
        submittedValues.fechaFinal,
      );
      await expect(periodsPage.row(ownedRecord.kaNlPeriodo)).toHaveCount(1);
      await expect(
        periodsPage.periodInput(ownedRecord.kaNlPeriodo),
      ).toHaveValue(String(submittedValues.scPeriodo));
    } finally {
      page.off("request", recordSaveRequest);

      // 4. In finally, reload first, select only the owned ID, capture one delete request, then reload and read rows again.
      if (authorization) {
        const currentRows = await readRows();
        for (const row of currentRows) {
          if (!baselineIds.has(row.kaNlPeriodo)) {
            ownedIds.add(row.kaNlPeriodo);
          }
        }

        expect(
          ownedIds.size,
          "LP-009 cleanup must target exactly one non-baseline ID after a successful save.",
        ).toBeLessThanOrEqual(1);

        if (ownedIds.size === 1) {
          const [ownedId] = ownedIds;
          await reloadAndSelectType();
          await periodsPage.pageSizeButton(100).click();
          await expect(periodsPage.row(ownedId)).toBeVisible();
          await periodsPage.row(ownedId).click();

          const deleteResponsePromise = page.waitForResponse(
            response =>
              response.url() === deleteUrl &&
              response.request().method() === "POST",
          );
          await periodsPage.deleteButton.click();
          await page
            .getByTestId(
              "periodos-liq-dialog-delete-confirmation-confirm-button",
            )
            .click();

          const deleteResponse = await deleteResponsePromise;
          expect(deleteResponse.ok()).toBe(true);
          const deleteSuccessDialog = page.getByRole("dialog");
          await expect(
            deleteSuccessDialog.getByRole("heading", {
              name: "Eliminar periodo",
            }),
          ).toBeVisible();
          await expect(deleteSuccessDialog).toContainText(
            "El periodo fue borrado correctamente.",
          );
          const deletePayload = deleteResponse.request().postDataJSON() as {
            tipoPeriodo: PeriodType;
            kaNlPeriodo: number;
          };
          expect(deletePayload).toEqual({
            tipoPeriodo: periodType,
            kaNlPeriodo: ownedId,
          });
          expect(baselineIds.has(deletePayload.kaNlPeriodo)).toBe(false);

          const finalRows = await reloadAndSelectType();
          expect(finalRows.some(row => row.kaNlPeriodo === ownedId)).toBe(false);
          for (const baselineId of baselineIds) {
            expect(finalRows.some(row => row.kaNlPeriodo === baselineId)).toBe(
              true,
            );
          }
        }
      }
    }
  });
});
