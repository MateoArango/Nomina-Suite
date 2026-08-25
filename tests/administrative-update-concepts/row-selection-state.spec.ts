// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
  ssConcepto: string;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const deleteUrl = `${apiBase}/actions/borrar`;

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

function mappingValues(
  concepts: AdministrativeConcept[],
): Array<[string, string]> {
  return concepts
    .map(concept => [persistedIdentity(concept), concept.ssConcepto] as [string, string])
    .sort(([left], [right]) => left.localeCompare(right));
}

test.describe("Runtime grid and local state", () => {
  test("CNA-005: Row selection controls Borrar without deleting data", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const deleteRequests: string[] = [];

    page.on("request", request => {
      if (request.url() === deleteUrl) {
        deleteRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    const initialRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");

    const initialRowsResponse = await initialRowsResponsePromise;
    expect(initialRowsResponse.ok()).toBe(true);

    const initialRows =
      (await initialRowsResponse.json()) as AdministrativeConcept[];
    expect(Array.isArray(initialRows)).toBe(true);

    test.skip(
      initialRows.length === 0,
      "CNA-005 requires one persisted runtime row to exercise selection",
    );

    // 1. Select one persisted runtime row by stable identity, then click it again while observing /actions/borrar.
    const firstIdentity = persistedIdentity(initialRows[0]);
    const firstRow = conceptsPage.row(firstIdentity);

    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator("td").nth(1)).toHaveText(
      initialRows[0].ssConcepto,
    );

    await firstRow.click();
    await expect(firstRow).toHaveClass(/\bdata-row--selected\b/);
    await expect(conceptsPage.deleteButton).toBeEnabled();

    await firstRow.click();
    await expect(firstRow).toHaveClass(/\bdata-row--selected\b/);
    await expect(conceptsPage.deleteButton).toBeEnabled();
    expect(deleteRequests).toEqual([]);

    // 2. Select a second persisted row when available, then click Recargar to clear local selection.
    if (initialRows.length > 1) {
      const secondIdentity = persistedIdentity(initialRows[1]);
      const secondRow = conceptsPage.row(secondIdentity);

      await expect(secondRow).toBeVisible();
      await expect(secondRow.locator("td").nth(1)).toHaveText(
        initialRows[1].ssConcepto,
      );

      await secondRow.click();
      await expect(firstRow).not.toHaveClass(/\bdata-row--selected\b/);
      await expect(secondRow).toHaveClass(/\bdata-row--selected\b/);
      await expect(firstRow.locator("td").nth(1)).toHaveText(
        initialRows[0].ssConcepto,
      );
      await expect(secondRow.locator("td").nth(1)).toHaveText(
        initialRows[1].ssConcepto,
      );
      await expect(conceptsPage.deleteButton).toBeEnabled();
      expect(deleteRequests).toEqual([]);
    } else {
      test.info().annotations.push({
        type: "skip",
        description:
          "Second-row selection requires at least two persisted runtime rows",
      });
    }

    const refreshedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const refreshedRowsResponse = await refreshedRowsResponsePromise;
    expect(refreshedRowsResponse.ok()).toBe(true);

    const refreshedRows =
      (await refreshedRowsResponse.json()) as AdministrativeConcept[];
    expect(mappingValues(refreshedRows)).toEqual(mappingValues(initialRows));

    await expect(conceptsPage.deleteButton).toBeDisabled();

    for (const concept of refreshedRows) {
      const row = conceptsPage.row(persistedIdentity(concept));
      await expect(row).not.toHaveClass(/\bdata-row--selected\b/);
      await expect(row.locator("td").nth(1)).toHaveText(concept.ssConcepto);
    }

    expect(deleteRequests).toEqual([]);
  });
});
