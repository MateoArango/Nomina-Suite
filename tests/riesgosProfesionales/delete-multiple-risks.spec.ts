// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRow = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

type RiskDetail = RiskRow & {
  kaNlActividad: number;
};

const pageUrl = "https://nomina-qa.adacsc.co/riesgos-profesionales";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

test.describe("CRUD persistence and safe deletion", () => {
  test("RP-023: Delete multiple disposable records in one scoped operation", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const recordCount = 2;
    const baselineIds = new Set<number>();
    const disposableCodes: string[] = [];
    const createdIds = new Set<number>();
    let deletionCompleted = false;

    const readRows = async (): Promise<RiskRow[]> => {
      const response = await page.request.get(rowsUrl);
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRow[];
    };

    const selectOnlyIds = async (ids: Set<number>): Promise<void> => {
      await risksPage.pageSizeButton(100).click();

      while (!(await risksPage.previousPageButton.isDisabled())) {
        await risksPage.previousPageButton.click();
      }

      const remainingIds = new Set(ids);
      while (true) {
        for (const id of [...remainingIds]) {
          const checkbox = risksPage.riskCheckbox(id);
          if ((await checkbox.count()) === 1 && (await checkbox.isVisible())) {
            await checkbox.check();
            remainingIds.delete(id);
          }
        }

        if (
          remainingIds.size === 0 ||
          (await risksPage.nextPageButton.isDisabled())
        ) {
          break;
        }

        await risksPage.nextPageButton.click();
      }

      expect(
        [...remainingIds],
        "Every RP-023 test-owned ID must be visible and selectable.",
      ).toEqual([]);
    };

    const confirmDeleteIfPresented = async (): Promise<void> => {
      const confirmationPresented = await risksPage.deleteConfirmButton
        .waitFor({ state: "visible", timeout: 2_000 })
        .then(() => true)
        .catch(() => false);

      if (confirmationPresented) {
        await risksPage.deleteConfirmButton.click();
      }
    };

    const deleteRequests: Request[] = [];
    const recordDeleteRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === deleteUrl) {
        deleteRequests.push(request);
      }
    };

    try {
      // 1. Create at least two disposable records, retain their IDs, reload, and select only those ID-scoped checkboxes.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto(pageUrl);
      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);

      const initialRows = (await initialRowsResponse.json()) as RiskRow[];
      initialRows.forEach((risk) => baselineIds.add(risk.kaNlClase));

      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex) % (36 * 36);

      for (
        let attempt = 0;
        attempt < 36 * 36 && disposableCodes.length < recordCount;
        attempt += 1
      ) {
        const candidate =
          "Y" +
          ((candidateOffset + attempt) % (36 * 36))
            .toString(36)
            .toUpperCase()
            .padStart(2, "0");

        if (!usedCodes.has(candidate)) {
          disposableCodes.push(candidate);
          usedCodes.add(candidate);
        }
      }

      test.skip(
        disposableCodes.length < recordCount,
        "RP-023 requires two unused Y00-YZZ codes.",
      );

      for (const [index, disposableCode] of disposableCodes.entries()) {
        const className = "RP-023 DELETE " + (index + 1);
        const percentage = Number((23.021 + index / 1_000).toFixed(3));

        await risksPage.createButton.click();
        await risksPage.codeInput.fill(disposableCode);
        await risksPage.classInput.fill(className);
        await risksPage.percentageInput.fill(String(percentage));
        await risksPage.openActivityModalButton.click();

        const firstVisibleActivityRow = risksPage.activityModal
          .locator(
            'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
          )
          .first();
        await expect(firstVisibleActivityRow).toBeVisible();

        const selectedActivityId = Number(
          (await firstVisibleActivityRow.getAttribute("data-testid"))
            ?.split("--")
            .at(-1),
        );
        expect(Number.isInteger(selectedActivityId)).toBe(true);

        await firstVisibleActivityRow.click();
        await risksPage.acceptActivityButton.click();

        const createResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === saveUrl &&
            response.request().method() === "POST",
        );
        await risksPage.saveButton.click();

        const createResponse = await createResponsePromise;
        expect(createResponse.ok()).toBe(true);
        expect(createResponse.request().postDataJSON()).toEqual({
          kaNlClase: null,
          scCodigo: disposableCode,
          ssClase: className,
          ndPorcentaje: percentage,
          kaNlActividad: selectedActivityId,
        });

        const createdRecord = (await createResponse.json()) as RiskDetail;
        expect(baselineIds.has(createdRecord.kaNlClase)).toBe(false);
        expect(createdIds.has(createdRecord.kaNlClase)).toBe(false);
        expect(createdRecord).toMatchObject({
          scCodigo: disposableCode,
          ssClase: className,
          ndPorcentaje: percentage,
          kaNlActividad: selectedActivityId,
        });
        createdIds.add(createdRecord.kaNlClase);
      }

      expect(createdIds.size).toBe(recordCount);

      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);

      const reloadedRows = await readRows();
      expect(
        reloadedRows.filter((risk) => createdIds.has(risk.kaNlClase)),
      ).toHaveLength(recordCount);

      const checkedCheckboxes = risksPage.riskTable.locator(
        'input[data-testid^="riesgos-profesionales-table-select-checkbox--"]:checked',
      );
      await expect(checkedCheckboxes).toHaveCount(0);
      await selectOnlyIds(createdIds);

      for (const id of createdIds) {
        await expect(risksPage.riskCheckbox(id)).toBeChecked();
      }
      await expect(checkedCheckboxes).toHaveCount(recordCount);

      const selectedIds = new Set(
        await checkedCheckboxes.evaluateAll((checkboxes) =>
          checkboxes.map((checkbox) =>
            Number(checkbox.getAttribute("data-testid")?.split("--").at(-1)),
          ),
        ),
      );
      expect(selectedIds).toEqual(createdIds);
      expect([...selectedIds].some((id) => baselineIds.has(id))).toBe(false);
      await expect(risksPage.deleteButton).toBeEnabled();

      // 2. Start counting /actions/borrar requests and click Delete Selected; confirm only if prompted.
      page.on("request", recordDeleteRequest);
      const deleteResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === deleteUrl &&
          response.request().method() === "POST",
      );
      await risksPage.deleteButton.click();
      await confirmDeleteIfPresented();

      const deleteResponse = await deleteResponsePromise;
      expect(deleteResponse.ok()).toBe(true);
      expect(deleteRequests).toHaveLength(1);

      const deletePayload = deleteResponse.request().postDataJSON() as {
        ids?: number[];
      };
      expect(new Set(deletePayload.ids)).toEqual(createdIds);
      expect(deletePayload.ids).toHaveLength(createdIds.size);
      expect(deletePayload.ids?.some((id) => baselineIds.has(id))).toBe(false);
      deletionCompleted = true;
      page.off("request", recordDeleteRequest);

      // 3. Reload and capture a fresh GET /rows response.
      const finalRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const finalRowsResponse = await finalRowsResponsePromise;
      expect(finalRowsResponse.ok()).toBe(true);

      const finalRows = await readRows();
      expect(
        finalRows.filter((risk) => createdIds.has(risk.kaNlClase)),
      ).toHaveLength(0);
      expect(new Set(deletePayload.ids)).toEqual(createdIds);
      expect(deletePayload.ids?.some((id) => baselineIds.has(id))).toBe(false);
    } finally {
      page.off("request", recordDeleteRequest);

      if (!deletionCompleted && disposableCodes.length > 0) {
        const currentRows = await readRows();
        const codeSet = new Set(disposableCodes);
        const remainingTestOwnedIds = new Set(
          currentRows
            .filter(
              (risk) =>
                codeSet.has(String(risk.scCodigo).toUpperCase()) &&
                !baselineIds.has(risk.kaNlClase),
            )
            .map((risk) => risk.kaNlClase),
        );

        expect(
          remainingTestOwnedIds.size,
          "RP-023 failure-safe cleanup must target only the test-owned records.",
        ).toBeLessThanOrEqual(recordCount);

        if (remainingTestOwnedIds.size > 0) {
          const cleanupRowsResponsePromise = page.waitForResponse(
            (response) =>
              response.url() === rowsUrl &&
              response.request().method() === "GET",
          );
          await page.reload();
          await cleanupRowsResponsePromise;
          await selectOnlyIds(remainingTestOwnedIds);

          const cleanupDeleteResponsePromise = page.waitForResponse(
            (response) =>
              response.url() === deleteUrl &&
              response.request().method() === "POST",
          );
          await risksPage.deleteButton.click();
          await confirmDeleteIfPresented();

          const cleanupDeleteResponse = await cleanupDeleteResponsePromise;
          expect(cleanupDeleteResponse.ok()).toBe(true);
          const cleanupIds = (
            cleanupDeleteResponse.request().postDataJSON() as {
              ids?: number[];
            }
          ).ids;
          expect(new Set(cleanupIds)).toEqual(remainingTestOwnedIds);
          expect(cleanupIds).toHaveLength(remainingTestOwnedIds.size);
          expect(cleanupIds?.some((id) => baselineIds.has(id))).toBe(false);
        }
      }
    }
  });
});
