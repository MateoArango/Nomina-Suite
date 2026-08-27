// spec: specs/conceptos-novedades-administrativas-plan.md
// seed: tests/administrative-update-concepts/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { AdministrativeUpdateConceptsPage } from "../../pages/AdministrativeUpdateConcepts.page";

const apiBase =
  "https://nomina-qa-api.adacsc.co/api/v1/w-conceptos-nov-ad";
const rowsUrl = `${apiBase}/rows`;
const conceptLookupUrl = `${apiBase}/lookups/conceptos`;
const noveltyCatalog = [
  { code: "cmp", label: "Compensatorios" },
  { code: "per", label: "Permisos" },
  { code: "lrm", label: "Licencias Remuneradas" },
  { code: "vac", label: "Vacaciones" },
  { code: "lcn", label: "Cuidado de la Ninez" },
] as const;

test.describe("Runtime grid and local state", () => {
  test("CNA-003: Novelty options use the exact client-side catalog", async ({
    page,
  }) => {
    const conceptsPage = new AdministrativeUpdateConceptsPage(page);
    const mutationRequests: string[] = [];
    const noveltyLookupRequests: string[] = [];

    page.on("request", request => {
      const requestUrl = request.url();

      if (
        requestUrl.startsWith(apiBase) &&
        request.method() !== "GET"
      ) {
        mutationRequests.push(`${request.method()} ${requestUrl}`);
      }

      if (
        request.method() === "GET" &&
        requestUrl.startsWith(`${apiBase}/lookups/`) &&
        requestUrl !== conceptLookupUrl
      ) {
        noveltyLookupRequests.push(requestUrl);
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

    const initialRows = await initialRowsResponse.json();
    expect(Array.isArray(initialRows)).toBe(true);

    // 1. Open the novelty selector on the empty working row while observing requests to /w-conceptos-nov-ad.
    const workingRow = conceptsPage.emptyWorkingRow();
    await expect(workingRow).toHaveCount(1);
    await workingRow.getByRole("combobox").click();

    const options = page.getByRole("listbox").getByRole("option");
    await expect(options).toHaveText(noveltyCatalog.map(option => option.label));
    expect(noveltyLookupRequests).toEqual([]);
    expect(mutationRequests).toEqual([]);

    // 2. Choose each option in an isolated local state, resetting with Recargar between cases.
    for (const [index, option] of noveltyCatalog.entries()) {
      if (index > 0) {
        await conceptsPage.emptyWorkingRow().getByRole("combobox").click();
      }

      await page
        .getByTestId(`conceptos-nov-ad-novelty-option-${option.code}`)
        .click();
      await expect(
        conceptsPage.emptyWorkingRow().getByRole("combobox"),
      ).toHaveText(option.label);

      expect(noveltyLookupRequests).toEqual([]);
      expect(mutationRequests).toEqual([]);

      const refreshedRowsResponsePromise = page.waitForResponse(
        response =>
          response.url() === rowsUrl && response.request().method() === "GET",
      );
      await conceptsPage.reloadButton.click();

      const refreshedRowsResponse = await refreshedRowsResponsePromise;
      expect(refreshedRowsResponse.ok()).toBe(true);

      const refreshedRows = await refreshedRowsResponse.json();
      expect(Array.isArray(refreshedRows)).toBe(true);

      await expect(conceptsPage.emptyWorkingRow()).toHaveCount(1);
      await expect(
        conceptsPage.emptyWorkingRow().getByRole("combobox"),
      ).toHaveText("");
    }

    expect(noveltyLookupRequests).toEqual([]);
    expect(mutationRequests).toEqual([]);
  });
});
