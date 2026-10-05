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
  test("RP-003: New and Cancel reset unsaved form state", async ({ page }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Open a runtime record, alter its fields without saving, then click New.
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

    const originalRisk = rows.find(risk => risk.kaNlClase === selectedId);
    expect(
      originalRisk,
      `Runtime rows response does not contain selected kaNlClase ${selectedId}`,
    ).toBeDefined();

    const selectedDetailUrl = `${rowsUrl}/${selectedId}`;
    const detailResponsePromise = page.waitForResponse(
      response =>
        response.url() === selectedDetailUrl &&
        response.request().method() === "GET",
    );
    await risksPage.riskRow(selectedId!).dblclick();

    const detailResponse = await detailResponsePromise;
    expect(detailResponse.ok()).toBe(true);
    const originalDetail = (await detailResponse.json()) as RiskDetail;
    expect(originalDetail.kaNlClase).toBe(selectedId);

    await risksPage.codeInput.fill("903");
    await risksPage.classInput.fill("RP-003 EDIT");
    await risksPage.percentageInput.fill("8.888");
    await risksPage.openActivityModalButton.click();

    const activityOption = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]',
    ).first();
    await expect(activityOption).toBeVisible();
    await activityOption.click();
    await risksPage.acceptActivityButton.click();
    await expect(risksPage.activityInput).not.toHaveValue("N/A");

    await risksPage.createButton.click();
    await expect(risksPage.codeInput).toHaveValue("");
    await expect(risksPage.classInput).toHaveValue("");
    await expect(risksPage.percentageInput).toHaveValue("");
    await expect(risksPage.activityInput).toHaveValue("N/A");

    // 2. Enter different unsaved create values and click Cancel while observing /actions/grabar.
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    await risksPage.codeInput.fill("904");
    await risksPage.classInput.fill("RP-003 CREATE");
    await risksPage.percentageInput.fill("9.999");
    await risksPage.cancelButton.click();

    await expect(risksPage.codeInput).toHaveValue("");
    await expect(risksPage.classInput).toHaveValue("");
    await expect(risksPage.percentageInput).toHaveValue("");
    await expect(risksPage.activityInput).toHaveValue("N/A");
    expect(saveRequests).toHaveLength(0);
    page.off("request", recordSaveRequest);

    // 3. Re-open the original row.
    const reopenedDetailResponsePromise = page.waitForResponse(
      response =>
        response.url() === selectedDetailUrl &&
        response.request().method() === "GET",
    );
    await risksPage.riskRow(selectedId!).dblclick();

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
    await expect(risksPage.riskRow(selectedId!).locator("td")).toHaveText([
      "",
      originalRisk!.scCodigo,
      originalRisk!.ssClase,
      String(originalRisk!.ndPorcentaje),
    ]);
  });
});
