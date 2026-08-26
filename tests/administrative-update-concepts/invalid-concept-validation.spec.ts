// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
};

type LookupConcept = {
  kaNlConcepto: number;
  ssCodigo: string;
  ssConcepto: string | null;
  scSigno: string;
};

type ErrorResponse = {
  code: string;
  message: string;
  timestamp?: string;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;
const validateConceptUrl = `${apiBase}/actions/validar-concepto`;
const saveUrl = `${apiBase}/actions/grabar`;
const invalidConceptMessage =
  "El concepto ingresado no cumple con las caracteristicas del salario base.";

test.describe("Concept picker and validation contracts", () => {
  test("CNA-011: Invalid concept is rejected immediately without save", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const validationRequests: Array<{
      method: string;
      payload: unknown;
    }> = [];
    const saveRequests: string[] = [];

    page.on("request", request => {
      if (request.url() === validateConceptUrl) {
        validationRequests.push({
          method: request.method(),
          payload: request.postDataJSON(),
        });
      }

      if (request.url() === saveUrl) {
        saveRequests.push(request.method());
      }
    });

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
    const lookupConcepts =
      (await conceptLookupResponse.json()) as LookupConcept[];
    const acceptedConceptIds = new Set(
      initialRows.map(row => row.kaNlConceptoContable),
    );
    const invalidConcept = lookupConcepts.find(
      concept =>
        !acceptedConceptIds.has(concept.kaNlConcepto) &&
        typeof concept.ssConcepto === "string" &&
        concept.ssConcepto.length > 0,
    );

    test.skip(
      !invalidConcept,
      "CNA-011 requires one runtime concept outside the confirmed accepted set",
    );

    const selectedConcept = invalidConcept!;
    const selectedNoveltyCode = "cmp";
    const attemptedPair = {
      conceptId: selectedConcept.kaNlConcepto,
      noveltyCode: selectedNoveltyCode,
    };
    const workingRow = conceptsPage.emptyWorkingRow();

    expect(
      initialRows.some(
        row =>
          row.kaNlConceptoContable === attemptedPair.conceptId &&
          row.codigoNovedad.toLowerCase() === attemptedPair.noveltyCode,
      ),
    ).toBe(false);

    // 1. Derive a concept outside the confirmed accepted set from runtime lookup data, start waiting for /actions/validar-concepto, and double-click it.
    await expect(workingRow).toHaveCount(1);
    await workingRow.getByRole("combobox").click();
    await page
      .getByTestId(
        `conceptos-nov-ad-novelty-option-${selectedNoveltyCode}`,
      )
      .click();

    const conceptPickerButton = workingRow.getByRole("button", {
      name: "...",
    });
    await conceptPickerButton.click();
    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
    await conceptsPage.searchConcept(selectedConcept.kaNlConcepto);

    const conceptRow = conceptsPage.conceptPickerRow(
      selectedConcept.kaNlConcepto,
    );
    await expect(conceptRow).toHaveCount(1);

    const validationResponsePromise = page.waitForResponse(
      response =>
        response.url() === validateConceptUrl &&
        response.request().method() === "POST",
    );
    await conceptRow.dblclick();

    const validationResponse = await validationResponsePromise;
    const validationBody =
      (await validationResponse.json()) as ErrorResponse;
    const feedbackDialog = page.getByRole("dialog").filter({
      hasText: invalidConceptMessage,
    });

    expect(validationRequests).toEqual([
      {
        method: "POST",
        payload: { kaNlConcepto: selectedConcept.kaNlConcepto },
      },
    ]);
    expect(validationResponse.status()).toBe(400);
    expect(validationBody).toEqual(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: invalidConceptMessage,
      }),
    );
    expect(saveRequests).toEqual([]);
    await expect(feedbackDialog).toBeVisible();
    await expect(
      feedbackDialog.getByText(invalidConceptMessage, { exact: true }),
    ).toBeVisible();

    // 2. Dismiss feedback, reload, and inspect rows while observing /actions/grabar.
    await page
      .getByTestId(
        "conceptos-nov-ad-dialog-invalid-concept-confirm-button",
      )
      .click();
    await expect(feedbackDialog).toBeHidden();

    const refreshedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const refreshedRowsResponse = await refreshedRowsResponsePromise;
    expect(refreshedRowsResponse.ok()).toBe(true);

    const refreshedRows =
      (await refreshedRowsResponse.json()) as AdministrativeConcept[];

    expect(
      refreshedRows.some(
        row =>
          row.kaNlConceptoContable === attemptedPair.conceptId &&
          row.codigoNovedad.toLowerCase() === attemptedPair.noveltyCode,
      ),
    ).toBe(false);
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(saveRequests).toEqual([]);
  });
});
