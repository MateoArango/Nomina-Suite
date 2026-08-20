// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type Risk = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

type RiskDetail = Risk & {
  kaNlActividad: number | null;
  scCodActividad: string | null;
  ssActividad: string | null;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

test.describe("Initial state, API mapping, and non-mutating grid behavior", () => {
  test("RP-002: Open exactly one existing record for editing and cancel", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Choose a runtime row by its stable kaNlClase ID, record its API values, start waiting for GET /rows/{id}, and double-click that row.
    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);
    const rows = (await rowsResponse.json()) as Risk[];

    const visibleRows = await risksPage.visibleRiskRows().all();
    let selectedId: number | undefined;

    for (const row of visibleRows) {
      const testId = await row.getAttribute("data-testid");
      const idMatch = testId?.match(/--(\d+)$/);
      const candidateId = Number(idMatch?.[1]);

      if (candidateId > 0) {
        selectedId = candidateId;
        break;
      }
    }

    expect(
      selectedId,
      "No editable occupational-risk row with a positive kaNlClase is visible",
    ).toBeDefined();

    const selectedRow = risksPage.riskRow(selectedId!);
    await expect(selectedRow).toBeVisible();
    const originalRisk = rows.find(risk => risk.kaNlClase === selectedId);
    expect(
      originalRisk,
      `Runtime rows response does not contain selected kaNlClase ${selectedId}`,
    ).toBeDefined();

    const selectedDetailUrl = `${rowsUrl}/${selectedId}`;
    const detailRequests: string[] = [];
    const recordDetailRequest = (request: Request): void => {
      if (
        request.method() === "GET" &&
        /^https:\/\/nomina-qa-api\.adacsc\.co\/api\/v1\/w-riesgos-profesionales\/rows\/\d+$/.test(
          request.url(),
        )
      ) {
        detailRequests.push(request.url());
      }
    };
    page.on("request", recordDetailRequest);

    const detailResponsePromise = page.waitForResponse(
      response =>
        response.url() === selectedDetailUrl &&
        response.request().method() === "GET",
    );
    await selectedRow.dblclick();

    const detailResponse = await detailResponsePromise;
    expect(detailResponse.ok()).toBe(true);
    const originalDetail = (await detailResponse.json()) as RiskDetail;
    expect(originalDetail.kaNlClase).toBe(selectedId);
    expect(detailRequests).toEqual([selectedDetailUrl]);
    page.off("request", recordDetailRequest);

    // 2. Compare the editable form with the detail response.
    expect(originalDetail).toEqual(
      expect.objectContaining({
        scCodigo: originalRisk!.scCodigo,
        ssClase: originalRisk!.ssClase,
        ndPorcentaje: originalRisk!.ndPorcentaje,
      }),
    );
    await expect(risksPage.codeInput).toHaveValue(originalDetail.scCodigo);
    await expect(risksPage.classInput).toHaveValue(originalDetail.ssClase);
    await expect(risksPage.percentageInput).toHaveValue(
      String(originalDetail.ndPorcentaje),
    );
    await expect(risksPage.activityInput).toHaveValue(
      originalDetail.ssActividad ?? "N/A",
    );

    // 3. Change class and percentage locally, observe save requests, then click Cancel.
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    await risksPage.classInput.fill("RP-002 UNSAVED");
    await risksPage.percentageInput.fill("7.777");
    await risksPage.cancelButton.click();

    await expect(risksPage.riskRow(selectedId).locator("td")).toHaveText([
      "",
      originalDetail.scCodigo,
      originalDetail.ssClase,
      String(originalDetail.ndPorcentaje),
    ]);
    expect(saveRequests).toHaveLength(0);
    page.off("request", recordSaveRequest);

    const refreshedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const refreshedRowsResponse = await refreshedRowsResponsePromise;
    expect(refreshedRowsResponse.ok()).toBe(true);
    const refreshedRows = (await refreshedRowsResponse.json()) as Risk[];
    expect(
      refreshedRows.find(risk => risk.kaNlClase === selectedId),
    ).toEqual(originalRisk);

    const reopenedDetailResponsePromise = page.waitForResponse(
      response =>
        response.url() === selectedDetailUrl &&
        response.request().method() === "GET",
    );
    await risksPage.riskRow(selectedId).dblclick();

    const reopenedDetailResponse = await reopenedDetailResponsePromise;
    expect(reopenedDetailResponse.ok()).toBe(true);
    expect((await reopenedDetailResponse.json()) as RiskDetail).toEqual(
      originalDetail,
    );
    await expect(risksPage.codeInput).toHaveValue(originalDetail.scCodigo);
    await expect(risksPage.classInput).toHaveValue(originalDetail.ssClase);
    await expect(risksPage.percentageInput).toHaveValue(
      String(originalDetail.ndPorcentaje),
    );
    await expect(risksPage.activityInput).toHaveValue(
      originalDetail.ssActividad ?? "N/A",
    );
  });
});
