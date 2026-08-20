// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import type { Request } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRecord = {
  scCodigo: string;
};

type ApiError = {
  code: string;
  message: string;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

test.describe("Validation and backend error contracts", () => {
  test("RP-010: Percentage above database precision is rejected without persistence", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Choose an unused runtime-safe code, click New, enter otherwise valid data with percentage 100, and start waiting for POST /actions/grabar.
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
    let attemptedCode: string | undefined;

    for (let index = 0; index < 36 * 36; index += 1) {
      const candidate = `R${index
        .toString(36)
        .toUpperCase()
        .padStart(2, "0")}`;

      if (!usedCodes.has(candidate)) {
        attemptedCode = candidate;
        break;
      }
    }

    test.skip(
      !attemptedCode,
      "RP-010 requires an unused three-character code in the R00-RZZ range.",
    );

    await risksPage.createButton.click();
    await risksPage.codeInput.fill(attemptedCode!);
    await risksPage.classInput.fill("RP-010 OVER MAXIMUM");
    await risksPage.percentageInput.fill("100");

    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    const saveResponsePromise = page.waitForResponse(
      response =>
        response.url() === saveUrl && response.request().method() === "POST",
    );

    // 2. Submit and inspect the response plus visible error state.
    await risksPage.saveButton.click();

    const saveResponse = await saveResponsePromise;
    expect(saveRequests).toHaveLength(1);
    expect(saveResponse.status()).toBe(409);
    const saveError = (await saveResponse.json()) as ApiError;
    expect(saveError.code).toBe("CONFLICT");
    expect(saveError.message).toContain(
      "value larger than specified precision allowed for this column",
    );
    expect(saveResponse.request().postDataJSON()).toMatchObject({
      kaNlClase: null,
      scCodigo: attemptedCode,
      ssClase: "RP-010 OVER MAXIMUM",
      ndPorcentaje: 100,
    });

    await expect(risksPage.feedbackDialog).toBeVisible();
    await expect(risksPage.feedbackTitle).toHaveText("Riesgos");
    await expect(risksPage.feedbackMessage).toHaveText(
      "El porcentaje ingresado no puede ser superior al 100%",
    );

    page.off("request", recordSaveRequest);

    // 3. Reload and query /rows for the attempted code.
    const reloadedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.reload();

    const reloadedRowsResponse = await reloadedRowsResponsePromise;
    expect(reloadedRowsResponse.ok()).toBe(true);
    const reloadedRows = (await reloadedRowsResponse.json()) as RiskRecord[];

    expect(
      reloadedRows.filter(risk => risk.scCodigo === attemptedCode),
    ).toHaveLength(0);
  });
});
