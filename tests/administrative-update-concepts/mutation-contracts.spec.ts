// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AdministrativeConcept = {
  kaNlConceptoContable: number;
  codigoNovedad: string;
  ssCodigoConcepto?: string;
  ssConcepto?: string;
};

type LookupConcept = {
  kaNlConcepto: number;
  ssCodigo: string;
  ssConcepto: string | null;
  scSigno: string;
};

type SavedRow = {
  kaNlConceptoContable: number | null;
  codigoNovedad: string | null;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;
const validateConceptUrl = `${apiBase}/actions/validar-concepto`;
const saveUrl = `${apiBase}/actions/grabar`;
const deleteUrl = `${apiBase}/actions/borrar`;
const noveltyCodes = ["cmp", "per", "lrm", "vac", "lcn"] as const;
const saveSuccessMessage = "Los registros se guardaron correctamente.";

function persistedIdentity(
  concept: Pick<AdministrativeConcept, "kaNlConceptoContable" | "codigoNovedad">,
): string {
  return `${concept.kaNlConceptoContable}-${concept.codigoNovedad.toLowerCase()}`;
}

function identitySet(rows: AdministrativeConcept[]): Set<string> {
  return new Set(rows.map(persistedIdentity));
}

test.describe("Serialized disposable-data mutation contracts", () => {
  test.describe.configure({ mode: "serial" });

  test("CNA-013: Create a mapping, prove persistence, and clean it up by owned identity", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const saveRequests: Array<{
      method: string;
      payload: unknown;
    }> = [];
    let candidate:
      | {
          concept: LookupConcept;
          noveltyCode: (typeof noveltyCodes)[number];
        }
      | undefined;
    let mutationAttempted = false;

    page.on("request", request => {
      if (request.url() === saveUrl) {
        saveRequests.push({
          method: request.method(),
          payload: request.postDataJSON(),
        });
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
    const baselineIdentitySet = identitySet(initialRows);
    const lookupById = new Map(
      lookupConcepts.map(concept => [concept.kaNlConcepto, concept]),
    );

    candidate = initialRows
      .map(row => ({
        concept: lookupById.get(row.kaNlConceptoContable),
        noveltyCode: noveltyCodes.find(
          noveltyCode =>
            !baselineIdentitySet.has(
              `${row.kaNlConceptoContable}-${noveltyCode}`,
            ),
        ),
      }))
      .find(
        (
          possibleCandidate,
        ): possibleCandidate is {
          concept: LookupConcept;
          noveltyCode: (typeof noveltyCodes)[number];
        } =>
          possibleCandidate.concept !== undefined &&
          typeof possibleCandidate.concept.ssConcepto === "string" &&
          possibleCandidate.concept.ssConcepto.length > 0 &&
          possibleCandidate.noveltyCode !== undefined,
      );

    test.skip(
      !candidate,
      "CNA-013 requires one runtime-confirmed accepted concept with an unused novelty pair",
    );

    const ownedPair = {
      kaNlConceptoContable: candidate!.concept.kaNlConcepto,
      codigoNovedad: candidate!.noveltyCode.toUpperCase(),
    };
    const ownedIdentity = persistedIdentity(ownedPair);

    // 1. In a serial suite, fetch fresh rows and the concept lookup, derive an unused pair from the five novelties and four currently accepted concepts, and retain the baseline identity set.
    expect(baselineIdentitySet.has(ownedIdentity)).toBe(false);
    expect(baselineIdentitySet.size).toBe(initialRows.length);
    await expect(conceptsPage.deleteButton).toBeDisabled();
    await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);

    try {
      // 2. Fill the empty row, validate the concept, start waiting for /actions/grabar, and click Grabar exactly once.
      const workingRow = conceptsPage.emptyWorkingRow();
      await workingRow.getByRole("combobox").click();
      await page
        .getByTestId(
          `conceptos-nov-ad-novelty-option-${candidate!.noveltyCode}`,
        )
        .click();

      await workingRow.getByRole("button", { name: "..." }).click();
      await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
      await conceptsPage.searchConcept(candidate!.concept.kaNlConcepto);

      const conceptRow = conceptsPage.conceptPickerRow(
        candidate!.concept.kaNlConcepto,
      );
      await expect(conceptRow).toHaveCount(1);

      const validationResponsePromise = page.waitForResponse(
        response =>
          response.url() === validateConceptUrl &&
          response.request().method() === "POST",
      );
      await conceptRow.dblclick();

      const validationResponse = await validationResponsePromise;
      expect(validationResponse.status()).toBe(200);
      expect(validationResponse.request().postDataJSON()).toEqual({
        kaNlConcepto: candidate!.concept.kaNlConcepto,
      });
      expect(await validationResponse.json()).toEqual(candidate!.concept);
      await expect(conceptsPage.row(ownedIdentity)).toBeVisible();
      await expect(conceptsPage.saveButton).toBeEnabled();

      const saveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      mutationAttempted = true;
      await conceptsPage.saveButton.click();

      const saveConfirmationButton = page.getByTestId(
        "conceptos-nov-ad-dialog-save-confirmation-confirm-button",
      );
      await expect(saveConfirmationButton).toBeVisible();
      await saveConfirmationButton.click();

      const saveResponse = await saveResponsePromise;
      const savePayload = saveResponse.request().postDataJSON() as {
        rows: SavedRow[];
      };
      const saveResponseRows =
        (await saveResponse.json()) as AdministrativeConcept[];

      expect(saveResponse.status()).toBe(200);
      expect(saveResponse.request().method()).toBe("POST");
      expect(savePayload).toEqual({ rows: expect.any(Array) });
      expect(
        savePayload.rows.filter(
          row =>
            row.kaNlConceptoContable === null &&
            row.codigoNovedad === null,
        ),
      ).toHaveLength(1);

      const submittedRows = savePayload.rows.filter(
        (row): row is AdministrativeConcept =>
          typeof row.kaNlConceptoContable === "number" &&
          typeof row.codigoNovedad === "string",
      );
      expect(submittedRows).toHaveLength(initialRows.length + 1);
      expect([...identitySet(submittedRows)].sort()).toEqual(
        [...baselineIdentitySet, ownedIdentity].sort(),
      );
      expect(saveRequests).toEqual([
        {
          method: "POST",
          payload: savePayload,
        },
      ]);

      const returnedOwnedRows = saveResponseRows.filter(
        row => persistedIdentity(row) === ownedIdentity,
      );
      expect(returnedOwnedRows).toHaveLength(1);
      expect(returnedOwnedRows[0]).toEqual(
        expect.objectContaining(ownedPair),
      );
      expect(identitySet(saveResponseRows).has(ownedIdentity)).toBe(true);
      for (const baselineIdentity of baselineIdentitySet) {
        expect(identitySet(saveResponseRows).has(baselineIdentity)).toBe(true);
      }

      const saveSuccessFeedback = page.getByText(saveSuccessMessage, {
        exact: true,
      });
      await expect(saveSuccessFeedback).toBeVisible();
      await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
      await page
        .getByTestId("conceptos-nov-ad-dialog-save-success-confirm-button")
        .click();

      // 3. Reload, fetch fresh rows, and locate the owned record by returned identity and pair.
      const persistedRowsResponsePromise = page.waitForResponse(
        response =>
          response.url() === rowsUrl &&
          response.request().method() === "GET",
      );
      await conceptsPage.reloadButton.click();

      const persistedRowsResponse = await persistedRowsResponsePromise;
      expect(persistedRowsResponse.ok()).toBe(true);

      const persistedRows =
        (await persistedRowsResponse.json()) as AdministrativeConcept[];
      const persistedOwnedRows = persistedRows.filter(
        row => persistedIdentity(row) === ownedIdentity,
      );
      expect(persistedOwnedRows).toHaveLength(1);
      expect(persistedOwnedRows[0]).toEqual(
        expect.objectContaining(ownedPair),
      );
      await expect(conceptsPage.row(ownedIdentity)).toHaveCount(1);
    } finally {
      // 4. In finally, select/delete only the owned identity, capture /actions/borrar, reload, and fetch rows again.
      if (mutationAttempted && candidate) {
        const visibleSaveSuccessButton = page.getByTestId(
          "conceptos-nov-ad-dialog-save-success-confirm-button",
        );
        if (await visibleSaveSuccessButton.isVisible()) {
          await visibleSaveSuccessButton.click();
        }

        const cleanupRowsResponsePromise = page.waitForResponse(
          response =>
            response.url() === rowsUrl &&
            response.request().method() === "GET",
        );
        await conceptsPage.reloadButton.click();

        const cleanupRowsResponse = await cleanupRowsResponsePromise;
        expect(cleanupRowsResponse.ok()).toBe(true);

        const cleanupRows =
          (await cleanupRowsResponse.json()) as AdministrativeConcept[];
        const ownedRowsBeforeCleanup = cleanupRows.filter(
          row => persistedIdentity(row) === ownedIdentity,
        );

        if (ownedRowsBeforeCleanup.length > 0) {
          expect(ownedRowsBeforeCleanup).toHaveLength(1);
          await expect(conceptsPage.row(ownedIdentity)).toHaveCount(1);
          await conceptsPage.row(ownedIdentity).click();
          await expect(conceptsPage.deleteButton).toBeEnabled();

          const deleteResponsePromise = page.waitForResponse(
            response =>
              response.url() === deleteUrl &&
              response.request().method() === "POST",
          );
          await conceptsPage.deleteButton.click();

          const deleteConfirmationButton = page.getByTestId(
            "conceptos-nov-ad-dialog-delete-confirmation-confirm-button",
          );
          await expect(deleteConfirmationButton).toBeVisible();
          await deleteConfirmationButton.click();

          const deleteResponse = await deleteResponsePromise;
          const deletePayload =
            deleteResponse.request().postDataJSON() as AdministrativeConcept;
          const deleteResponseRows =
            (await deleteResponse.json()) as AdministrativeConcept[];

          expect(deleteResponse.status()).toBe(200);
          expect(deleteResponse.request().method()).toBe("POST");
          expect(deletePayload).toEqual(ownedPair);
          expect(baselineIdentitySet.has(persistedIdentity(deletePayload))).toBe(
            false,
          );
          expect(identitySet(deleteResponseRows).has(ownedIdentity)).toBe(false);
          for (const baselineIdentity of baselineIdentitySet) {
            expect(identitySet(deleteResponseRows).has(baselineIdentity)).toBe(
              true,
            );
          }
        }

        const finalRowsResponsePromise = page.waitForResponse(
          response =>
            response.url() === rowsUrl &&
            response.request().method() === "GET",
        );
        await conceptsPage.reloadButton.click();

        const finalRowsResponse = await finalRowsResponsePromise;
        expect(finalRowsResponse.ok()).toBe(true);

        const finalRows =
          (await finalRowsResponse.json()) as AdministrativeConcept[];
        expect(
          finalRows.filter(row => persistedIdentity(row) === ownedIdentity),
        ).toHaveLength(0);
        await expect(conceptsPage.row(ownedIdentity)).toHaveCount(0);
      }
    }
  });

  test("CNA-014: A second Grabar updates the current owned mapping without duplication", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    let sourcePair: AdministrativeConcept | undefined;
    let targetPair: AdministrativeConcept | undefined;
    let mutationAttempted = false;
    let baselineIdentitySet = new Set<string>();

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
    baselineIdentitySet = identitySet(initialRows);
    const lookupById = new Map(
      lookupConcepts.map(concept => [concept.kaNlConcepto, concept]),
    );
    const candidate = initialRows
      .map(row => {
        const concept = lookupById.get(row.kaNlConceptoContable);
        const unusedNoveltyCodes = noveltyCodes.filter(
          noveltyCode =>
            !baselineIdentitySet.has(
              `${row.kaNlConceptoContable}-${noveltyCode}`,
            ),
        );

        return { concept, unusedNoveltyCodes };
      })
      .find(
        possibleCandidate =>
          possibleCandidate.concept !== undefined &&
          typeof possibleCandidate.concept.ssConcepto === "string" &&
          possibleCandidate.concept.ssConcepto.length > 0 &&
          possibleCandidate.unusedNoveltyCodes.length >= 2,
      );

    test.skip(
      !candidate,
      "CNA-014 requires one runtime-confirmed accepted concept with two unused novelty pairs",
    );

    sourcePair = {
      kaNlConceptoContable: candidate!.concept!.kaNlConcepto,
      codigoNovedad: candidate!.unusedNoveltyCodes[0].toUpperCase(),
    };
    targetPair = {
      kaNlConceptoContable: candidate!.concept!.kaNlConcepto,
      codigoNovedad: candidate!.unusedNoveltyCodes[1].toUpperCase(),
    };
    const sourceIdentity = persistedIdentity(sourcePair);
    const targetIdentity = persistedIdentity(targetPair);

    // 1. Create one disposable mapping and retain its backend identity, then change its novelty or concept to another runtime-safe unused pair without reloading or selecting a different row.
    expect(sourceIdentity).not.toBe(targetIdentity);
    expect(baselineIdentitySet.has(sourceIdentity)).toBe(false);
    expect(baselineIdentitySet.has(targetIdentity)).toBe(false);

    try {
      const workingRow = conceptsPage.emptyWorkingRow();
      await workingRow.getByRole("combobox").click();
      await page
        .getByTestId(
          `conceptos-nov-ad-novelty-option-${candidate!.unusedNoveltyCodes[0]}`,
        )
        .click();
      await workingRow.getByRole("button", { name: "..." }).click();
      await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
      await conceptsPage.searchConcept(candidate!.concept!.kaNlConcepto);

      const conceptRow = conceptsPage.conceptPickerRow(
        candidate!.concept!.kaNlConcepto,
      );
      await expect(conceptRow).toHaveCount(1);

      const validationResponsePromise = page.waitForResponse(
        response =>
          response.url() === validateConceptUrl &&
          response.request().method() === "POST",
      );
      await conceptRow.dblclick();

      const validationResponse = await validationResponsePromise;
      expect(validationResponse.status()).toBe(200);
      expect(validationResponse.request().postDataJSON()).toEqual({
        kaNlConcepto: candidate!.concept!.kaNlConcepto,
      });

      const firstSaveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      mutationAttempted = true;
      await conceptsPage.saveButton.click();
      await page
        .getByTestId(
          "conceptos-nov-ad-dialog-save-confirmation-confirm-button",
        )
        .click();

      const firstSaveResponse = await firstSaveResponsePromise;
      expect(firstSaveResponse.status()).toBe(200);
      const firstSaveRows =
        (await firstSaveResponse.json()) as AdministrativeConcept[];
      expect(
        firstSaveRows.filter(
          row => persistedIdentity(row) === sourceIdentity,
        ),
      ).toHaveLength(1);
      expect(identitySet(firstSaveRows).has(targetIdentity)).toBe(false);
      await expect(
        page.getByText(saveSuccessMessage, { exact: true }),
      ).toBeVisible();
      await page
        .getByTestId("conceptos-nov-ad-dialog-save-success-confirm-button")
        .click();

      await expect(conceptsPage.row(sourceIdentity)).toHaveCount(1);
      await conceptsPage.noveltySelect(sourceIdentity).click();
      await page
        .getByTestId(
          `conceptos-nov-ad-novelty-option-${candidate!.unusedNoveltyCodes[1]}`,
        )
        .click();
      await expect(conceptsPage.row(targetIdentity)).toHaveCount(1);
      await expect(conceptsPage.row(sourceIdentity)).toHaveCount(0);

      // 2. Start a save wait and click Grabar a second time.
      const secondSaveResponsePromise = page.waitForResponse(
        response =>
          response.url() === saveUrl &&
          response.request().method() === "POST",
      );
      await conceptsPage.saveButton.click();
      await page
        .getByTestId(
          "conceptos-nov-ad-dialog-save-confirmation-confirm-button",
        )
        .click();

      const secondSaveResponse = await secondSaveResponsePromise;
      const secondSavePayload =
        secondSaveResponse.request().postDataJSON() as { rows: SavedRow[] };
      const secondSaveRows =
        (await secondSaveResponse.json()) as AdministrativeConcept[];
      expect(secondSaveResponse.status()).toBe(200);

      const submittedRows = secondSavePayload.rows.filter(
        (row): row is AdministrativeConcept =>
          typeof row.kaNlConceptoContable === "number" &&
          typeof row.codigoNovedad === "string",
      );
      expect([...identitySet(submittedRows)].sort()).toEqual(
        [...baselineIdentitySet, targetIdentity].sort(),
      );
      expect(identitySet(submittedRows).has(sourceIdentity)).toBe(false);
      expect(
        secondSaveRows.filter(
          row => persistedIdentity(row) === targetIdentity,
        ),
      ).toHaveLength(1);
      expect(identitySet(secondSaveRows).has(sourceIdentity)).toBe(false);
      for (const baselineIdentity of baselineIdentitySet) {
        expect(identitySet(secondSaveRows).has(baselineIdentity)).toBe(true);
      }

      await expect(
        page.getByText(saveSuccessMessage, { exact: true }),
      ).toBeVisible();
      await page
        .getByTestId("conceptos-nov-ad-dialog-save-success-confirm-button")
        .click();

      // 3. Reload and fetch rows.
      const persistedRowsResponsePromise = page.waitForResponse(
        response =>
          response.url() === rowsUrl &&
          response.request().method() === "GET",
      );
      await conceptsPage.reloadButton.click();

      const persistedRowsResponse = await persistedRowsResponsePromise;
      expect(persistedRowsResponse.ok()).toBe(true);
      const persistedRows =
        (await persistedRowsResponse.json()) as AdministrativeConcept[];
      expect(
        persistedRows.filter(
          row => persistedIdentity(row) === targetIdentity,
        ),
      ).toHaveLength(1);
      expect(identitySet(persistedRows).has(sourceIdentity)).toBe(false);
      expect(identitySet(persistedRows).size).toBe(persistedRows.length);
      await expect(conceptsPage.row(targetIdentity)).toHaveCount(1);
      await expect(conceptsPage.row(sourceIdentity)).toHaveCount(0);
    } finally {
      // 4. Delete the owned identity in finally and prove absence through a fresh rows response.
      if (mutationAttempted && sourcePair && targetPair) {
        const visibleSaveSuccessButton = page.getByTestId(
          "conceptos-nov-ad-dialog-save-success-confirm-button",
        );
        if (await visibleSaveSuccessButton.isVisible()) {
          await visibleSaveSuccessButton.click();
        }

        for (const ownedPair of [targetPair, sourcePair]) {
          const ownedIdentity = persistedIdentity(ownedPair);
          const cleanupRowsResponsePromise = page.waitForResponse(
            response =>
              response.url() === rowsUrl &&
              response.request().method() === "GET",
          );
          await conceptsPage.reloadButton.click();

          const cleanupRowsResponse = await cleanupRowsResponsePromise;
          expect(cleanupRowsResponse.ok()).toBe(true);
          const cleanupRows =
            (await cleanupRowsResponse.json()) as AdministrativeConcept[];

          if (
            cleanupRows.some(row => persistedIdentity(row) === ownedIdentity)
          ) {
            expect(baselineIdentitySet.has(ownedIdentity)).toBe(false);
            await conceptsPage.row(ownedIdentity).click();

            const deleteResponsePromise = page.waitForResponse(
              response =>
                response.url() === deleteUrl &&
                response.request().method() === "POST",
            );
            await conceptsPage.deleteButton.click();
            await page
              .getByTestId(
                "conceptos-nov-ad-dialog-delete-confirmation-confirm-button",
              )
              .click();

            const deleteResponse = await deleteResponsePromise;
            expect(deleteResponse.status()).toBe(200);
            expect(deleteResponse.request().postDataJSON()).toEqual(ownedPair);
          }
        }

        const finalRowsResponsePromise = page.waitForResponse(
          response =>
            response.url() === rowsUrl &&
            response.request().method() === "GET",
        );
        await conceptsPage.reloadButton.click();

        const finalRowsResponse = await finalRowsResponsePromise;
        expect(finalRowsResponse.ok()).toBe(true);
        const finalRows =
          (await finalRowsResponse.json()) as AdministrativeConcept[];
        expect(identitySet(finalRows).has(sourceIdentity)).toBe(false);
        expect(identitySet(finalRows).has(targetIdentity)).toBe(false);
        for (const baselineIdentity of baselineIdentitySet) {
          expect(identitySet(finalRows).has(baselineIdentity)).toBe(true);
        }
      }
    }
  });
});
