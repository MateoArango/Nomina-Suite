// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type Activity = {
  kaNlActividad: number;
  scCodActividad: number;
  ssActividad: string;
};

const activitiesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/lookups/dddw-actividad-riesgo";

test.describe("Activity lookup and modal behavior", () => {
  test("RP-013: Activity modal loads and maps runtime lookup data", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Start waiting for GET /lookups/dddw-actividad-riesgo, open the page, click New, and open the activity modal.
    const activitiesResponsePromise = page.waitForResponse(
      response =>
        response.url() === activitiesUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");
    await risksPage.createButton.click();
    const originalActivityValue = await risksPage.activityInput.inputValue();
    await risksPage.openActivityModalButton.click();

    const activitiesResponse = await activitiesResponsePromise;
    expect(activitiesResponse.ok()).toBe(true);

    const activities = (await activitiesResponse.json()) as Activity[];
    expect(Array.isArray(activities)).toBe(true);

    await expect(risksPage.activityModal).toBeVisible();
    await expect(
      risksPage.activityModal
        .getByRole("heading", { name: "Actividades", exact: true })
        .first(),
    ).toBeVisible();
    await expect(risksPage.openActivitySearchButton).toBeVisible();
    await expect(risksPage.activitySearchInput).toBeAttached();
    await expect(risksPage.activityModal.locator("table")).toBeVisible();

    for (const size of [10, 25, 50, 100] as const) {
      await expect(risksPage.activityPageSizeButton(size)).toBeVisible();
    }

    await expect(risksPage.acceptActivityButton).toBeVisible();
    await expect(risksPage.cancelActivityButton).toBeVisible();
    await expect(risksPage.closeActivityModalButton).toBeVisible();

    // 2. Validate unique kaNlActividad IDs and compare visible rows by ID with scCodActividad and ssActividad from the response.
    activities.forEach((activity, index) => {
      expect(
        activity,
        `Malformed activity record at response index ${index}`,
      ).toEqual(
        expect.objectContaining({
          kaNlActividad: expect.any(Number),
          scCodActividad: expect.any(Number),
          ssActividad: expect.any(String),
        }),
      );
    });

    const activityIds = activities.map(activity => activity.kaNlActividad);
    expect(
      new Set(activityIds).size,
      "Duplicate kaNlActividad values were returned by the activity lookup",
    ).toBe(activityIds.length);

    const activitiesById = new Map(
      activities.map(activity => [activity.kaNlActividad, activity]),
    );
    const visibleRows = await risksPage.activityModal
      .locator(
        'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
      )
      .all();

    for (const row of visibleRows) {
      const testId = await row.getAttribute("data-testid");
      const id = Number(testId?.split("--").at(-1));
      const expectedActivity = activitiesById.get(id);

      expect(
        expectedActivity,
        `Missing runtime lookup data for visible activity row ${id}`,
      ).toBeDefined();
      await expect(row.locator("td")).toHaveText([
        String(expectedActivity!.scCodActividad),
        expectedActivity!.ssActividad,
      ]);
    }

    const pagerSummary = risksPage.activityModal.locator(
      ".erp-table-pager__summary",
    );
    const summaryText = (await pagerSummary.textContent())?.trim() ?? "";
    const summaryMatch = summaryText.match(/^(\d+)-(\d+) de (\d+)$/);

    expect(
      summaryMatch,
      `Unexpected activity pager summary: "${summaryText}"`,
    ).not.toBeNull();
    expect(Number(summaryMatch![3])).toBe(activities.length);

    const selectedPageSize = risksPage.activityModal.locator(
      '[data-testid^="riesgos-profesionales-actividad-modal-table-page-size-button--"][aria-pressed="true"]',
    );
    await expect(selectedPageSize).toHaveCount(1);
    const selectedPageSizeValue = Number(
      (await selectedPageSize.getAttribute("data-testid"))
        ?.split("--")
        .at(-1),
    );
    expect(visibleRows.length).toBe(
      Math.min(selectedPageSizeValue, activities.length),
    );

    // 3. Inspect the initial selection and close with Cancel.
    const currentRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"].current',
    );
    const currentRowCount = await currentRows.count();
    expect(currentRowCount).toBeLessThanOrEqual(1);

    if (currentRowCount === 1) {
      const testId = await currentRows.first().getAttribute("data-testid");
      const selectedId = Number(testId?.split("--").at(-1));
      expect(activitiesById.has(selectedId)).toBe(true);
    }

    await risksPage.cancelActivityButton.click();

    await expect(risksPage.activityInput).toHaveValue(originalActivityValue);
  });
});
