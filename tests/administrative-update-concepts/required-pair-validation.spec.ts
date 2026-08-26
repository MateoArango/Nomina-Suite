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
const validateConceptUrl = `${apiBase}/actions/validar-concepto`;
const saveUrl = `${apiBase}/actions/grabar`;
const incompleteRowMessage =
  "Cada fila debe tener novedad y concepto contable para poder grabarse.";

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

test.describe("Concept picker and validation contracts", () => {
  test("CNA-012: Missing either field blocks save before the API", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const saveRequests: string[] = [];

    page.on("request", request => {
      if (request.url() === saveUrl) {
        saveRequests.push(request.method());
      }
    });

    const initialRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");
    await expect(page).toHaveURL(/\/conceptos-nov-ad/);

    const initialRowsResponse = await initialRowsResponsePromise;
    expect(initialRowsResponse.ok()).toBe(true);

    const initialRows =
      (await initialRowsResponse.json()) as AdministrativeConcept[];
    const initialIdentitySet = [...new Set(initialRows.map(persistedIdentity))].sort();

    test.skip(
      initialRows.length === 0,
      "CNA-012 requires one persisted runtime row to supply a valid concept",
    );
    expect(initialIdentitySet).toHaveLength(initialRows.length);

    const sourcePair = initialRows[0];
    expect(sourcePair).toEqual(
      expect.objectContaining({
        kaNlConceptoContable: expect.any(Number),
        codigoNovedad: expect.any(String),
      }),
    );
    expect(sourcePair.codigoNovedad).not.toBe("");

    const feedbackMessage = page.getByText(incompleteRowMessage, {
      exact: true,
    });
    const acknowledgeFeedbackButton = page.getByTestId(
      "conceptos-nov-ad-dialog-incomplete-row-confirm-button",
    );

    // 1. On fresh local state, set only Novedad and click Grabar while counting /actions/grabar requests.
    const noveltyOnlyRow = conceptsPage.emptyWorkingRow();
    await expect(noveltyOnlyRow).toHaveCount(1);
    await noveltyOnlyRow.getByRole("combobox").click();
    await page
      .getByTestId(
        `conceptos-nov-ad-novelty-option-${sourcePair.codigoNovedad.toLowerCase()}`,
      )
      .click();

    await expect(conceptsPage.saveButton).toBeEnabled();
    await conceptsPage.saveButton.click();

    await expect(feedbackMessage).toBeVisible();
    expect(saveRequests).toEqual([]);

    await acknowledgeFeedbackButton.click();

    const noveltyResetRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const noveltyResetRowsResponse = await noveltyResetRowsResponsePromise;
    expect(noveltyResetRowsResponse.ok()).toBe(true);

    const noveltyResetRows =
      (await noveltyResetRowsResponse.json()) as AdministrativeConcept[];
    expect([...new Set(noveltyResetRows.map(persistedIdentity))].sort()).toEqual(
      initialIdentitySet,
    );
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(saveRequests).toEqual([]);

    // 2. Reset; apply only a valid Concepto Contable, leave Novedad blank, and click Grabar.
    const conceptOnlyRow = conceptsPage.emptyWorkingRow();
    const conceptPickerButton = conceptOnlyRow.getByRole("button", {
      name: "...",
    });
    await conceptPickerButton.click();

    const viewport = page.viewportSize();
    expect(viewport, "The Chromium project must provide a viewport").not.toBeNull();
    const pickerBox = await conceptsPage.conceptPickerPanel.boundingBox();

    if (!pickerBox || pickerBox.x >= viewport!.width) {
      await conceptPickerButton.click();
    }

    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
    await conceptsPage.searchConcept(sourcePair.kaNlConceptoContable);

    const conceptRow = conceptsPage.conceptPickerRow(
      sourcePair.kaNlConceptoContable,
    );
    await expect(conceptRow).toHaveCount(1);
    const selectedConceptName = await conceptRow.locator("td").nth(2).innerText();

    const validationResponsePromise = page.waitForResponse(
      response =>
        response.url() === validateConceptUrl &&
        response.request().method() === "POST",
    );
    await conceptRow.dblclick();

    const validationResponse = await validationResponsePromise;
    expect(validationResponse.ok()).toBe(true);
    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();
    const conceptOnlyAppliedRow = conceptsPage
      .emptyWorkingRow()
      .filter({ hasText: selectedConceptName });
    await expect(conceptOnlyAppliedRow).toHaveCount(1);
    await expect(conceptOnlyAppliedRow.getByRole("combobox")).toHaveText("");
    await expect(conceptsPage.saveButton).toBeEnabled();

    await conceptsPage.saveButton.click();

    await expect(feedbackMessage).toBeVisible();
    expect(saveRequests).toEqual([]);

    await acknowledgeFeedbackButton.click();

    const conceptResetRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const conceptResetRowsResponse = await conceptResetRowsResponsePromise;
    expect(conceptResetRowsResponse.ok()).toBe(true);

    const conceptResetRows =
      (await conceptResetRowsResponse.json()) as AdministrativeConcept[];
    expect([...new Set(conceptResetRows.map(persistedIdentity))].sort()).toEqual(
      initialIdentitySet,
    );
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(saveRequests).toEqual([]);
  });
});
