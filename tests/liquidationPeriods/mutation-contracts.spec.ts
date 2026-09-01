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

  test("LP-010: @bug Save with no changes still sends a request", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const saveRequests: Request[] = [];

    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };

    const selectTypeAndReadRows = async (): Promise<
      LiquidationPeriodRecord[]
    > => {
      const rowsResponsePromise = page.waitForResponse(response =>
        response.request().method() === "GET" && isRowsResponse(response.url()),
      );
      await periodsPage.periodTypeSelect.click();
      await page.getByTestId("periodos-liq-type-option-m").click();
      const response = await rowsResponsePromise;
      expect(response.ok()).toBe(true);
      return (await response.json()) as LiquidationPeriodRecord[];
    };

    // 1. Load a type, retain the complete baseline response, make no edits and add no rows, then click Save while observing the save endpoint.
    await page.goto(applicationUrl);
    const baselineRows = await selectTypeAndReadRows();
    expect(rowIds(baselineRows).size).toBe(baselineRows.length);
    await expect(periodsPage.emptyWorkingRow()).toHaveCount(0);

    page.on("request", recordSaveRequest);
    const saveResponsePromise = page.waitForResponse(
      response =>
        response.url() === saveUrl && response.request().method() === "POST",
    );
    await periodsPage.saveButton.click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);
    expect(saveRequests).toHaveLength(1);
    expect(saveResponse.request().postDataJSON()).toEqual({
      tipoPeriodo: periodType,
      rows: baselineRows,
    });

    const successDialog = page.getByRole("dialog");
    await expect(successDialog).toBeVisible();
    await expect(
      successDialog.getByRole("heading", { name: "Grabar periodo" }),
    ).toBeVisible();
    await expect(successDialog).toContainText(
      "La informacion se guardo correctamente.",
    );
    await successDialog
      .getByTestId("periodos-liq-dialog-save-success-confirm-button")
      .click();
    page.off("request", recordSaveRequest);

    // 2. Reload, reselect the type, and compare fresh rows by stable ID and complete values.
    await page.reload();
    const freshRows = await selectTypeAndReadRows();
    const byStableId = (rows: LiquidationPeriodRecord[]) =>
      [...rows].sort((left, right) => left.kaNlPeriodo - right.kaNlPeriodo);

    expect(byStableId(freshRows)).toEqual(byStableId(baselineRows));
  });

  test("LP-011: Delete removes exactly one test-owned persisted record", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const deleteRequests: Request[] = [];
    let authorization: string | undefined;
    let baselineIds = new Set<number>();
    let ownedId: number | undefined;

    const recordDeleteRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === deleteUrl) {
        deleteRequests.push(request);
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

    const reloadAndSelectType = async (): Promise<
      LiquidationPeriodRecord[]
    > => {
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

    const deleteSelectedOwnedRecord = async (
      periodId: number,
    ): Promise<void> => {
      const deleteResponsePromise = page.waitForResponse(
        response =>
          response.url() === deleteUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.deleteButton.click();

      const confirmationDialog = page.getByRole("dialog");
      await expect(confirmationDialog).toBeVisible();
      await confirmationDialog
        .getByTestId(
          "periodos-liq-dialog-delete-confirmation-confirm-button",
        )
        .click();

      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBe(true);
      expect(deleteResponse.request().postDataJSON()).toEqual({
        tipoPeriodo: periodType,
        kaNlPeriodo: periodId,
      });

      const successDialog = page.getByRole("dialog");
      await expect(
        successDialog.getByRole("heading", { name: "Eliminar periodo" }),
      ).toBeVisible();
      await expect(successDialog).toContainText(
        "El periodo fue borrado correctamente.",
      );
    };

    try {
      // 1. Create one disposable period using the LP-009 ownership rules, reload, and locate it by captured kaNlPeriodo.
      await page.goto(applicationUrl);
      const initialRowsResponsePromise = page.waitForResponse(response =>
        response.request().method() === "GET" && isRowsResponse(response.url()),
      );
      await periodsPage.periodTypeSelect.click();
      await page.getByTestId("periodos-liq-type-option-m").click();

      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      const baselineRows =
        (await initialRowsResponse.json()) as LiquidationPeriodRecord[];
      baselineIds = rowIds(baselineRows);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(authorization).toBeTruthy();
      expect(baselineIds.size).toBe(baselineRows.length);

      await periodsPage.newButton.click();
      const workingInputs = periodsPage.emptyWorkingRow().locator("input");
      await workingInputs.nth(0).fill(String(submittedValues.scPeriodo));
      await workingInputs.nth(1).fill(submittedValues.fechaInicial);
      await workingInputs.nth(2).fill(submittedValues.fechaFinal);

      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBe(true);
      await page
        .getByTestId("periodos-liq-dialog-save-success-confirm-button")
        .click();

      const persistedRows = await reloadAndSelectType();
      const ownedRows = persistedRows.filter(
        row => !baselineIds.has(row.kaNlPeriodo),
      );
      expect(ownedRows).toHaveLength(1);
      ownedId = ownedRows[0].kaNlPeriodo;
      await periodsPage.pageSizeButton(100).click();
      await expect(periodsPage.row(ownedId)).toHaveCount(1);
      await expect(periodsPage.table.locator("tbody tr.selected")).toHaveCount(
        0,
      );

      // 2. Select the owned row and click Delete while capturing the request and any confirmation or feedback.
      page.on("request", recordDeleteRequest);
      await periodsPage.row(ownedId).click();
      await expect(periodsPage.table.locator("tbody tr.selected")).toHaveCount(
        1,
      );
      await deleteSelectedOwnedRecord(ownedId);
      page.off("request", recordDeleteRequest);
      expect(deleteRequests).toHaveLength(1);
      expect(deleteRequests[0].postDataJSON()).toEqual({
        tipoPeriodo: periodType,
        kaNlPeriodo: ownedId,
      });
      expect(baselineIds.has(ownedId)).toBe(false);

      // 3. Reload and capture fresh rows in the test body and again in failure-safe cleanup.
      const rowsAfterDelete = await reloadAndSelectType();
      expect(rowsAfterDelete.some(row => row.kaNlPeriodo === ownedId)).toBe(
        false,
      );
      for (const baselineId of baselineIds) {
        expect(
          rowsAfterDelete.some(row => row.kaNlPeriodo === baselineId),
        ).toBe(true);
      }
    } finally {
      page.off("request", recordDeleteRequest);
      if (authorization) {
        const rowsBeforeCleanup = await readRows();
        const ownedRecordStillExists =
          ownedId !== undefined &&
          rowsBeforeCleanup.some(row => row.kaNlPeriodo === ownedId);

        if (ownedRecordStillExists) {
          await reloadAndSelectType();
          await periodsPage.pageSizeButton(100).click();
          await expect(periodsPage.row(ownedId)).toBeVisible();
          await periodsPage.row(ownedId).click();
          await deleteSelectedOwnedRecord(ownedId);
        }

        const finalRows = await readRows();
        if (ownedId !== undefined) {
          expect(finalRows.some(row => row.kaNlPeriodo === ownedId)).toBe(false);
        }
        for (const baselineId of baselineIds) {
          expect(finalRows.some(row => row.kaNlPeriodo === baselineId)).toBe(
            true,
          );
        }
      }
    }
  });

  test("LP-012: Decimal period persists using the current integer conversion", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const decimalPeriod = "5.5";
    const submittedPeriod = 5.5;
    const persistedPeriod = 5;
    let authorization: string | undefined;
    let ownedId: number | undefined;
    let ownedDates:
      | { fechaInicial: string; fechaFinal: string }
      | undefined;

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

    const reloadAndSelectType = async (): Promise<
      LiquidationPeriodRecord[]
    > => {
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

    const isOwnedTuple = (row: LiquidationPeriodRecord): boolean =>
      ownedDates !== undefined &&
      row.scDiasLiquidacion === periodType &&
      row.scPeriodo === persistedPeriod &&
      inputDate(row.fechaInicial) === ownedDates.fechaInicial &&
      inputDate(row.fechaFinal) === ownedDates.fechaFinal;

    try {
      // 1. Create a uniquely identifiable working row with period 5.5 and valid dates, then save under the owned-record rules.
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
      const baselineIds = rowIds(initialRows);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(authorization).toBeTruthy();

      const candidateDates = Array.from({ length: 20 }, (_, index) => ({
        fechaInicial: `2026-02-${String(index + 1).padStart(2, "0")}`,
        fechaFinal: `2026-03-${String(index + 1).padStart(2, "0")}`,
      }));
      ownedDates = candidateDates.find(
        candidate =>
          !initialRows.some(
            row =>
              row.scPeriodo === persistedPeriod &&
              inputDate(row.fechaInicial) === candidate.fechaInicial &&
              inputDate(row.fechaFinal) === candidate.fechaFinal,
          ),
      );
      expect(
        ownedDates,
        "LP-012 requires one unused period/date tuple.",
      ).toBeTruthy();

      await periodsPage.newButton.click();
      const workingInputs = periodsPage.emptyWorkingRow().locator("input");
      await workingInputs.nth(0).fill(decimalPeriod);
      await expect(workingInputs.nth(0)).toHaveValue(decimalPeriod);
      await workingInputs.nth(1).fill(ownedDates!.fechaInicial);
      await workingInputs.nth(2).fill(ownedDates!.fechaFinal);

      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBe(true);

      const savePayload = saveResponse.request().postDataJSON() as {
        tipoPeriodo?: PeriodType;
        rows?: SubmittedPeriod[];
      };
      expect(savePayload.tipoPeriodo).toBe(periodType);
      const submittedOwnedRows = (savePayload.rows ?? []).filter(
        row =>
          row.kaNlPeriodo === null &&
          row.scDiasLiquidacion === periodType &&
          row.scPeriodo === submittedPeriod &&
          inputDate(row.fechaInicial) === ownedDates!.fechaInicial &&
          inputDate(row.fechaFinal) === ownedDates!.fechaFinal,
      );
      expect(submittedOwnedRows).toHaveLength(1);

      const successDialog = page.getByRole("dialog");
      await expect(successDialog).toContainText(
        "La informacion se guardo correctamente.",
      );
      await successDialog
        .getByTestId("periodos-liq-dialog-save-success-confirm-button")
        .click();

      // 2. Reload and locate the owned record by stable ID or unique tuple.
      const persistedRows = await reloadAndSelectType();
      const ownedRows = persistedRows.filter(
        row => !baselineIds.has(row.kaNlPeriodo) && isOwnedTuple(row),
      );
      expect(ownedRows).toHaveLength(1);
      ownedId = ownedRows[0].kaNlPeriodo;
      expect(ownedRows[0].scPeriodo).toBe(persistedPeriod);
      await periodsPage.pageSizeButton(100).click();
      await expect(periodsPage.row(ownedId)).toHaveCount(1);
      await expect(periodsPage.periodInput(ownedId)).toHaveValue(
        String(persistedPeriod),
      );
    } finally {
      if (authorization && ownedDates) {
        const currentRows = await readRows();
        const ownedRows = currentRows.filter(isOwnedTuple);
        expect(
          ownedRows,
          "LP-012 cleanup must never target more than one owned tuple.",
        ).toHaveLength(ownedRows.length > 0 ? 1 : 0);
        ownedId ??= ownedRows[0]?.kaNlPeriodo;

        if (ownedId !== undefined) {
          await reloadAndSelectType();
          await periodsPage.pageSizeButton(100).click();
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
          expect(deleteResponse.request().postDataJSON()).toEqual({
            tipoPeriodo: periodType,
            kaNlPeriodo: ownedId,
          });

          const finalRows = await readRows();
          expect(finalRows.some(row => row.kaNlPeriodo === ownedId)).toBe(false);
        }
      }
    }
  });

  test("LP-013: Very long period input follows the current overflow contract", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const attemptedPeriod = "9".repeat(11);
    const ownedDates = {
      fechaInicial: "2026-04-01",
      fechaFinal: "2026-04-30",
    };
    let authorization: string | undefined;
    let baselineIds = new Set<number>();

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

    // 1. Enter a 11-character repeated-digit value in a uniquely identifiable working row and determine the user-visible input value before Save.
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

    await periodsPage.newButton.click();
    const workingInputs = periodsPage.emptyWorkingRow().locator("input");
    const periodInput = workingInputs.nth(0);
    await periodInput.pressSequentially(attemptedPeriod);
    await expect(periodInput).toHaveValue(attemptedPeriod);
    await workingInputs.nth(1).fill(ownedDates.fechaInicial);
    await workingInputs.nth(2).fill(ownedDates.fechaFinal);

    // 2. If the value remains accepted, click Save once and capture the exact request, response, feedback, and fresh rows result.
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.url() === saveUrl && request.method() === "POST") {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    const saveResponsePromise = page.waitForResponse(
      response =>
        response.url() === saveUrl && response.request().method() === "POST",
    );
    await periodsPage.saveButton.click();
    const saveResponse = await saveResponsePromise;
    page.off("request", recordSaveRequest);

    expect(saveRequests).toHaveLength(1);
    expect(saveResponse.status()).toBe(503);
    const savePayload = saveResponse.request().postDataJSON() as {
      tipoPeriodo?: PeriodType;
      rows?: SubmittedPeriod[];
    };
    expect(savePayload.tipoPeriodo).toBe(periodType);
    expect(
      (savePayload.rows ?? []).filter(
        row =>
          row.kaNlPeriodo === null &&
          row.scDiasLiquidacion === periodType &&
          row.scPeriodo === Number(attemptedPeriod) &&
          inputDate(row.fechaInicial) === ownedDates.fechaInicial &&
          inputDate(row.fechaFinal) === ownedDates.fechaFinal,
      ),
    ).toHaveLength(1);

    const responseBody = (await saveResponse.json()) as {
      code?: string;
      message?: string;
      timestamp?: string;
    };
    expect(responseBody).toMatchObject({
      code: "DB_ERROR",
      message: expect.stringContaining(
        'ORA-12899: value too large for column "NOMINA"."PERIODOS_LIQUIDACION"."SC_PERIODO" (actual: 11, maximum: 10)',
      ),
      timestamp: expect.any(String),
    });
    expect(responseBody.message).toContain(
      "[sqlState=72000, errorCode=12899]",
    );

    const feedbackDialog = page.getByTestId(
      "periodos-liq-dialog-save-error",
    );
    await expect(feedbackDialog).toBeVisible();
    await expect(feedbackDialog.locator("#swal2-title")).toHaveText(
      "Error al grabar",
    );
    await expect(feedbackDialog.locator("#swal2-html-container")).toHaveText(
      responseBody.message!,
    );

    const freshRows = await readRows();
    expect(rowIds(freshRows)).toEqual(baselineIds);
    expect(
      freshRows.filter(
        row =>
          row.scPeriodo === Number(attemptedPeriod) &&
          inputDate(row.fechaInicial) === ownedDates.fechaInicial &&
          inputDate(row.fechaFinal) === ownedDates.fechaFinal,
      ),
    ).toHaveLength(0);
  });

  test("LP-014: Negative period remains accepted until validation is added", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const negativePeriod = -5;
    let authorization: string | undefined;
    let ownedId: number | undefined;
    let ownedDates:
      | { fechaInicial: string; fechaFinal: string }
      | undefined;
    let baselineIds = new Set<number>();

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

    const reloadAndSelectType = async (): Promise<
      LiquidationPeriodRecord[]
    > => {
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

    const isOwnedTuple = (row: LiquidationPeriodRecord): boolean =>
      ownedDates !== undefined &&
      row.scDiasLiquidacion === periodType &&
      row.scPeriodo === negativePeriod &&
      inputDate(row.fechaInicial) === ownedDates.fechaInicial &&
      inputDate(row.fechaFinal) === ownedDates.fechaFinal;

    try {
      // 1. Create a uniquely identifiable row with period -5 and valid dates, then save and reload under the owned-record rules.
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

      const candidateDates = Array.from({ length: 20 }, (_, index) => ({
        fechaInicial: `2026-09-${String(index + 1).padStart(2, "0")}`,
        fechaFinal: `2026-10-${String(index + 1).padStart(2, "0")}`,
      }));
      ownedDates = candidateDates.find(
        candidate =>
          !initialRows.some(
            row =>
              row.scPeriodo === negativePeriod &&
              inputDate(row.fechaInicial) === candidate.fechaInicial &&
              inputDate(row.fechaFinal) === candidate.fechaFinal,
          ),
      );
      expect(
        ownedDates,
        "LP-014 requires one unused negative-period/date tuple.",
      ).toBeTruthy();

      await periodsPage.newButton.click();
      const workingInputs = periodsPage.emptyWorkingRow().locator("input");
      const periodInput = workingInputs.nth(0);
      await periodInput.fill(String(negativePeriod));
      if ((await periodInput.inputValue()) !== String(negativePeriod)) {
        test.skip(
          true,
          "LP-014 gap appears closed: the UI blocks -5; replace this bug test with a rejection assertion.",
        );
      }
      await expect(periodInput).toHaveValue(String(negativePeriod));
      await workingInputs.nth(1).fill(ownedDates!.fechaInicial);
      await workingInputs.nth(2).fill(ownedDates!.fechaFinal);

      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.saveButton.click();
      const saveResponse = await saveResponsePromise;
      if (!saveResponse.ok()) {
        test.skip(
          true,
          `LP-014 gap appears closed: saving -5 was rejected with HTTP ${saveResponse.status()}; replace this bug test with a rejection assertion.`,
        );
      }

      const savePayload = saveResponse.request().postDataJSON() as {
        tipoPeriodo?: PeriodType;
        rows?: SubmittedPeriod[];
      };
      expect(savePayload.tipoPeriodo).toBe(periodType);
      expect(
        (savePayload.rows ?? []).filter(
          row =>
            row.kaNlPeriodo === null &&
            row.scDiasLiquidacion === periodType &&
            row.scPeriodo === negativePeriod &&
            inputDate(row.fechaInicial) === ownedDates!.fechaInicial &&
            inputDate(row.fechaFinal) === ownedDates!.fechaFinal,
        ),
      ).toHaveLength(1);
      await page
        .getByTestId("periodos-liq-dialog-save-success-confirm-button")
        .click();

      const persistedRows = await reloadAndSelectType();
      const ownedRows = persistedRows.filter(
        row => !baselineIds.has(row.kaNlPeriodo) && isOwnedTuple(row),
      );
      expect(ownedRows).toHaveLength(1);
      ownedId = ownedRows[0].kaNlPeriodo;
      expect(ownedRows[0].scPeriodo).toBe(negativePeriod);
      await periodsPage.pageSizeButton(100).click();
      await expect(periodsPage.row(ownedId)).toHaveCount(1);
      await expect(periodsPage.periodInput(ownedId)).toHaveValue(
        String(negativePeriod),
      );
    } finally {
      // 2. Delete the owned ID in finally.
      if (authorization && ownedDates) {
        const currentRows = await readRows();
        const ownedRows = currentRows.filter(
          row => !baselineIds.has(row.kaNlPeriodo) && isOwnedTuple(row),
        );
        expect(
          ownedRows,
          "LP-014 cleanup must never target more than one owned tuple.",
        ).toHaveLength(ownedRows.length > 0 ? 1 : 0);
        ownedId ??= ownedRows[0]?.kaNlPeriodo;

        if (ownedId !== undefined) {
          expect(baselineIds.has(ownedId)).toBe(false);
          await reloadAndSelectType();
          await periodsPage.pageSizeButton(100).click();
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
          expect(deleteResponse.request().postDataJSON()).toEqual({
            tipoPeriodo: periodType,
            kaNlPeriodo: ownedId,
          });

          const finalRows = await readRows();
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

  test("LP-015: @bug Invalid start date follows the current null-persistence contract", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    const periodsPage = new LiquidationPeriodsPage(page);
    const impossibleStartDate = "32/02/2026";
    let authorization: string | undefined;
    let ownedId: number | undefined;
    let ownedValues:
      | { scPeriodo: number; fechaFinal: string }
      | undefined;
    let baselineIds = new Set<number>();

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

    const reloadAndSelectType = async (): Promise<
      LiquidationPeriodRecord[]
    > => {
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

    const isOwnedTuple = (row: LiquidationPeriodRecord): boolean =>
      ownedValues !== undefined &&
      row.scDiasLiquidacion === periodType &&
      row.scPeriodo === ownedValues.scPeriodo &&
      row.fechaInicial === null &&
      inputDate(row.fechaFinal) === ownedValues.fechaFinal;

    try {
      // 1. Using user-like date entry only, attempt an impossible calendar start date on a uniquely identifiable row, then Save and reload.
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

      const candidates = Array.from({ length: 20 }, (_, index) => ({
        scPeriodo: 91500 + index,
        fechaFinal: `2026-12-${String(index + 1).padStart(2, "0")}`,
      }));
      ownedValues = candidates.find(
        candidate =>
          !initialRows.some(
            row =>
              row.scPeriodo === candidate.scPeriodo &&
              row.fechaInicial === null &&
              inputDate(row.fechaFinal) === candidate.fechaFinal,
          ),
      );
      expect(
        ownedValues,
        "LP-015 requires one unused period/end-date tuple.",
      ).toBeTruthy();

      await periodsPage.newButton.click();
      const workingInputs = periodsPage.emptyWorkingRow().locator("input");
      await workingInputs.nth(0).fill(String(ownedValues!.scPeriodo));
      const startDateInput = workingInputs.nth(1);
      await startDateInput.click();
      await startDateInput.pressSequentially(impossibleStartDate);
      await startDateInput.press("Tab");
      await workingInputs.nth(2).fill(ownedValues!.fechaFinal);

      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await periodsPage.saveButton.click();
      const saveResponse = await saveResponsePromise;
      if (!saveResponse.ok()) {
        const rejectionBody = await saveResponse.text();
        test.skip(
          true,
          `LP-015 gap appears closed: the API rejected the impossible start date with HTTP ${saveResponse.status()} (${rejectionBody}); replace this bug test with a rejection assertion.`,
        );
      }

      const savePayload = saveResponse.request().postDataJSON() as {
        tipoPeriodo?: PeriodType;
        rows?: SubmittedPeriod[];
      };
      expect(savePayload.tipoPeriodo).toBe(periodType);
      const submittedOwnedRows = (savePayload.rows ?? []).filter(
        row =>
          row.kaNlPeriodo === null &&
          row.scDiasLiquidacion === periodType &&
          row.scPeriodo === ownedValues!.scPeriodo,
      );
      expect(submittedOwnedRows).toHaveLength(1);
      expect(submittedOwnedRows[0]).toMatchObject({
        fechaInicial: null,
        fechaFinal: ownedValues!.fechaFinal,
      });
      await page
        .getByTestId("periodos-liq-dialog-save-success-confirm-button")
        .click();

      // 2. When the current bug remains reproducible, locate the owned record after reload.
      const persistedRows = await reloadAndSelectType();
      const ownedRows = persistedRows.filter(
        row => !baselineIds.has(row.kaNlPeriodo) && isOwnedTuple(row),
      );
      expect(ownedRows).toHaveLength(1);
      ownedId = ownedRows[0].kaNlPeriodo;
      expect(ownedRows[0].fechaInicial).toBeNull();
      await periodsPage.pageSizeButton(100).click();
      await expect(periodsPage.row(ownedId)).toHaveCount(1);
      await expect(periodsPage.startDateInput(ownedId)).toHaveValue("");
    } finally {
      if (authorization && ownedValues) {
        const currentRows = await readRows();
        const ownedRows = currentRows.filter(
          row => !baselineIds.has(row.kaNlPeriodo) && isOwnedTuple(row),
        );
        expect(
          ownedRows,
          "LP-015 cleanup must never target more than one owned tuple.",
        ).toHaveLength(ownedRows.length > 0 ? 1 : 0);
        ownedId ??= ownedRows[0]?.kaNlPeriodo;

        if (ownedId !== undefined) {
          expect(baselineIds.has(ownedId)).toBe(false);
          await reloadAndSelectType();
          await periodsPage.pageSizeButton(100).click();
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
          expect(deleteResponse.request().postDataJSON()).toEqual({
            tipoPeriodo: periodType,
            kaNlPeriodo: ownedId,
          });

          const finalRows = await readRows();
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
