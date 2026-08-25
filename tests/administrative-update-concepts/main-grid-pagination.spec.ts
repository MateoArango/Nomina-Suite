// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
};

type PageSize = 10 | 25 | 50 | 100;

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad/rows";

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

test.describe("Runtime grid and local state", () => {
  test("CNA-004: Main-grid page sizes and navigation boundaries", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);

    const visiblePersistedIdentities = async (): Promise<string[]> => {
      const identities: string[] = [];

      for (const row of await conceptsPage.visibleRows().all()) {
        const testId = await row.getAttribute("data-testid");
        const identity = testId?.replace(
          "conceptos-nov-ad-table-row--",
          "",
        );

        expect(
          identity,
          `Unexpected administrative-concept row test ID: "${testId}"`,
        ).toBeTruthy();
        identities.push(identity!);
      }

      return identities;
    };

    const assertPage = async (
      rows: AdministrativeConcept[],
      pageSize: PageSize,
      pageNumber: number,
    ): Promise<void> => {
      const total = rows.length + 1;
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, total);
      const expectedPersistedIdentities = rows
        .slice(startIndex, Math.min(endIndex, rows.length))
        .map(persistedIdentity);
      const expectedWorkingRowCount =
        startIndex <= rows.length && rows.length < endIndex ? 1 : 0;

      await expect
        .poll(() => conceptsPage.readPagerRange())
        .toEqual({
          start: startIndex + 1,
          end: endIndex,
          total,
        });
      await expect
        .poll(visiblePersistedIdentities)
        .toEqual(expectedPersistedIdentities);
      await expect(conceptsPage.visibleRows()).toHaveCount(
        expectedPersistedIdentities.length,
      );
      await expect(conceptsPage.emptyWorkingRow()).toHaveCount(
        expectedWorkingRowCount,
      );

      const lastPage = Math.ceil(total / pageSize);
      if (pageNumber === 1) {
        await expect(conceptsPage.previousPageButton).toBeDisabled();
      } else {
        await expect(conceptsPage.previousPageButton).toBeEnabled();
      }

      if (pageNumber === lastPage) {
        await expect(conceptsPage.nextPageButton).toBeDisabled();
      } else {
        await expect(conceptsPage.nextPageButton).toBeEnabled();
      }
    };

    // 1. Capture runtime rows and exercise page sizes 10, 25, 50, and 100.
    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const rows = (await rowsResponse.json()) as AdministrativeConcept[];
    expect(Array.isArray(rows)).toBe(true);

    const totalRowsIncludingWorkingRow = rows.length + 1;

    for (const pageSize of [10, 25, 50, 100] as const) {
      await conceptsPage.pageSizeButton(pageSize).click();
      await expect(conceptsPage.pageSizeButton(pageSize)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await assertPage(rows, pageSize, 1);
    }

    // 2. When multiple pages exist, navigate to the last page and back to the first.
    const navigationPageSize = ([10, 25, 50, 100] as const).find(
      pageSize => totalRowsIncludingWorkingRow > pageSize,
    );

    if (navigationPageSize !== undefined) {
      await conceptsPage.pageSizeButton(navigationPageSize).click();
      const lastPage = Math.ceil(
        totalRowsIncludingWorkingRow / navigationPageSize,
      );
      await assertPage(rows, navigationPageSize, 1);

      for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
        await conceptsPage.nextPageButton.click();
        await assertPage(rows, navigationPageSize, pageNumber);
      }

      for (let pageNumber = lastPage - 1; pageNumber >= 1; pageNumber -= 1) {
        await conceptsPage.previousPageButton.click();
        await assertPage(rows, navigationPageSize, pageNumber);
      }
    } else {
      // 3. If current data cannot produce a second page, skip only the navigation branch with a precise reason.
      test.info().annotations.push({
        type: "skip",
        description:
          "Multi-page navigation requires more than 10 total rows including the empty working row",
      });
    }
  });
});
