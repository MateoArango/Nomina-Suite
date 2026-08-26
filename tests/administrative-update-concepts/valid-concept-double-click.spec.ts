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

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;
const validateConceptUrl = `${apiBase}/actions/validar-concepto`;
const saveUrl = `${apiBase}/actions/grabar`;
const noveltyCodes = ["cmp", "per", "lrm", "vac", "lcn"] as const;

function persistedIdentity(concept: AdministrativeConcept): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

test.describe("Concept picker and validation contracts", () => {
  test("CNA-010: Double-click applies a valid concept and validates immediately", async ({
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
    const initialIdentitySet = new Set(initialRows.map(persistedIdentity));
    const lookupById = new Map(
      lookupConcepts.map(concept => [concept.kaNlConcepto, concept]),
    );

    const localCandidate = initialRows
      .map(row => ({
        concept: lookupById.get(row.kaNlConceptoContable),
        noveltyCode: noveltyCodes.find(
          noveltyCode =>
            !initialIdentitySet.has(
              `${row.kaNlConceptoContable}-${noveltyCode}`,
            ),
        ),
      }))
      .find(
        (
          candidate,
        ): candidate is {
          concept: LookupConcept;
          noveltyCode: (typeof noveltyCodes)[number];
        } =>
          candidate.concept !== undefined &&
          typeof candidate.concept.ssConcepto === "string" &&
          candidate.concept.ssConcepto.length > 0 &&
          candidate.noveltyCode !== undefined,
      );

    test.skip(
      !localCandidate,
      "CNA-010 requires one runtime-confirmed accepted concept with an unused local novelty pair",
    );

    const selectedConcept = localCandidate!.concept;
    const selectedNoveltyCode = localCandidate!.noveltyCode;
    const appliedRowKey =
      `${selectedConcept.kaNlConcepto}-${selectedNoveltyCode}`;
    const workingRow = conceptsPage.emptyWorkingRow();

    // 1. Resolve one of the currently accepted concepts from runtime lookup data, start waiting for /actions/validar-concepto, and double-click its stable-ID row.
    await expect(workingRow).toHaveCount(1);
    await workingRow.getByRole("combobox").click();
    await page
      .getByTestId(
        `conceptos-nov-ad-novelty-option-${selectedNoveltyCode}`,
      )
      .click();

    await workingRow.getByRole("button", { name: "..." }).click();
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
    const validationBody = (await validationResponse.json()) as LookupConcept;

    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();
    await expect(
      conceptsPage.row(appliedRowKey).locator("td").nth(1),
    ).toHaveText(selectedConcept.ssConcepto!);
    await expect(conceptsPage.saveButton).toBeEnabled();

    expect(validationRequests).toEqual([
      {
        method: "POST",
        payload: { kaNlConcepto: selectedConcept.kaNlConcepto },
      },
    ]);
    expect(validationResponse.status()).toBe(200);
    expect(validationBody).toEqual(selectedConcept);
    expect(saveRequests).toEqual([]);

    // 2. Reset with Recargar while observing /actions/grabar.
    const refreshedRowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await conceptsPage.reloadButton.click();

    const refreshedRowsResponse = await refreshedRowsResponsePromise;
    expect(refreshedRowsResponse.ok()).toBe(true);

    const refreshedRows =
      (await refreshedRowsResponse.json()) as AdministrativeConcept[];
    const refreshedIdentitySet = new Set(
      refreshedRows.map(persistedIdentity),
    );

    expect([...refreshedIdentitySet].sort()).toEqual(
      [...initialIdentitySet].sort(),
    );
    await expect(conceptsPage.row(appliedRowKey)).toHaveCount(0);
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(saveRequests).toEqual([]);
  });
});
