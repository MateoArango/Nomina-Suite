// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type Risk = {
  kaNlClase: number;
  scCodigo: string;
  ssClase: string;
  ndPorcentaje: number;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const activitiesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/lookups/dddw-actividad-riesgo";

function expectValidRisk(risk: Risk, index: number): void {
  expect(
    risk,
    `Malformed occupational-risk record at response index ${index}`,
  ).toEqual(
    expect.objectContaining({
      kaNlClase: expect.any(Number),
      scCodigo: expect.any(String),
      ssClase: expect.any(String),
      ndPorcentaje: expect.any(Number),
    }),
  );
}

test.describe("Initial state, API mapping, and non-mutating grid behavior", () => {
  test("RP-001: Load the occupational-risks page from runtime API data", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    // 1. Start waits for GET /w-riesgos-profesionales/rows and GET /w-riesgos-profesionales/lookups/dddw-actividad-riesgo, then navigate to /riesgos-profesionales.
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
    await expect(page).toHaveURL(/\/riesgos-profesionales/);

    const [rowsResponse, activitiesResponse] = await Promise.all([
      rowsResponsePromise,
      activitiesResponsePromise,
    ]);
    expect(rowsResponse.ok()).toBe(true);
    expect(activitiesResponse.ok()).toBe(true);

    const rows = (await rowsResponse.json()) as Risk[];
    const activities = (await activitiesResponse.json()) as unknown;
    expect(Array.isArray(rows)).toBe(true);
    expect(Array.isArray(activities)).toBe(true);

    await expect(risksPage.heading).toBeVisible();
    await expect(risksPage.form).toBeVisible();
    await expect(risksPage.riskTable).toBeVisible();
    await expect(risksPage.toolbar).toBeVisible();
    await expect(risksPage.pager).toBeVisible();

    // 2. Validate each risk object has kaNlClase, scCodigo, ssClase, and ndPorcentaje, and that kaNlClase values are unique.
    rows.forEach(expectValidRisk);
    const riskIds = rows.map(risk => risk.kaNlClase);
    expect(
      new Set(riskIds).size,
      "Duplicate kaNlClase values were returned by the occupational-risks API",
    ).toBe(riskIds.length);

    // 3. Derive the expected grid total from the rows response and compare the currently visible rows by kaNlClase.
    const rowsById = new Map(rows.map(risk => [risk.kaNlClase, risk]));
    const visibleRows = await risksPage.visibleRiskRows().all();

    for (const row of visibleRows) {
      const testId = await row.getAttribute("data-testid");
      const id = Number(testId?.split("--").at(-1));
      const expectedRisk = rowsById.get(id);

      expect(
        expectedRisk,
        `Missing runtime API data for visible risk row ${id}`,
      ).toBeDefined();
      await expect(row.locator("td")).toHaveText([
        "",
        expectedRisk!.scCodigo,
        expectedRisk!.ssClase,
        String(expectedRisk!.ndPorcentaje),
      ]);
    }

    const pagerRange = await risksPage.readPagerRange();
    const selectedPageSize = await risksPage.selectedPageSize();
    expect(pagerRange.total).toBe(rows.length);
    expect(visibleRows.length).toBe(
      Math.min(selectedPageSize, rows.length),
    );

    // 4. Inspect the fresh-page control states.
    await expect(risksPage.deleteButton).toBeDisabled();
    await expect(risksPage.previousPageButton).toBeDisabled();

    if (rows.length > selectedPageSize) {
      await expect(risksPage.nextPageButton).toBeEnabled();
    } else {
      await expect(risksPage.nextPageButton).toBeDisabled();
    }
  });
});
