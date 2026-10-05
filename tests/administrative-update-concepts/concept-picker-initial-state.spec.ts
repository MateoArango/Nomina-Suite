// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AccountingConcept = {
  kaNlConcepto: number;
  ssCodigo: string;
  ssConcepto: string | null;
  scSigno: string;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;

function expectValidAccountingConcept(
  concept: AccountingConcept,
  index: number,
): void {
  expect(
    concept,
    `Malformed accounting-concept record at response index ${index}`,
  ).toEqual(
    expect.objectContaining({
      kaNlConcepto: expect.any(Number),
      ssCodigo: expect.any(String),
      scSigno: expect.any(String),
    }),
  );

  expect(concept.ssCodigo).not.toBe("");
  expect(
    concept.ssConcepto === null || typeof concept.ssConcepto === "string",
    `Invalid concept name at response index ${index}`,
  ).toBe(true);
}

test.describe("Concept picker and validation contracts", () => {
  test("CNA-006: Concept picker maps the runtime catalog by stable concept ID", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const actionRequests: string[] = [];

    page.on("request", request => {
      if (
        request.url() === `${apiBase}/actions/validar-concepto` ||
        request.url() === `${apiBase}/actions/grabar`
      ) {
        actionRequests.push(request.url());
      }
    });

    // 1. Start a wait for GET /lookups/conceptos, open the concept picker from the empty working row, and validate unique concept identities.
    const conceptLookupResponsePromise = page.waitForResponse(
      response =>
        response.url() === conceptLookupUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");
    await expect(page).toHaveURL(/\/conceptos-nov-ad/);

    const conceptLookupResponse = await conceptLookupResponsePromise;
    expect(conceptLookupResponse.ok()).toBe(true);

    const concepts = (await conceptLookupResponse.json()) as AccountingConcept[];
    expect(Array.isArray(concepts)).toBe(true);
    expect(concepts.length).toBeGreaterThan(0);
    concepts.forEach(expectValidAccountingConcept);

    const conceptIds = concepts.map(concept => concept.kaNlConcepto);
    expect(
      new Set(conceptIds).size,
      "The accounting-concept lookup returned duplicate stable concept IDs",
    ).toBe(conceptIds.length);

    const workingRow = conceptsPage.emptyWorkingRow();
    await expect(workingRow).toHaveCount(1);
    await workingRow.getByRole("button", { name: "..." }).click();

    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();

    await expect(conceptsPage.conceptPickerHeading).toHaveText(
      "Seleccionar Concepto",
    );
    await expect(conceptsPage.conceptPickerSearchControl).toBeVisible();
    await expect(conceptsPage.conceptPickerTable).toBeVisible();
    await expect(conceptsPage.conceptPickerPager).toBeVisible();
    await expect(conceptsPage.conceptPickerCloseButton).toBeVisible();

    for (const size of [10, 25, 50, 100] as const) {
      await expect(conceptsPage.conceptPickerPageSizeButton(size)).toBeVisible();
    }

    const conceptsById = new Map(
      concepts.map(concept => [String(concept.kaNlConcepto), concept]),
    );
    const visibleRows = await conceptsPage.visibleConceptPickerRows().all();
    const visibleIds: string[] = [];

    for (const row of visibleRows) {
      const testId = await row.getAttribute("data-testid");
      const conceptId = testId?.replace(
        "conceptos-nov-ad-concept-picker-row--",
        "",
      );
      const expectedConcept = conceptId
        ? conceptsById.get(conceptId)
        : undefined;

      expect(
        expectedConcept,
        `Missing runtime lookup data for visible concept-picker row "${conceptId}"`,
      ).toBeDefined();
      visibleIds.push(conceptId!);
      await expect(row.locator("td").nth(0)).toHaveText(conceptId!);
      await expect(row.locator("td").nth(1)).toHaveText(
        expectedConcept!.ssCodigo,
      );
      await expect(row.locator("td").nth(2)).toHaveText(
        expectedConcept!.ssConcepto ?? "",
      );
    }

    expect(new Set(visibleIds).size).toBe(visibleIds.length);

    const selectedPageSize =
      await conceptsPage.selectedConceptPickerPageSize();
    const pagerRange = await conceptsPage.readConceptPickerPagerRange();

    expect(visibleRows).toHaveLength(
      Math.min(selectedPageSize, concepts.length),
    );
    expect(pagerRange).toEqual({
      start: 1,
      end: Math.min(selectedPageSize, concepts.length),
      total: concepts.length,
    });
    await expect(conceptsPage.conceptPickerPreviousPageButton).toBeDisabled();

    if (concepts.length > selectedPageSize) {
      await expect(conceptsPage.conceptPickerNextPageButton).toBeEnabled();
    } else {
      await expect(conceptsPage.conceptPickerNextPageButton).toBeDisabled();
    }

    // 2. Close the panel without choosing a concept.
    await conceptsPage.conceptPickerCloseButton.click();

    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();

    await expect(workingRow.getByRole("combobox")).toHaveText("");
    await expect(workingRow.locator("td").nth(1)).toHaveText("");
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(actionRequests).toEqual([]);
  });
});
