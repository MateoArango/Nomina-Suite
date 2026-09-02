// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

test.describe("Validation and backend error contracts", () => {
  test("RP-007: Code input enforces its three-character UI boundary", async ({
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

    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");
    await expect(risksPage.heading).toBeVisible();

    // 1. Click New and fill the Code input with four characters.
    await risksPage.createButton.click();
    await expect(risksPage.codeInput).toHaveAttribute("maxlength", "3");
    await risksPage.codeInput.pressSequentially("A2CD");
    await expect(risksPage.codeInput).toHaveValue("A2C");

    // 2. Test empty, one-character, and three-character values without persisting data.
    await risksPage.codeInput.fill("");
    await expect(risksPage.codeInput).toHaveValue("");

    await risksPage.codeInput.fill("A");
    await expect(risksPage.codeInput).toHaveValue("A");

    await risksPage.codeInput.fill("A2C");
    await expect(risksPage.codeInput).toHaveValue("A2C");

    await risksPage.codeInput.fill("");
    await risksPage.saveButton.click();

    await expect(risksPage.validationDialog).toBeVisible();
    await expect(risksPage.validationTitle).toHaveText("Riesgos");
    await expect(risksPage.validationMessage).toHaveText(
      "Debe digitar un código para el riesgo.",
    );
    expect(saveRequests).toHaveLength(0);

    page.off("request", recordSaveRequest);
  });
});
