// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type Activity = {
  kaNlActividad: number;
  scCodActividad: number;
  ssActividad: string;
};

type Risk = {
  kaNlClase: number;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const activitiesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/lookups/dddw-actividad-riesgo";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

test.describe("Activity lookup and modal behavior", () => {
  test("RP-014: Activity selection is single-select and Accept applies the latest choice", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    const activitiesResponsePromise = page.waitForResponse(
      response =>
        response.url() === activitiesUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const [rowsResponse, activitiesResponse] = await Promise.all([
      rowsResponsePromise,
      activitiesResponsePromise,
    ]);
    expect(rowsResponse.ok()).toBe(true);
    expect(activitiesResponse.ok()).toBe(true);

    const baselineRisks = (await rowsResponse.json()) as Risk[];
    const activities = (await activitiesResponse.json()) as Activity[];
    const activitiesById = new Map(
      activities.map(activity => [activity.kaNlActividad, activity]),
    );

    // 1. Click New, open the modal, and choose two different runtime activity rows in sequence.
    await risksPage.createButton.click();
    await risksPage.openActivityModalButton.click();

    const visibleActivityRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
    );
    expect(
      await visibleActivityRows.count(),
      "RP-014 requires at least two visible runtime activity rows",
    ).toBeGreaterThanOrEqual(2);

    const firstRow = visibleActivityRows.nth(0);
    const latestRow = visibleActivityRows.nth(1);
    const firstId = Number(
      (await firstRow.getAttribute("data-testid"))?.split("--").at(-1),
    );
    const latestId = Number(
      (await latestRow.getAttribute("data-testid"))?.split("--").at(-1),
    );
    const firstActivity = activitiesById.get(firstId);
    const latestActivity = activitiesById.get(latestId);

    expect(
      firstActivity,
      `Missing runtime lookup data for activity row ${firstId}`,
    ).toBeDefined();
    expect(
      latestActivity,
      `Missing runtime lookup data for activity row ${latestId}`,
    ).toBeDefined();
    expect(latestId).not.toBe(firstId);

    await firstRow.click();
    await latestRow.click();

    const selectedRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"].current',
    );
    await expect(selectedRows).toHaveCount(1);
    await expect(latestRow).toHaveClass(/\bcurrent\b/);
    await expect(firstRow).not.toHaveClass(/\bcurrent\b/);

    // 2. Click Accept.
    await risksPage.acceptActivityButton.click();

    const viewport = page.viewportSize();
    expect(viewport, "The Chromium project must provide a viewport").not.toBeNull();
    await expect
      .poll(async () => (await risksPage.activityModal.boundingBox())?.x ?? -1)
      .toBeGreaterThanOrEqual(viewport!.width);
    await expect(risksPage.activityInput).toHaveAttribute("readonly", "true");
    await expect(risksPage.activityInput).toHaveValue(
      `${latestActivity!.scCodActividad} - ${latestActivity!.ssActividad}`,
    );
    await expect(risksPage.activityInput).not.toHaveValue(
      `${firstActivity!.scCodActividad} - ${firstActivity!.ssActividad}`,
    );

    // 3. Click Cancel on the main form.
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    await risksPage.cancelButton.click();

    const rowsAfterCancelResponse = await page.request.get(rowsUrl);
    expect(rowsAfterCancelResponse.ok()).toBe(true);
    const risksAfterCancel = (await rowsAfterCancelResponse.json()) as Risk[];

    expect(saveRequests).toHaveLength(0);
    expect(
      risksAfterCancel.map(risk => risk.kaNlClase).sort((a, b) => a - b),
    ).toEqual(
      baselineRisks.map(risk => risk.kaNlClase).sort((a, b) => a - b),
    );
    await expect(risksPage.activityInput).toHaveValue("N/A");

    page.off("request", recordSaveRequest);
  });
});
