import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P1 - Grid, search, selection and undo", () => {
  test("SI-019: Client-side search and clearing", async ({ page }) => {
    test.setTimeout(180_000);
    const screen = new SalaryIncreasesPage(page);
    const calculatePath = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const savePath = screen.apiBase + "w-aumento-sueldo/actions/grabar";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const path = request.url().split("?")[0];
      if (path === calculatePath) calculations.push(request.url());
      if (path === savePath) saves.push(request.url());
    });

    // 1. Start with a fresh authenticated context, settle startup, and calculate more than one page with no search or column filter.
    const paths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = paths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" &&
      response.url().split("?")[0] === screen.apiBase + path));
    await screen.goto();
    const responses = await Promise.all(startup);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const context = await responses[0]!.json();
    const year = new URL(responses[0]!.url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    await screen.startDateInput.fill("11/09/" + year);
    await screen.increaseValueInput.fill("100");
    await screen.percentageInput.fill("0");
    const pending = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculatePath);
    await screen.calculateButton.click();
    const response = await pending;
    expect(await response.finished()).toBeNull();
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: year + "-09-11", fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const body = await response.json();
    expect(body.context).toEqual(context);
    expect(Array.isArray(body.rows)).toBe(true);
    const rows: Array<{ kaNlTercero: number; nNit: number; scNombre: string; scDetalleCargo: string | null; ndSalarioMes: number; nuevoSalario: number }> = body.rows;
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
    test.skip(rows.length <= 25,
      "Shared QA requires more than 25 calculated employees to verify search pagination");
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");


    const matches = (query: string) => rows.filter(row =>
      [row.nNit, row.scNombre, row.scDetalleCargo].some(value =>
        String(value ?? "").toLowerCase().includes(query.toLowerCase())));
    const name = rows.flatMap(row => row.scNombre.split(/\s+/))
      .find(word => word.length >= 4 && matches(word).length < rows.length);
    const position = rows.flatMap(row => (row.scDetalleCargo ?? "").split(/\s+/))
      .find(word => word.length >= 4 && matches(word).length > 25 && matches(word).length < rows.length);
    const accent = rows.flatMap(row => row.scNombre.split(/\s+/))
      .find(word => word.normalize("NFD").replace(/\p{Diacritic}/gu, "") !== word);
    test.skip(!name || !position || !accent,
      "Shared QA requires a name fragment, a position fragment spanning pages, and an accented name");
    const plainAccent = accent!.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    expect(matches(accent!).map(row => row.kaNlTercero))
      .not.toEqual(matches(plainAccent).map(row => row.kaNlTercero));
    const expectPage = async (expected: typeof rows, index: number) => {
      await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
        elements.map(element => element.getAttribute("data-testid")))).toEqual(
        expected.slice(index * 25, (index + 1) * 25)
          .map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero));
      if (index === 0) await expect(screen.previousPageButton).toBeDisabled();
      else await expect(screen.previousPageButton).toBeEnabled();
      if ((index + 1) * 25 >= expected.length) await expect(screen.nextPageButton).toBeDisabled();
      else await expect(screen.nextPageButton).toBeEnabled();
    };
    const expectAllPages = async (expected: typeof rows) => {
      await expectPage(expected, 0);
      for (let index = 1; index < Math.ceil(expected.length / 25); index++) {
        await screen.nextPageButton.click();
        await expectPage(expected, index);
      }
      // Return to the first page: Clear preserves a valid current page.
      for (let index = Math.ceil(expected.length / 25) - 2; index >= 0; index--) {
        await screen.previousPageButton.click();
        await expectPage(expected, index);
      }
      expect(calculations).toHaveLength(1);
      expect(saves).toEqual([]);
    };
    await screen.pageSizeButton(25).click();
    await expectPage(rows, 0);
    await screen.nextPageButton.click();
    await expectPage(rows, 1);

    // 2. Open search and independently enter document, name and position fragments, including case and accent variants.
    await screen.searchOpenButton.click();
    for (const query of [
      String(rows[0]!.nNit), name!.toUpperCase(), name!.toLowerCase(),
      position!.toUpperCase(), position!.toLowerCase(),
      accent!.toLowerCase(), plainAccent.toLowerCase(),
    ]) {
      await test.step("Search for " + query, async () => {
        if (await screen.searchInput.inputValue()) {
          await screen.searchClearButton.click();
          await expect(screen.searchInput).toHaveValue("");
          await expectPage(rows, 0);
        }
        await screen.searchInput.fill(query);
        await expectAllPages(matches(query));
      });
    }

    // 3. Enter a guaranteed non-match, then clear and close search to restore the calculated set and valid pager.
    const nonMatch = "__SI019_NO_MATCH__";
    expect(matches(nonMatch)).toEqual([]);
    await screen.searchInput.fill(nonMatch);
    await expectAllPages([]);
    await screen.searchClearButton.click();
    await expect(screen.searchInput).toHaveValue("");
    await expectPage(rows, 0);
    await screen.searchCloseButton.click();
    await expect(screen.searchInput).toBeHidden();
    await expect(screen.searchOpenButton).toBeVisible();
    await expectAllPages(rows);
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
