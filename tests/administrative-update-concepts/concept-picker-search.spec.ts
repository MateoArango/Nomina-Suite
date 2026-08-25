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

type SearchCase = {
  field: "code" | "name" | "id";
  term: string;
};

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;

function normalized(value: string | number | null): string {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function matchesSearch(concept: AccountingConcept, term: string): boolean {
  const normalizedTerm = normalized(term);

  return [
    concept.kaNlConcepto,
    concept.ssCodigo,
    concept.ssConcepto,
  ].some(value => normalized(value).includes(normalizedTerm));
}

function findSearchCases(
  concepts: AccountingConcept[],
  pageSize: number,
): SearchCase[] {
  const codeConcept = concepts.find(concept => {
    const term = normalized(concept.ssCodigo);
    const matches = concepts.filter(candidate => matchesSearch(candidate, term));

    return (
      term.length > 0 &&
      matches.length > 0 &&
      matches.length <= pageSize &&
      matches.length < concepts.length &&
      matches.every(candidate =>
        normalized(candidate.ssCodigo).includes(term),
      )
    );
  });

  const idConcept = concepts.find(concept => {
    const term = String(concept.kaNlConcepto);
    const matches = concepts.filter(candidate => matchesSearch(candidate, term));

    return (
      matches.length > 0 &&
      matches.length <= pageSize &&
      matches.length < concepts.length
    );
  });

  let nameTerm: string | undefined;

  for (const concept of concepts) {
    const candidates =
      concept.ssConcepto?.match(/[A-ZÁÉÍÓÚÑÜ0-9]+/gi) ?? [];

    nameTerm = candidates
      .map(normalized)
      .find(term => {
        const matches = concepts.filter(candidate =>
          matchesSearch(candidate, term),
        );

        return (
          term.length >= 5 &&
          matches.length > 0 &&
          matches.length <= pageSize &&
          matches.length < concepts.length &&
          matches.every(candidate =>
            normalized(candidate.ssConcepto).includes(term),
          )
        );
      });

    if (nameTerm) {
      break;
    }
  }

  expect(codeConcept, "No selective runtime code search term was available").toBeDefined();
  expect(nameTerm, "No selective runtime name-fragment search term was available").toBeDefined();
  expect(idConcept, "No selective runtime ID search term was available").toBeDefined();

  return [
    { field: "code", term: codeConcept!.ssCodigo },
    { field: "name", term: nameTerm! },
    { field: "id", term: String(idConcept!.kaNlConcepto) },
  ];
}

async function visibleConceptIds(
  conceptsPage: AdministrativeUpdateConceptsPage,
): Promise<string[]> {
  const rows = await conceptsPage.visibleConceptPickerRows().all();
  const ids: string[] = [];

  for (const row of rows) {
    const testId = await row.getAttribute("data-testid");
    const id = testId?.replace(
      "conceptos-nov-ad-concept-picker-row--",
      "",
    );

    expect(id, `Unexpected concept-picker row test ID: "${testId}"`).toBeTruthy();
    ids.push(id!);
  }

  return ids;
}

test.describe("Concept picker and validation contracts", () => {
  test("CNA-007: Concept search filters by code, name, and ID and restores the catalog", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    let conceptLookupRequestCount = 0;

    page.on("request", request => {
      if (
        request.url() === conceptLookupUrl &&
        request.method() === "GET"
      ) {
        conceptLookupRequestCount += 1;
      }
    });

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

    const firstRowTestId = await conceptsPage
      .visibleRows()
      .first()
      .getAttribute("data-testid");
    const rowKey = firstRowTestId?.replace(
      "conceptos-nov-ad-table-row--",
      "",
    );

    expect(rowKey, `Unexpected administrative row test ID: "${firstRowTestId}"`).toBeTruthy();
    await conceptsPage.conceptPickerButton(rowKey!).click();
    await expect(conceptsPage.conceptPickerPanel).toBeInViewport();
    await expect(conceptsPage.conceptPickerSearchControl).toBeVisible();

    const pageSize = await conceptsPage.selectedConceptPickerPageSize();
    const initialPagerRange =
      await conceptsPage.readConceptPickerPagerRange();
    const initialIds = await visibleConceptIds(conceptsPage);

    expect(initialPagerRange).toEqual({
      start: 1,
      end: Math.min(pageSize, concepts.length),
      total: concepts.length,
    });
    expect(initialIds).toHaveLength(
      Math.min(pageSize, concepts.length),
    );

    const conceptsById = new Map(
      concepts.map(concept => [String(concept.kaNlConcepto), concept]),
    );
    const searchCases = findSearchCases(concepts, pageSize);

    // 1. Derive selective code, name-fragment, and ID terms from the runtime lookup and search each term independently.
    for (const searchCase of searchCases) {
      await conceptsPage.searchConcept(searchCase.term);
      await expect(conceptsPage.conceptPickerSearchInput).toHaveValue(
        searchCase.term,
      );

      const expectedMatches = concepts.filter(concept =>
        matchesSearch(concept, searchCase.term),
      );
      const expectedIds = new Set(
        expectedMatches.map(concept => String(concept.kaNlConcepto)),
      );
      expect(expectedMatches.length).toBeGreaterThan(0);
      expect(expectedMatches.length).toBeLessThan(concepts.length);
      const expectedVisibleCount = Math.min(
        pageSize,
        expectedMatches.length,
      );
      const visibleRowsLocator = conceptsPage.visibleConceptPickerRows();

      await expect(visibleRowsLocator).toHaveCount(expectedVisibleCount);

      const visibleRows = await visibleRowsLocator.all();
      const visibleIds: string[] = [];

      expect(visibleRows).toHaveLength(
        expectedVisibleCount,
      );

      for (const row of visibleRows) {
        const testId = await row.getAttribute("data-testid");
        const conceptId = testId?.replace(
          "conceptos-nov-ad-concept-picker-row--",
          "",
        );
        const runtimeConcept = conceptId
          ? conceptsById.get(conceptId)
          : undefined;

        expect(
          runtimeConcept,
          `Missing runtime concept for filtered row "${conceptId}"`,
        ).toBeDefined();
        expect(expectedIds.has(conceptId!)).toBe(true);
        expect(matchesSearch(runtimeConcept!, searchCase.term)).toBe(true);
        await expect(row.locator("td").nth(0)).toHaveText(conceptId!);
        visibleIds.push(conceptId!);

        if (searchCase.field === "code") {
          expect(normalized(runtimeConcept!.ssCodigo)).toContain(
            normalized(searchCase.term),
          );
        }

        if (searchCase.field === "name") {
          expect(normalized(runtimeConcept!.ssConcepto)).toContain(
            normalized(searchCase.term),
          );
        }
      }

      expect(
        new Set(visibleIds).size,
        "Filtered rows must remain distinguishable by stable concept ID",
      ).toBe(visibleIds.length);

      if (searchCase.field === "id") {
        await expect(
          conceptsPage.conceptPickerRow(searchCase.term),
        ).toBeVisible();
      }

      await expect
        .poll(() => conceptsPage.readConceptPickerPagerRange())
        .toEqual({
          start: 1,
          end: expectedVisibleCount,
          total: expectedMatches.length,
        });
      expect(conceptLookupRequestCount).toBe(1);
    }

    // 2. Search for a generated absent value ('asdsadasd'), then clear the search.
    await conceptsPage.searchConcept("asdsadasd");

    await expect(
      conceptsPage.conceptPickerPanel.getByText("Sin resultados", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      conceptsPage.conceptPickerPanel.getByText(
        "No hay conceptos para el filtro ingresado.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(conceptsPage.visibleConceptPickerRows()).toHaveCount(0);
    await expect(conceptsPage.conceptPickerPager).toHaveCount(0);

    await page
      .getByTestId("conceptos-nov-ad-concept-picker-search-clear-button")
      .click();

    await expect(conceptsPage.conceptPickerSearchInput).toHaveValue("");
    await expect(conceptsPage.visibleConceptPickerRows()).toHaveCount(
      initialIds.length,
    );
    await expect
      .poll(() => visibleConceptIds(conceptsPage))
      .toEqual(initialIds);
    expect(await conceptsPage.readConceptPickerPagerRange()).toEqual(
      initialPagerRange,
    );
    expect(conceptLookupRequestCount).toBe(1);
  });
});
