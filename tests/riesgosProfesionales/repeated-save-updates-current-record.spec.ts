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
  scCodActividad: number;
  ssActividad: string;
};

const pageUrl = "https://nomina-qa.adacsc.co/riesgos-profesionales";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

test.describe("CRUD persistence and safe deletion", () => {
  test("RP-019: Save again without New updates the same record", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const className = "RP-019 REPEATED SAVE";
    const initialPercentage = 19.019;
    const updatedPercentage = 29.029;
    const baselineIds = new Set<number>();
    const testOwnedIds = new Set<number>();
    let disposableCode: string | undefined;

    const readRows = async (): Promise<RiskRow[]> => {
      const response = await page.request.get(rowsUrl);
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRow[];
    };

    const selectTestOwnedIds = async (ids: Set<number>): Promise<void> => {
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

        if (remainingIds.size === 0 || (await risksPage.nextPageButton.isDisabled())) {
          break;
        }

        await risksPage.nextPageButton.click();
      }

      expect(
        [...remainingIds],
        "Every RP-019 test-owned ID must be visible and selectable for cleanup.",
      ).toEqual([]);
    };

    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };

    try {
      // 1. Create one disposable record and retain its returned/runtime ID.
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

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `R${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCode = candidate;
          break;
        }
      }

      test.skip(
        disposableCode === undefined,
        "RP-019 requires one unused R00-RZZ code.",
      );

      await risksPage.createButton.click();
      await risksPage.codeInput.fill(disposableCode!);
      await risksPage.classInput.fill(className);
      await risksPage.percentageInput.fill(String(initialPercentage));
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

      page.on("request", recordSaveRequest);
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const createResponse = await createResponsePromise;
      expect(createResponse.ok()).toBe(true);
      const createdRecord = (await createResponse.json()) as RiskDetail;
      testOwnedIds.add(createdRecord.kaNlClase);

      expect(baselineIds.has(createdRecord.kaNlClase)).toBe(false);
      expect(createResponse.request().postDataJSON()).toEqual({
        kaNlClase: null,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: initialPercentage,
        kaNlActividad: selectedActivityId,
      });
      expect(createdRecord).toMatchObject({
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: initialPercentage,
        kaNlActividad: selectedActivityId,
      });
      expect(saveRequests).toHaveLength(1);

      // 2. Without clicking New, change only its percentage and click Save once while capturing the request.
      await risksPage.percentageInput.fill(String(updatedPercentage));

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const updateResponse = await updateResponsePromise;
      expect(updateResponse.ok()).toBe(true);
      expect(updateResponse.request().postDataJSON()).toEqual({
        kaNlClase: createdRecord.kaNlClase,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: updatedPercentage,
        kaNlActividad: selectedActivityId,
      });

      const updatedRecord = (await updateResponse.json()) as RiskDetail;
      expect(updatedRecord).toMatchObject({
        kaNlClase: createdRecord.kaNlClase,
        scCodigo: disposableCode,
        ssClase: className,
        ndPorcentaje: updatedPercentage,
        kaNlActividad: selectedActivityId,
      });
      expect(saveRequests).toHaveLength(2);

      // 3. Reload, capture a fresh GET /rows response, and compare the test-owned record by ID and code.
      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);

      const reloadedRows = (await reloadedRowsResponse.json()) as RiskRow[];
      const idAndCodeMatches = reloadedRows.filter(
        (risk) =>
          risk.kaNlClase === createdRecord.kaNlClase &&
          risk.scCodigo === disposableCode,
      );
      const codeMatches = reloadedRows.filter(
        (risk) => risk.scCodigo === disposableCode,
      );

      expect(idAndCodeMatches).toHaveLength(1);
      expect(codeMatches).toHaveLength(1);
      expect(idAndCodeMatches[0]).toMatchObject({
        ssClase: className,
        ndPorcentaje: updatedPercentage,
      });
    } finally {
      page.off("request", recordSaveRequest);

      // 4. Delete the disposable record and verify its ID is absent from a fresh /rows response.
      if (disposableCode !== undefined) {
        const currentRows = await readRows();
        for (const risk of currentRows) {
          if (
            risk.scCodigo === disposableCode &&
            !baselineIds.has(risk.kaNlClase)
          ) {
            testOwnedIds.add(risk.kaNlClase);
          }
        }
      }

      if (testOwnedIds.size > 0) {
        const cleanupRowsResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === rowsUrl && response.request().method() === "GET",
        );
        await page.reload();
        await cleanupRowsResponsePromise;
        await selectTestOwnedIds(testOwnedIds);

        const deleteResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === deleteUrl &&
            response.request().method() === "POST",
        );
        await risksPage.deleteButton.click();
        await expect(risksPage.deleteConfirmButton).toBeVisible();
        await risksPage.deleteConfirmButton.click();

        const deleteResponse = await deleteResponsePromise;
        expect(deleteResponse.ok()).toBe(true);
        const deletedIds = (
          deleteResponse.request().postDataJSON() as { ids?: number[] }
        ).ids;
        expect(deletedIds).toHaveLength(testOwnedIds.size);
        expect(new Set(deletedIds)).toEqual(testOwnedIds);
        expect(deletedIds?.some((id) => baselineIds.has(id))).toBe(false);

        const remainingRows = await readRows();
        expect(
          remainingRows.filter((risk) => testOwnedIds.has(risk.kaNlClase)),
        ).toHaveLength(0);
      }
    }
  });
});
