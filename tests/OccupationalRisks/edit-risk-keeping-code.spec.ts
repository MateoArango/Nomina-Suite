// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

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
  test("RP-020: Edit with unchanged code persists other fields and can be restored", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const originalClass = "RP-020 ORIGINAL";
    const originalPercentage = 20.02;
    const updatedClass = "RP-020 UPDATED";
    const updatedPercentage = 30.03;
    const baselineIds = new Set<number>();
    const testOwnedIds = new Set<number>();
    let disposableCode: string | undefined;
    let authorization: string | undefined;

    const readRows = async (): Promise<RiskRow[]> => {
      if (!authorization) {
        throw new Error(
          "The authenticated browser request did not provide an authorization header.",
        );
      }

      const response = await page.request.get(rowsUrl, {
        headers: { authorization },
      });
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
        "Every RP-020 test-owned ID must be visible and selectable for cleanup.",
      ).toEqual([]);
    };

    try {
      // 1. Create a disposable record, reload, capture its complete persisted detail, and double-click its ID-scoped row.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto(pageUrl);
      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(
        authorization,
        "The initial browser /rows request must be authenticated.",
      ).toBeTruthy();

      const initialRows = (await initialRowsResponse.json()) as RiskRow[];
      initialRows.forEach((risk) => baselineIds.add(risk.kaNlClase));

      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex) % (36 * 36);

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `E${((candidateOffset + attempt) % (36 * 36))
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
        "RP-020 requires one unused E00-EZZ code.",
      );

      await risksPage.createButton.click();
      await risksPage.codeInput.fill(disposableCode!);
      await risksPage.classInput.fill(originalClass);
      await risksPage.percentageInput.fill(String(originalPercentage));
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
        ssClase: originalClass,
        ndPorcentaje: originalPercentage,
        kaNlActividad: selectedActivityId,
      });

      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);

      const originalDetailResponse = await page.request.get(
        `${rowsUrl}/${createdRecord.kaNlClase}`,
        { headers: { authorization: authorization! } },
      );
      expect(originalDetailResponse.ok()).toBe(true);
      const originalDetail =
        (await originalDetailResponse.json()) as RiskDetail;
      expect(originalDetail).toMatchObject({
        kaNlClase: createdRecord.kaNlClase,
        scCodigo: disposableCode,
        ssClase: originalClass,
        ndPorcentaje: originalPercentage,
        kaNlActividad: selectedActivityId,
      });

      await risksPage.pageSizeButton(100).click();
      const editDetailResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === `${rowsUrl}/${createdRecord.kaNlClase}` &&
          response.request().method() === "GET",
      );
      await risksPage.riskRow(createdRecord.kaNlClase).dblclick();
      const editDetailResponse = await editDetailResponsePromise;
      expect(editDetailResponse.ok()).toBe(true);
      expect((await editDetailResponse.json()) as RiskDetail).toEqual(
        originalDetail,
      );
      await expect(risksPage.codeInput).toHaveValue(originalDetail.scCodigo);
      await expect(risksPage.classInput).toHaveValue(originalDetail.ssClase);
      await expect(risksPage.percentageInput).toHaveValue(
        String(originalDetail.ndPorcentaje),
      );
      await expect(risksPage.activityInput).toHaveValue(
        `${originalDetail.scCodActividad} - ${originalDetail.ssActividad}`,
      );

      // 2. Keep the code unchanged, modify class and percentage, save once, reload, and read the same ID through a fresh /rows/{id} response.
      await risksPage.classInput.fill(updatedClass);
      await risksPage.percentageInput.fill(String(updatedPercentage));

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const updateResponse = await updateResponsePromise;
      expect(updateResponse.ok()).toBe(true);
      expect(updateResponse.request().postDataJSON()).toEqual({
        kaNlClase: originalDetail.kaNlClase,
        scCodigo: originalDetail.scCodigo,
        ssClase: updatedClass,
        ndPorcentaje: updatedPercentage,
        kaNlActividad: originalDetail.kaNlActividad,
      });

      const updatedSaveDetail = (await updateResponse.json()) as RiskDetail;
      expect(updatedSaveDetail).toMatchObject({
        kaNlClase: originalDetail.kaNlClase,
        scCodigo: originalDetail.scCodigo,
        ssClase: updatedClass,
        ndPorcentaje: updatedPercentage,
        kaNlActividad: originalDetail.kaNlActividad,
      });

      const updatedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const updatedRowsResponse = await updatedRowsResponsePromise;
      expect(updatedRowsResponse.ok()).toBe(true);

      const updatedDetailResponse = await page.request.get(
        `${rowsUrl}/${originalDetail.kaNlClase}`,
        { headers: { authorization: authorization! } },
      );
      expect(updatedDetailResponse.ok()).toBe(true);
      expect((await updatedDetailResponse.json()) as RiskDetail).toMatchObject({
        kaNlClase: originalDetail.kaNlClase,
        scCodigo: originalDetail.scCodigo,
        ssClase: updatedClass,
        ndPorcentaje: updatedPercentage,
        kaNlActividad: originalDetail.kaNlActividad,
      });
    } finally {
      // 3. Delete the disposable record and verify the final state through the API by ID.
      if (authorization && disposableCode !== undefined) {
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
