// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Response } from "@playwright/test";
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

const boundaryValues = [0, 0.522, 99.999] as const;

test.describe("Validation and backend error contracts", () => {
  test("RP-009: Percentage accepted boundaries persist exactly", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const risksPage = new RiesgosProfesionalesPage(page);
    const createdIds = new Set<number>();
    const createdCodes = new Set<string>();
    let authorization: string | undefined;

    const readRows = async (): Promise<RiskRecord[]> => {
      if (!authorization) {
        throw new Error(
          "The authenticated browser request did not provide an authorization header.",
        );
      }

      const response = await page.request.get(rowsUrl, {
        headers: { authorization },
      });
      expect(response.ok()).toBe(true);
      return (await response.json()) as RiskRecord[];
    };

    const dismissFeedbackIfVisible = async (): Promise<void> => {
      if (await risksPage.feedbackDialog.isVisible()) {
        await risksPage.acknowledgeFeedbackButton.click();
      }
    };

    const locateAndSelectCreatedRows = async (): Promise<void> => {
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

    try {
      // 1. For each value 0, 0.522, and 99.999, choose an unused three-character code from the runtime dataset, create a disposable record, and capture POST /actions/grabar.
      const initialRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

      const initialRowsResponse = await initialRowsResponsePromise;
      expect(initialRowsResponse.ok()).toBe(true);
      authorization = (await initialRowsResponse.request().allHeaders())
        .authorization;
      expect(
        authorization,
        "The initial browser /rows request must be authenticated.",
      ).toBeTruthy();
      const initialRows = (await initialRowsResponse.json()) as RiskRecord[];
      const usedCodes = new Set(
        initialRows.map((risk) => String(risk.scCodigo).toUpperCase()),
      );
      const candidateOffset =
        (Date.now() + testInfo.workerIndex * boundaryValues.length) % (36 * 36);
      const disposableCodes: string[] = [];

      for (let attempt = 0; attempt < 36 * 36; attempt += 1) {
        const candidate = `P${((candidateOffset + attempt) % (36 * 36))
          .toString(36)
          .toUpperCase()
          .padStart(2, "0")}`;

        if (!usedCodes.has(candidate)) {
          disposableCodes.push(candidate);
          usedCodes.add(candidate);
        }

        if (disposableCodes.length === boundaryValues.length) {
          break;
        }
      }

      test.skip(
        disposableCodes.length !== boundaryValues.length,
        "RP-009 requires three unused codes in the P00-PZZ range.",
      );

      for (const [index, percentage] of boundaryValues.entries()) {
        const code = disposableCodes[index];
        const className = `RP-009 BOUNDARY ${index + 1}`;

        await risksPage.createButton.click();
        await risksPage.codeInput.fill(code);
        await risksPage.classInput.fill(className);
        await risksPage.percentageInput.fill(String(percentage));

        const saveResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === saveUrl &&
            response.request().method() === "POST",
        );
        await risksPage.saveButton.click();

        const saveResponse = await saveResponsePromise;
        if (saveResponse.ok()) {
          createdCodes.add(code);
        }
        expect(saveResponse.ok()).toBe(true);
        expect(saveResponse.request().postDataJSON()).toMatchObject({
          kaNlClase: null,
          scCodigo: code,
          ssClase: className,
          ndPorcentaje: percentage,
        });

        const matchingRows = (await readRows()).filter(
          (risk) => risk.scCodigo === code,
        );
        expect(matchingRows).toHaveLength(1);
        expect(matchingRows[0].ndPorcentaje).toBe(percentage);
        createdIds.add(matchingRows[0].kaNlClase);
        await dismissFeedbackIfVisible();
      }

      // 2. Reload, capture a fresh GET /rows response, and locate each created record by its returned ID and unique code.
      const reloadedRowsResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await page.reload();

      const reloadedRowsResponse = await reloadedRowsResponsePromise;
      expect(reloadedRowsResponse.ok()).toBe(true);
      const reloadedRows = (await reloadedRowsResponse.json()) as RiskRecord[];

      for (const [index, percentage] of boundaryValues.entries()) {
        const code = disposableCodes[index];
        const matchingRows = reloadedRows.filter(
          (risk) => createdIds.has(risk.kaNlClase) && risk.scCodigo === code,
        );

        expect(matchingRows).toHaveLength(1);
        expect(matchingRows[0].ndPorcentaje).toBe(percentage);
      }
    } finally {
      // 3. Delete only the records created by this test, fetch /rows again, and verify their IDs are absent.
      const currentRows = authorization ? await readRows() : [];
      for (const risk of currentRows) {
        if (createdCodes.has(risk.scCodigo)) {
          createdIds.add(risk.kaNlClase);
        }
      }

      if (createdIds.size > 0) {
        const cleanupRowsResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === rowsUrl && response.request().method() === "GET",
        );
        await page.reload();
        await cleanupRowsResponsePromise;
        await locateAndSelectCreatedRows();

        const deleteResponsePromise = page.waitForResponse(
          (response) =>
            response.url() === deleteUrl &&
            response.request().method() === "POST",
        );
        page.once("dialog", (dialog) => dialog.accept());
        await risksPage.deleteButton.click();

        const optionalConfirmation = page
          .getByRole("dialog")
          .filter({
            hasNot: page.getByRole("heading", {
              name: "Actividades",
              exact: true,
            }),
          })
          .last();
        try {
          await optionalConfirmation.waitFor({
            state: "visible",
            timeout: 1_000,
          });
          await optionalConfirmation
            .getByRole("button", { name: "Si", exact: true })
            .click();
        } catch {
          // The current UI may delete directly without a DOM confirmation.
        }

        const deleteResponse: Response = await deleteResponsePromise;
        expect(deleteResponse.ok()).toBe(true);
        const deletedIds = (
          deleteResponse.request().postDataJSON() as { ids?: number[] }
        ).ids;
        expect(new Set(deletedIds)).toEqual(createdIds);

        const remainingRows = await readRows();
        expect(
          remainingRows.filter((risk) => createdIds.has(risk.kaNlClase)),
        ).toHaveLength(0);
      }
    }
  });
});
