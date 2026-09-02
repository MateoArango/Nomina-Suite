// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

const validationCases = [
  {
    name: "missing code",
    code: "",
    riskClass: "RP-006 MISSING CODE",
    percentage: "1",
    message: "Debe digitar un código para el riesgo.",
  },
  {
    name: "missing class",
    code: "R06",
    riskClass: "",
    percentage: "1",
    message: "Debe ingresar la clase.",
  },
  {
    name: "missing percentage",
    code: "R06",
    riskClass: "RP-006 MISSING PERCENTAGE",
    percentage: "",
    message: "Debe digitar un porcentaje para la provisión.",
  },
] as const;

test.describe("Validation and backend error contracts", () => {
  test("RP-006: Required fields block save in validation order", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);
    const initialVisibleRowCount = await risksPage.currentPageRiskRows().count();

    // 1. For each isolated case—missing code, missing class, and missing percentage—click New, fill all other required fields, start counting /actions/grabar requests, and click Save.
    for (const validationCase of validationCases) {
      await test.step(validationCase.name, async () => {
        await risksPage.createButton.click();
        await expect(risksPage.codeInput).toHaveValue("");
        await expect(risksPage.classInput).toHaveValue("");
        await expect(risksPage.percentageInput).toHaveValue("");
        await expect(risksPage.activityInput).toHaveValue("N/A");

        if (validationCase.code) {
          await risksPage.codeInput.fill(validationCase.code);
        }
        if (validationCase.riskClass) {
          await risksPage.classInput.fill(validationCase.riskClass);
        }
        if (validationCase.percentage) {
          await risksPage.percentageInput.fill(validationCase.percentage);
        }

        const saveRequestCountBeforeSubmit = saveRequests.length;
        await risksPage.saveButton.click();

        await expect(risksPage.validationDialog).toBeVisible();
        await expect(risksPage.validationTitle).toHaveText("Riesgos");
        await expect(risksPage.validationMessage).toHaveText(
          validationCase.message,
        );
        expect(saveRequests).toHaveLength(saveRequestCountBeforeSubmit);
        await expect(risksPage.currentPageRiskRows()).toHaveCount(
          initialVisibleRowCount,
        );

        // 2. Dismiss each alert and reset with Cancel before the next case.
        await risksPage.acknowledgeValidationButton.click();
        await expect(risksPage.validationDialog).toBeHidden();
        await risksPage.cancelButton.click();

        await expect(risksPage.codeInput).toHaveValue("");
        await expect(risksPage.classInput).toHaveValue("");
        await expect(risksPage.percentageInput).toHaveValue("");
        await expect(risksPage.activityInput).toHaveValue("N/A");
      });
    }

    expect(saveRequests).toHaveLength(0);
    page.off("request", recordSaveRequest);
  });
});
