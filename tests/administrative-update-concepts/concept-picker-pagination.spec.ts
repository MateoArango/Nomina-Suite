// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

type AccountingConcept = {
  kaNlConcepto: number;
  ssCodigo: string;
};

type PageSize = 10 | 25 | 50 | 100;

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;

test.describe("Concept picker and validation contracts", () => {
  test("CNA-008: Concept-picker page sizes and navigation boundaries", async ({
    page,
  }) => {
    test.setTimeout(60_000);

    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const persistenceRequests: string[] = [];

    page.on("request", request => {
      if (
        request.url() === `${apiBase}/actions/grabar` ||
        request.url() === `${apiBase}/actions/borrar`
      ) {
        persistenceRequests.push(request.url());
      }
    });

    const visibleConceptIds = async (): Promise<string[]> => {
      const rows = await conceptsPage.visibleConceptPickerRows().all();
      const testIds = await Promise.all(
        rows.map(row => row.getAttribute("data-testid")),
      );

      return testIds.map(testId => {
        const conceptId = testId?.replace(
          "conceptos-nov-ad-concept-picker-row--",
          "",
        );

        expect(
          conceptId,
          `Unexpected concept-picker row test ID: "${testId}"`,
        ).toBeTruthy();

        return conceptId!;
      });
    };

    const assertPage = async (
      concepts: AccountingConcept[],
      pageSize: PageSize,
      pageNumber: number,
    ): Promise<void> => {
      const startIndex = (pageNumber - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, concepts.length);
      const expectedIds = concepts
        .slice(startIndex, endIndex)
        .map(concept => String(concept.kaNlConcepto));
      const lastPage = Math.ceil(concepts.length / pageSize);

      await expect
        .poll(() => conceptsPage.readConceptPickerPagerRange())
        .toEqual({
          start: startIndex + 1,
          end: endIndex,
          total: concepts.length,
        });
      await expect.poll(visibleConceptIds).toEqual(expectedIds);
      await expect(conceptsPage.visibleConceptPickerRows()).toHaveCount(
        expectedIds.length,
      );

      if (pageNumber === 1) {
        await expect(
          conceptsPage.conceptPickerPreviousPageButton,
        ).toBeDisabled();
      } else {
        await expect(
          conceptsPage.conceptPickerPreviousPageButton,
        ).toBeEnabled();
      }

      if (pageNumber === lastPage) {
        await expect(
          conceptsPage.conceptPickerNextPageButton,
        ).toBeDisabled();
      } else {
        await expect(
          conceptsPage.conceptPickerNextPageButton,
        ).toBeEnabled();
      }
    };

    // 1. Using the runtime concept lookup, exercise page sizes 10, 25, 50, and 100 and navigate forward and backward.
    const conceptLookupResponsePromise = page.waitForResponse(
      response =>
        response.url() === conceptLookupUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/conceptos-nov-ad");

    const conceptLookupResponse = await conceptLookupResponsePromise;
    expect(conceptLookupResponse.ok()).toBe(true);

    const concepts = (await conceptLookupResponse.json()) as AccountingConcept[];
    expect(Array.isArray(concepts)).toBe(true);
    expect(concepts.length).toBeGreaterThan(0);

    const conceptIds = concepts.map(concept => concept.kaNlConcepto);
    expect(
      concepts.every(
        concept =>
          typeof concept.kaNlConcepto === "number" &&
          typeof concept.ssCodigo === "string",
      ),
      "Every runtime concept must expose a stable identity and accounting code",
    ).toBe(true);
    expect(
      new Set(conceptIds).size,
      "The runtime concept lookup returned duplicate stable identities",
    ).toBe(conceptIds.length);

    const persistedRow = conceptsPage.visibleRows().first();
    const persistedRowTestId = await persistedRow.getAttribute("data-testid");
    const persistedRowKey = persistedRowTestId?.replace(
      "conceptos-nov-ad-table-row--",
      "",
    );

    expect(
      persistedRowKey,
      `Unexpected administrative row test ID: "${persistedRowTestId}"`,
    ).toBeTruthy();

    const originalNovelty =
      (await persistedRow.getByRole("combobox").textContent())?.trim() ?? "";
    const originalConcept =
      (await persistedRow.locator("td").nth(1).textContent())?.trim() ?? "";

    await conceptsPage.conceptPickerButton(persistedRowKey!).click();
    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
    await expect(conceptsPage.conceptPickerPager).toBeVisible();

    for (const pageSize of [10, 25, 50, 100] as const) {
      await conceptsPage.conceptPickerPageSizeButton(pageSize).click();
      await expect(
        conceptsPage.conceptPickerPageSizeButton(pageSize),
      ).toHaveAttribute("aria-pressed", "true");
      await assertPage(concepts, pageSize, 1);
    }

    const navigationPageSize = ([100, 50, 25, 10] as const).find(
      pageSize => concepts.length > pageSize,
    );

    expect(
      navigationPageSize,
      "CNA-008 requires enough runtime concepts to exercise multiple picker pages",
    ).toBeDefined();

    if (
      (await conceptsPage.selectedConceptPickerPageSize()) !==
      navigationPageSize
    ) {
      await conceptsPage
        .conceptPickerPageSizeButton(navigationPageSize!)
        .click();
    }

    const lastPage = Math.ceil(concepts.length / navigationPageSize!);
    await assertPage(concepts, navigationPageSize!, 1);

    for (let pageNumber = 2; pageNumber <= lastPage; pageNumber += 1) {
      await conceptsPage.conceptPickerNextPageButton.click();
      await assertPage(
        concepts,
        navigationPageSize!,
        pageNumber,
      );
    }

    for (let pageNumber = lastPage - 1; pageNumber >= 1; pageNumber -= 1) {
      await conceptsPage.conceptPickerPreviousPageButton.click();
      await assertPage(
        concepts,
        navigationPageSize!,
        pageNumber,
      );
    }

    // 2. Return to the first page and close the picker.
    await expect(conceptsPage.conceptPickerPreviousPageButton).toBeDisabled();
    await conceptsPage.conceptPickerCloseButton.click();

    await expect(conceptsPage.conceptPickerPanel).not.toBeInViewport();
    await expect(persistedRow.getByRole("combobox")).toHaveText(
      originalNovelty,
    );
    await expect(persistedRow.locator("td").nth(1)).toHaveText(
      originalConcept,
    );
    await expect(conceptsPage.saveButton).toBeDisabled();
    expect(persistenceRequests).toEqual([]);
  });
});
