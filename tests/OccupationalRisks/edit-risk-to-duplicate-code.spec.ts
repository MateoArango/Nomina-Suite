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
  test("RP-021: Edit to another record's code is rejected without overwriting either row", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const baselineIds = new Set<number>();
    const testOwnedIds = new Set<number>();
    const disposableCodes: string[] = [];
    const capturedDetails: RiskDetail[] = [];
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
        "Every RP-021 test-owned ID must be visible and selectable for cleanup.",
      ).toEqual([]);
    };

    try {
      // 1. Create two disposable records with distinct unused codes and capture both IDs and complete details.
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
      const candidateOffset =
        (Date.now() + testInfo.workerIndex * 2) % (36 * 36);

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `D${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCodes.push(candidate);
          usedCodes.add(candidate);
        }

        if (disposableCodes.length === 2) {
          break;
        }
      }

      test.skip(
        disposableCodes.length !== 2,
        "RP-021 requires two unused D00-DZZ codes.",
      );

      const recordInputs = [
        {
          code: disposableCodes[0],
          className: "RP-021 FIRST",
          percentage: 21.021,
        },
        {
          code: disposableCodes[1],
          className: "RP-021 SECOND",
          percentage: 22.022,
        },
      ];

      for (const recordInput of recordInputs) {
        await risksPage.createButton.click();
        await risksPage.codeInput.fill(recordInput.code);
        await risksPage.classInput.fill(recordInput.className);
        await risksPage.percentageInput.fill(String(recordInput.percentage));
        await risksPage.openActivityModalButton.click();

        const firstVisibleActivityRow = risksPage.activityModal
          .locator(
            'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
          )
          .first();
        await expect(firstVisibleActivityRow).toBeVisible();

        const activityId = Number(
          (await firstVisibleActivityRow.getAttribute("data-testid"))
            ?.split("--")
            .at(-1),
        );
        expect(Number.isInteger(activityId)).toBe(true);

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
          scCodigo: recordInput.code,
          ssClase: recordInput.className,
          ndPorcentaje: recordInput.percentage,
          kaNlActividad: activityId,
        });

        const savedDetail = (await createResponse.json()) as RiskDetail;
        expect(baselineIds.has(savedDetail.kaNlClase)).toBe(false);
        testOwnedIds.add(savedDetail.kaNlClase);

        const detailResponse = await page.request.get(
          `${rowsUrl}/${savedDetail.kaNlClase}`,
          { headers: { authorization: authorization! } },
        );
        expect(detailResponse.ok()).toBe(true);
        const persistedDetail = (await detailResponse.json()) as RiskDetail;
        expect(persistedDetail).toEqual(savedDetail);
        expect(persistedDetail).toMatchObject({
          scCodigo: recordInput.code,
          ssClase: recordInput.className,
          ndPorcentaje: recordInput.percentage,
          kaNlActividad: activityId,
        });
        capturedDetails.push(persistedDetail);
      }

      expect(testOwnedIds.size).toBe(2);
      expect(capturedDetails).toHaveLength(2);
      expect(capturedDetails[0].kaNlClase).not.toBe(
        capturedDetails[1].kaNlClase,
      );

      // 2. Open the first record, replace its code with the second record's code, and save while capturing the response and feedback.
      await risksPage.pageSizeButton(100).click();
      const firstDetailResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === `${rowsUrl}/${capturedDetails[0].kaNlClase}` &&
          response.request().method() === "GET",
      );
      await risksPage.riskRow(capturedDetails[0].kaNlClase).dblclick();

      const firstDetailResponse = await firstDetailResponsePromise;
      expect(firstDetailResponse.ok()).toBe(true);
      expect((await firstDetailResponse.json()) as RiskDetail).toEqual(
        capturedDetails[0],
      );

      await risksPage.codeInput.fill(capturedDetails[1].scCodigo);

      const duplicateResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const duplicateResponse = await duplicateResponsePromise;
      expect(duplicateResponse.status()).toBe(409);
      expect(duplicateResponse.request().postDataJSON()).toEqual({
        kaNlClase: capturedDetails[0].kaNlClase,
        scCodigo: capturedDetails[1].scCodigo,
        ssClase: capturedDetails[0].ssClase,
        ndPorcentaje: capturedDetails[0].ndPorcentaje,
        kaNlActividad: capturedDetails[0].kaNlActividad,
      });
      expect(await duplicateResponse.json()).toMatchObject({
        code: "CONFLICT",
        message: "Ya existe un registro con esos datos.",
      });
      await expect(risksPage.feedbackMessage).toHaveText(
        "Ya existe un registro con esos datos.",
      );
      await risksPage.acknowledgeFeedbackButton.click();

      const rowsAfterRejection = await readRows();
      expect(
        rowsAfterRejection.filter((risk) =>
          disposableCodes.includes(risk.scCodigo),
        ),
      ).toHaveLength(2);

      // 3. Reload, capture a fresh GET /rows response, and compare both test-owned IDs with their captured details.
      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();
      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);
      const reloadedRows = (await reloadedRowsResponse.json()) as RiskRow[];

      for (const capturedDetail of capturedDetails) {
        const matchingRows = reloadedRows.filter(
          (risk) =>
            risk.kaNlClase === capturedDetail.kaNlClase &&
            risk.scCodigo === capturedDetail.scCodigo,
        );
        expect(matchingRows).toHaveLength(1);
        expect(matchingRows[0]).toMatchObject({
          ssClase: capturedDetail.ssClase,
          ndPorcentaje: capturedDetail.ndPorcentaje,
        });

        const detailResponse = await page.request.get(
          `${rowsUrl}/${capturedDetail.kaNlClase}`,
          { headers: { authorization: authorization! } },
        );
        expect(detailResponse.ok()).toBe(true);
        expect((await detailResponse.json()) as RiskDetail).toEqual(
          capturedDetail,
        );
      }

      for (const code of disposableCodes) {
        expect(
          reloadedRows.filter((risk) => risk.scCodigo === code),
        ).toHaveLength(1);
      }
    } finally {
      // 4. Delete both test-owned records and verify both IDs are absent from a fresh /rows response.
      if (authorization && disposableCodes.length > 0) {
        const currentRows = await readRows();
        for (const risk of currentRows) {
          if (
            disposableCodes.includes(risk.scCodigo) &&
            !baselineIds.has(risk.kaNlClase)
          ) {
            testOwnedIds.add(risk.kaNlClase);
          }
        }
      }

      expect(
        testOwnedIds.size,
        "RP-021 cleanup must target at most two test-owned records.",
      ).toBeLessThanOrEqual(2);

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
