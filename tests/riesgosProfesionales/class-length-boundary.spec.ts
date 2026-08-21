// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRecord = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

const acceptedClass = "A".repeat(50);
const rejectedClass = "B".repeat(51);

test.describe("Validation and backend error contracts", () => {
  test("RP-011: Class length boundary distinguishes accepted data from current server failure", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const createdIds = new Set<number>();
    const testOwnedCodes = new Set<string>();

    const readRows = async (): Promise<RiskRecord[]> => {
      const response = await page.request.get(rowsUrl);
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRecord[];
    };

    const locateAndSelectTestOwnedRows = async (): Promise<void> => {
      const pendingIds = new Set(createdIds);
      await risksPage.pageSizeButton(100).click();

      while (pendingIds.size > 0) {
        for (const id of [...pendingIds]) {
          const checkbox = risksPage.riskCheckbox(id);

          if ((await checkbox.count()) === 1 && (await checkbox.isVisible())) {
            await checkbox.check();
            pendingIds.delete(id);
          }
        }

        if (pendingIds.size === 0) {
          break;
        }

        if (await risksPage.nextPageButton.isDisabled()) {
          throw new Error(
            `Unable to find test-owned occupational-risk IDs: ${[
              ...pendingIds,
            ].join(", ")}`,
          );
        }

        await risksPage.nextPageButton.click();
      }
    };

    let acceptedCode: string | undefined;
    let rejectedCode: string | undefined;
    let acceptedId: number | undefined;

    try {
      // 1. Create a disposable record with a 50-character class value and a runtime-safe unused code.
      const initialRowsResponsePromise = page.waitForResponse(
        response =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      const initialRows = (await initialRowsResponse.json()) as RiskRecord[];
      const usedCodes = new Set(
        initialRows.map(risk => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset = (Date.now() + testInfo.workerIndex * 2) % (36 * 36);
      const disposableCodes: string[] = [];

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `L${((candidateOffset + attempt) % (36 * 36))
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
        "RP-011 requires two unused codes in the L00-LZZ range.",
      );

      [acceptedCode, rejectedCode] = disposableCodes;
      testOwnedCodes.add(acceptedCode);
      testOwnedCodes.add(rejectedCode);

      await risksPage.createButton.click();
      await risksPage.codeInput.fill(acceptedCode);
      await risksPage.classInput.fill(acceptedClass);
      await risksPage.percentageInput.fill("1");

      const acceptedSaveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const acceptedSaveResponse = await acceptedSaveResponsePromise;
      expect(acceptedSaveResponse.ok()).toBe(true);
      expect(acceptedSaveResponse.request().postDataJSON()).toMatchObject({
        kaNlClase: null,
        scCodigo: acceptedCode,
        ssClase: acceptedClass,
        ndPorcentaje: 1,
      });

      const rowsAfterAcceptedSave = await readRows();
      const acceptedMatches = rowsAfterAcceptedSave.filter(
        risk => risk.scCodigo === acceptedCode,
      );
      expect(acceptedMatches).toHaveLength(1);
      expect(acceptedMatches[0].ssClase).toBe(acceptedClass);
      acceptedId = acceptedMatches[0].kaNlClase;
      createdIds.add(acceptedId);

      // 2. Attempt another create with a 51-character class value while capturing the save response and visible feedback.
      await risksPage.createButton.click();
      await risksPage.codeInput.fill(rejectedCode);
      await risksPage.classInput.fill(rejectedClass);
      await risksPage.percentageInput.fill("1");

      const rejectedSaveRequests: Request[] = [];
      const recordRejectedSave = (request: Request): void => {
        if (request.url() === saveUrl && request.method() === "POST") {
          rejectedSaveRequests.push(request);
        }
      };
      page.on("request", recordRejectedSave);

      const rejectedSaveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl && response.request().method() === "POST",
      );
      await risksPage.saveButton.click();

      const rejectedSaveResponse = await rejectedSaveResponsePromise;
      page.off("request", recordRejectedSave);

      expect(rejectedSaveRequests).toHaveLength(1);
      expect(rejectedSaveResponse.status()).toBe(503);
      expect(rejectedSaveResponse.request().postDataJSON()).toMatchObject({
        kaNlClase: null,
        scCodigo: rejectedCode,
        ssClase: rejectedClass,
        ndPorcentaje: 1,
      });
      expect(await rejectedSaveResponse.text()).toContain("value too large");

      await expect(risksPage.feedbackDialog).toBeVisible();
      await expect(risksPage.feedbackTitle).toHaveText("Riesgos");
      await expect(risksPage.feedbackMessage).toContainText("value too large");
      await risksPage.acknowledgeFeedbackButton.click();

      const freshRows = await readRows();
      expect(
        freshRows.filter(risk => risk.scCodigo === rejectedCode),
      ).toHaveLength(0);
      expect(
        freshRows.find(risk => risk.kaNlClase === acceptedId),
      ).toMatchObject({
        scCodigo: acceptedCode,
        ssClase: acceptedClass,
      });
    } finally {
      // 3. Delete the accepted disposable record and verify through a fresh /rows response that its ID is absent.
      const currentRows = await readRows();
      for (const risk of currentRows) {
        if (testOwnedCodes.has(risk.scCodigo)) {
          createdIds.add(risk.kaNlClase);
        }
      }

      if (createdIds.size > 0) {
        const cleanupRowsResponsePromise = page.waitForResponse(
          response =>
            response.url() === rowsUrl && response.request().method() === "GET",
        );
        await page.reload();
        await cleanupRowsResponsePromise;
        await locateAndSelectTestOwnedRows();

        const deleteResponsePromise = page.waitForResponse(
          response =>
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
        expect(new Set(deletedIds)).toEqual(createdIds);

        const remainingRows = await readRows();
        expect(
          remainingRows.filter(risk => createdIds.has(risk.kaNlClase)),
        ).toHaveLength(0);
        expect(
          remainingRows.filter(risk => testOwnedCodes.has(risk.scCodigo)),
        ).toHaveLength(0);
      }
    }
  });
});
