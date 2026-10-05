// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";

test.describe("Concept picker and validation contracts", () => {
  test("CNA-009: Close discards a pending concept selection", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const persistenceRequests: string[] = [];

    page.on("request", request => {
      if (
        request.url() === `${apiBase}/actions/validar-concepto` ||
        request.url() === `${apiBase}/actions/grabar`
      ) {
        persistenceRequests.push(
          `${request.method()} ${request.url()}`,
        );
      }
    });

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");
    await expect(page).toHaveURL(/\/conceptos-nov-ad/);

    const persistedRow = conceptsPage.visibleRows().first();
    const persistedRowTestId = await persistedRow.getAttribute("data-testid");
    const rowKey = persistedRowTestId?.replace(
      "conceptos-nov-ad-table-row--",
      "",
    );

    expect(
      rowKey,
      `Unexpected administrative-concept row test ID: "${persistedRowTestId}"`,
    ).toBeTruthy();

    const accountingConceptCell = persistedRow.locator("td").nth(1);
    const originalAccountingConcept = await accountingConceptCell.innerText();

    // 1. Open the picker, single-click a runtime concept to create a pending selection, then use the header Close control.
    await conceptsPage.conceptPickerButton(rowKey!).click();
    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();

    const pendingConceptRow = conceptsPage.visibleConceptPickerRows().first();
    const pendingConceptTestId =
      await pendingConceptRow.getAttribute("data-testid");
    const pendingConceptId = pendingConceptTestId?.replace(
      "conceptos-nov-ad-concept-picker-row--",
      "",
    );

    expect(
      pendingConceptId,
      `Unexpected concept-picker row test ID: "${pendingConceptTestId}"`,
    ).toBeTruthy();

    await pendingConceptRow.click();
    await expect(conceptsPage.conceptPickerRow(pendingConceptId!)).toHaveClass(
      /\brow-selected\b/,
    );
    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();

    await conceptsPage.conceptPickerCloseButton.click();

    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();
    await expect(accountingConceptCell).toHaveText(originalAccountingConcept);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(persistenceRequests).toEqual([]);

    // 2. Reopen the picker.
    await conceptsPage.conceptPickerButton(rowKey!).click();

    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
    await expect(
      conceptsPage.conceptPickerRow(pendingConceptId!),
    ).not.toHaveClass(/\brow-selected\b/);
    await expect(accountingConceptCell).toHaveText(originalAccountingConcept);
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(persistenceRequests).toEqual([]);

    await conceptsPage.conceptPickerCloseButton.click();
    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();
  });
});
