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
  test("RP-016: Double-clicking an activity applies it directly", async ({
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

    // 1. Click New, open the modal, and double-click one runtime activity row without clicking Accept.
    await risksPage.createButton.click();
    await risksPage.openActivityModalButton.click();

    const visibleActivityRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
    );
    await expect(visibleActivityRows.first()).toBeVisible();
    expect(
      await visibleActivityRows.count(),
      "RP-016 requires at least one visible runtime activity row",
    ).toBeGreaterThan(0);

    const selectedRow = visibleActivityRows.first();
    const selectedId = Number(
      (await selectedRow.getAttribute("data-testid"))?.split("--").at(-1),
    );
    const selectedActivity = activitiesById.get(selectedId);

    expect(
      selectedActivity,
      `Missing runtime lookup data for activity row ${selectedId}`,
    ).toBeDefined();

    const viewport = page.viewportSize();
    expect(viewport, "The Chromium project must provide a viewport").not.toBeNull();

    await selectedRow.dblclick();

    await expect
      .poll(async () => (await risksPage.activityModal.boundingBox())?.x ?? -1)
      .toBeGreaterThanOrEqual(viewport!.width);
    await expect(risksPage.activityInput).toHaveAttribute("readonly", "true");
    await expect(risksPage.activityInput).toHaveValue(
      `${selectedActivity!.scCodActividad} - ${selectedActivity!.ssActividad}`,
    );

    // 2. Cancel the main form.
    await risksPage.cancelButton.click();
    await expect(risksPage.activityInput).toHaveValue("N/A");

    const rowsAfterCancelResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.reload();
    const rowsAfterCancelResponse = await rowsAfterCancelResponsePromise;
    expect(rowsAfterCancelResponse.ok()).toBe(true);
    const risksAfterCancel = (await rowsAfterCancelResponse.json()) as Risk[];

    expect(saveRequests).toHaveLength(0);
    expect(
      risksAfterCancel.map(risk => risk.kaNlClase).sort((a, b) => a - b),
    ).toEqual(
      baselineRisks.map(risk => risk.kaNlClase).sort((a, b) => a - b),
    );

    page.off("request", recordSaveRequest);
  });
});
