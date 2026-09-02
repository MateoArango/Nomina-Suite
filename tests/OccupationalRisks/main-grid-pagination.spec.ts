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

type PageSize = 10 | 25 | 50 | 100;

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";

test.describe("Initial state, API mapping, and non-mutating grid behavior", () => {
  test("RP-004: Main-grid page sizes and navigation boundaries", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);

    const visibleRiskIds = async (): Promise<number[]> => {
      const ids: number[] = [];

      for (const row of await risksPage.currentPageRiskRows().all()) {
        const testId = await row.getAttribute("data-testid");
        const match = testId?.match(/--(\d+)$/);

        expect(
          match,
          `Unexpected occupational-risk row test ID: "${testId}"`,
        ).not.toBeNull();
        ids.push(Number(match![1]));
      }

      return ids;
    };

    const assertPage = async (
      rows: Risk[],
      pageSize: PageSize,
      pageNumber: number,
    ): Promise<void> => {
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, rows.length);
      const expectedIds = rows
        .slice(startIndex, endIndex)
        .map(risk => risk.kaNlClase);

      const expectedRange = {
        start: startIndex + 1,
        end: endIndex,
        total: rows.length,
      };

      await expect
        .poll(() => risksPage.readPagerRange())
        .toEqual(expectedRange);
      await expect
        .poll(visibleRiskIds, { timeout: 10_000 })
        .toEqual(expectedIds);
      await expect(risksPage.currentPageRiskRows()).toHaveCount(
        expectedIds.length,
      );

      const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
      if (pageNumber === 1) {
        await expect(risksPage.previousPageButton).toBeDisabled();
      } else {
        await expect(risksPage.previousPageButton).toBeEnabled();
      }

      if (pageNumber === lastPage) {
        await expect(risksPage.nextPageButton).toBeDisabled();
      } else {
        await expect(risksPage.nextPageButton).toBeEnabled();
      }
    };

    // 1. Capture the runtime rows response and exercise page sizes 10, 25, 50, and 100.
    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);
    const rows = (await rowsResponse.json()) as Risk[];
    expect(rows.length).toBeGreaterThan(0);

    for (const pageSize of [10, 25, 50, 100] as const) {
      await risksPage.pageSizeButton(pageSize).click();
      await expect(risksPage.pageSizeButton(pageSize)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await assertPage(rows, pageSize, 1);
    }

    // 2. When the runtime total produces multiple pages, navigate forward to the last page and then back to the first.
    const navigationPageSize = ([10, 25, 50, 100] as const).find(
      pageSize => rows.length > pageSize,
    );

    if (navigationPageSize !== undefined) {
      await risksPage.pageSizeButton(navigationPageSize).click();
      const lastPage = Math.ceil(rows.length / navigationPageSize);
      await assertPage(rows, navigationPageSize, 1);

      for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
        await risksPage.nextPageButton.click();
        await assertPage(rows, navigationPageSize, pageNumber);
      }

      for (let pageNumber = lastPage - 1; pageNumber >= 1; pageNumber -= 1) {
        await risksPage.previousPageButton.click();
        await assertPage(rows, navigationPageSize, pageNumber);
      }
    } else {
      // 3. If the runtime dataset cannot produce a second page for any available size, skip only the multi-page navigation branch with an explicit prerequisite reason.
      test.info().annotations.push({
        type: "skip",
        description:
          "Multi-page navigation requires more than 10 occupational-risk records",
      });
    }
  });
});
