// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
  ssCodigoConcepto: string;
  ssConcepto: string;
};

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad/rows";

function expectValidAdministrativeConcept(
  concept: AdministrativeConcept,
  index: number,
): void {
  expect(
    concept,
    `Malformed administrative-concept record at response index ${index}`,
  ).toEqual(
    expect.objectContaining({
      kaNlConceptoContable: expect.any(Number),
      codigoNovedad: expect.any(String),
      ssCodigoConcepto: expect.any(String),
      ssConcepto: expect.any(String),
    }),
  );

  expect(concept.codigoNovedad).not.toBe("");
  expect(concept.ssCodigoConcepto).not.toBe("");
  expect(concept.ssConcepto).not.toBe("");
}

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

test.describe("Runtime grid and local state", () => {
  test("CNA-001: Load the grid from runtime API data", async ({ page }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);

    // 1. Start a wait for GET /w-conceptos-nov-ad/rows, navigate through the authenticated seed flow, and validate the response structure and unique persisted mapping identities.
    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");
    await expect(page).toHaveURL(/\/conceptos-nov-ad/);

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const rows = (await rowsResponse.json()) as AdministrativeConcept[];
    expect(Array.isArray(rows)).toBe(true);
    rows.forEach(expectValidAdministrativeConcept);

    const persistedIdentities = rows.map(persistedIdentity);
    expect(
      new Set(persistedIdentities).size,
      "The administrative-concepts API returned duplicate persisted identities",
    ).toBe(persistedIdentities.length);

    await expect(conceptsPage.heading).toBeVisible();
    await expect(conceptsPage.toolbar).toBeVisible();
    await expect(conceptsPage.table).toBeVisible();
    await expect(conceptsPage.pager).toBeVisible();
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);

    // 2. Map every visible persisted row to the runtime response by stable identity, excluding the empty working row.
    const rowsByIdentity = new Map(
      rows.map(concept => [persistedIdentity(concept), concept]),
    );
    const visibleRows = await conceptsPage.visibleRows().all();

    for (const row of visibleRows) {
      const testId = await row.getAttribute("data-testid");
      const identity = testId?.replace(
        "conceptos-nov-ad-table-row--",
        "",
      );
      const expectedConcept = identity
        ? rowsByIdentity.get(identity)
        : undefined;

      expect(
        expectedConcept,
        `Missing runtime API data for visible administrative-concept row "${identity}"`,
      ).toBeDefined();
      await expect(conceptsPage.noveltySelect(identity!)).toBeVisible();
      await expect(row.locator("td").nth(1)).toHaveText(
        expectedConcept!.ssConcepto,
      );
    }

    expect(visibleRows).toHaveLength(rows.length);

    // 3. Inspect initial controls and derive pager state from the runtime total plus the empty working row contract.
    await expect(conceptsPage.reloadButton).toBeEnabled();
    await expect(conceptsPage.saveButton).toBeDisabled();
    await expect(conceptsPage.deleteButton).toBeDisabled();

    const selectedPageSize = await conceptsPage.selectedPageSize();
    const pagerRange = await conceptsPage.readPagerRange();
    const totalRowsIncludingWorkingRow = rows.length + 1;

    expect(pagerRange.total).toBe(totalRowsIncludingWorkingRow);
    expect(pagerRange.start).toBe(totalRowsIncludingWorkingRow === 0 ? 0 : 1);
    expect(pagerRange.end).toBe(
      Math.min(selectedPageSize, totalRowsIncludingWorkingRow),
    );
    await expect(conceptsPage.previousPageButton).toBeDisabled();

    if (totalRowsIncludingWorkingRow > selectedPageSize) {
      await expect(conceptsPage.nextPageButton).toBeEnabled();
    } else {
      await expect(conceptsPage.nextPageButton).toBeDisabled();
    }
  });
});
