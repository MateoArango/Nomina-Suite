// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type RiskRecord = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
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
  test("RP-008: Duplicate code is rejected on create without adding a row", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Read an existing code from the runtime rows response, click New, enter that exact code with otherwise valid fields, and start waiting for the save response.
    const initialRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const initialRowsResponse = await initialRowsResponsePromise;
    expect(initialRowsResponse.ok()).toBe(true);
    const initialRows = (await initialRowsResponse.json()) as RiskRecord[];
    const duplicateRisk = initialRows.find(
      risk =>
        Number(risk.kaNlClase) > 0 &&
        typeof risk.scCodigo === "string" &&
        risk.scCodigo.length > 0 &&
        initialRows.filter(candidate => candidate.scCodigo === risk.scCodigo)
          .length === 1,
    );

    test.skip(
      !duplicateRisk,
      "RP-008 requires one non-sentinel runtime risk whose code is unique.",
    );

    const duplicateCode = duplicateRisk!.scCodigo;
    const initialMatchingRows = initialRows.filter(
      risk => risk.scCodigo === duplicateCode,
    );
    expect(initialMatchingRows).toHaveLength(1);

    await risksPage.createButton.click();
    await risksPage.codeInput.fill(duplicateCode);
    await risksPage.classInput.fill("RP-008 DUPLICATE");
    await risksPage.percentageInput.fill("1");

    const saveResponsePromise = page.waitForResponse(
      response =>
        response.url() === saveUrl && response.request().method() === "POST",
    );

    // 2. Click Save and capture both response and user-visible feedback.
    await risksPage.saveButton.click();

    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBe(409);
    const saveError = (await saveResponse.json()) as ApiError;
    expect(saveError).toMatchObject({
      code: "CONFLICT",
      message: "Ya existe un registro con esos datos.",
    });
    expect(saveResponse.request().postDataJSON()).toMatchObject({
      kaNlClase: null,
      scCodigo: duplicateCode,
      ssClase: "RP-008 DUPLICATE",
      ndPorcentaje: 1,
    });

    await expect(risksPage.feedbackDialog).toBeVisible();
    await expect(risksPage.feedbackTitle).toHaveText("Riesgos");
    await expect(risksPage.feedbackMessage).toHaveText(
      "Ya existe un registro con esos datos.",
    );

    const rowsAfterRejectedSaveResponse = await page.request.get(rowsUrl);
    expect(rowsAfterRejectedSaveResponse.ok()).toBe(true);
    const rowsAfterRejectedSave =
      (await rowsAfterRejectedSaveResponse.json()) as RiskRecord[];
    expect(
      rowsAfterRejectedSave.filter(risk => risk.scCodigo === duplicateCode),
    ).toHaveLength(1);

    // 3. Reload the page and re-read /rows.
    const reloadedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.reload();

    const reloadedRowsResponse = await reloadedRowsResponsePromise;
    expect(reloadedRowsResponse.ok()).toBe(true);
    const reloadedRows = (await reloadedRowsResponse.json()) as RiskRecord[];
    const persistedMatches = reloadedRows.filter(
      risk => risk.scCodigo === duplicateCode,
    );

    expect(persistedMatches).toHaveLength(1);
    expect(persistedMatches[0].kaNlClase).toBe(
      initialMatchingRows[0].kaNlClase,
    );
  });
});
