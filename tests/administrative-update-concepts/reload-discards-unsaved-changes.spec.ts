// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

test.describe("Runtime grid and local state", () => {
  test("CNA-002: Recargar discards unsaved local changes without persistence", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const mutationRequests: string[] = [];

    page.on("request", request => {
      if (
        request.url() === `${apiBase}/actions/grabar` ||
        request.url() === `${apiBase}/actions/borrar`
      ) {
        mutationRequests.push(request.url());
      }
    });

    // 1. Capture a fresh rows response and change only the empty working row locally while observing save and delete endpoints.
    const initialRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    const conceptLookupResponsePromise = page.waitForResponse(
      response =>
        response.url() === conceptLookupUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");
    await expect(page).toHaveURL(/\/conceptos-nov-ad/);

    const [initialRowsResponse, conceptLookupResponse] = await Promise.all([
      initialRowsResponsePromise,
      conceptLookupResponsePromise,
    ]);
    expect(initialRowsResponse.ok()).toBe(true);
    expect(conceptLookupResponse.ok()).toBe(true);

    const initialRows =
      (await initialRowsResponse.json()) as AdministrativeConcept[];
    expect(Array.isArray(initialRows)).toBe(true);

    test.skip(
      initialRows.length === 0,
      "CNA-002 requires one persisted runtime row to supply a valid local pair",
    );

    const sourcePair = initialRows[0];
    expect(sourcePair).toEqual(
      expect.objectContaining({
        kaNlConceptoContable: expect.any(Number),
        codigoNovedad: expect.any(String),
      }),
    );
    expect(sourcePair.codigoNovedad).not.toBe("");

    const initialIdentitySet = new Set(initialRows.map(persistedIdentity));
    const workingRow = conceptsPage.emptyWorkingRow();

    await expect(workingRow).toHaveCount(1);
    await workingRow.getByRole("combobox").click();
    await page
      .getByTestId(
        `conceptos-nov-ad-novelty-option-${sourcePair.codigoNovedad.toLowerCase()}`,
      )
      .click();

    const conceptPickerButton = workingRow.getByRole("button", {
      name: "...",
    });
    await conceptPickerButton.click();

    const viewport = page.viewportSize();
    expect(viewport, "The Chromium project must provide a viewport").not.toBeNull();
    const pickerBox = await conceptsPage.conceptPickerPanel.boundingBox();

    if (!pickerBox || pickerBox.x >= viewport!.width) {
      await conceptPickerButton.click();
    }

    const pickerWidth =
      pickerBox?.width ??
      (await conceptsPage.conceptPickerPanel.boundingBox())?.width;
    expect(pickerWidth, "The concept picker must have a rendered width").toBeDefined();

    await expect
      .poll(
        async () =>
          (await conceptsPage.conceptPickerPanel.boundingBox())?.x ??
          viewport!.width,
      )
      .toBeLessThanOrEqual(viewport!.width - pickerWidth! + 1);

    await conceptsPage.searchConcept(sourcePair.kaNlConceptoContable);
    await expect(conceptsPage.conceptPickerSearchInput).toBeVisible();

    const conceptRow = conceptsPage.conceptPickerRow(
      sourcePair.kaNlConceptoContable,
    );
    await expect(conceptRow).toHaveCount(1);

    const validationResponsePromise = page.waitForResponse(
      response =>
        response.url() === `${apiBase}/actions/validar-concepto` &&
        response.request().method() === "POST",
    );
    await conceptRow.dblclick();

    const validationResponse = await validationResponsePromise;
    expect(validationResponse.ok()).toBe(true);
    await expect(conceptsPage.saveButton).toBeEnabled();
    expect(mutationRequests).toEqual([]);

    // 2. Click Recargar after starting a fresh rows wait.
    const refreshedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const refreshedRowsResponse = await refreshedRowsResponsePromise;
    expect(refreshedRowsResponse.ok()).toBe(true);

    const refreshedRows =
      (await refreshedRowsResponse.json()) as AdministrativeConcept[];
    expect(Array.isArray(refreshedRows)).toBe(true);

    const refreshedIdentitySet = new Set(
      refreshedRows.map(persistedIdentity),
    );
    expect([...refreshedIdentitySet].sort()).toEqual(
      [...initialIdentitySet].sort(),
    );

    const resetWorkingRow = conceptsPage.emptyWorkingRow();
    await expect(resetWorkingRow).toHaveCount(1);
    await expect(resetWorkingRow.getByRole("combobox")).toHaveText("");
    await expect(resetWorkingRow.locator("td").nth(1)).toHaveText("");
    await expect(conceptsPage.saveButton).toBeDisabled();
    await expect(conceptsPage.deleteButton).toBeDisabled();
    expect(mutationRequests).toEqual([]);
  });
});
