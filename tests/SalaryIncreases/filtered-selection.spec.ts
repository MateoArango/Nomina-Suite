import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P1 - Grid, search, selection and undo", () => {
  test("SI-021: Column-filtered select-all targets the full calculated list", async ({ page }) => {
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

    // 1. Start with a fresh authenticated context, settle startup, calculate at least two pages, and filter to one to three runtime employees.
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
    await screen.startDateInput.fill("14/09/" + year);
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
      decreto: 0, fechaDesde: year + "-09-14", fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const body = await response.json();
    expect(body.context).toEqual(context);
    expect(Array.isArray(body.rows)).toBe(true);
    const rows: Array<{ kaNlTercero: number; nNit: number; scNombre: string; scDetalleCargo: string | null; ndSalarioMes: number; nuevoSalario: number }> = body.rows;
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    test.skip(rows.length <= 25, "Shared QA requires more than 25 calculated employees for cross-page selection");
    const uniqueRows = rows.filter(row => Number.isSafeInteger(row.nNit) &&
      rows.filter(other => other.nNit === row.nNit).length === 1);
    test.skip(uniqueRows.length === 0,
      "Shared QA requires a unique numeric Identification to filter to one to three employees");
    const chosen = uniqueRows.slice(0, 3);
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.pageSizeButton(25).click();

    const expectRows = async (expected: typeof rows, selected: boolean) => {
      await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
        elements.map(element => element.getAttribute("data-testid")))).toEqual(
        expected.map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero));
      await expect.poll(() => screen.visibleRows().locator('input[type="checkbox"]')
        .evaluateAll(elements => elements.map(element => (element as HTMLInputElement).checked)))
        .toEqual(expected.map(() => selected));
    };
    const applyFilter = async (selected: boolean) => {
      await screen.columnFilterButton("nNit").click();
      await screen.columnSelectAllCheckbox("nNit").uncheck();
      for (const row of chosen) {
        await screen.columnOptionCheckbox("nNit", row.nNit).check();
        await expect(screen.columnOptionCheckbox("nNit", row.nNit)).toBeChecked();
      }
      await screen.columnFilterButton("nNit").click();
      await expect(screen.columnFilterMenu("nNit")).toBeHidden();
      await expectRows(chosen, selected);
      await expect(screen.previousPageButton).toBeDisabled();
      await expect(screen.nextPageButton).toBeDisabled();
    };
    const clearFilter = async () => {
      await screen.columnFilterButton("nNit").click();
      await screen.columnClearFilterButton("nNit").click();
      await screen.columnFilterButton("nNit").click();
      await expect(screen.columnFilterMenu("nNit")).toBeHidden();
    };
    await expectRows(rows.slice(0, 25), false);
    await applyFilter(false);

    // 2. Select all while filtered, then open Save and verify the full calculated employee count.
    await screen.selectAllButton.click();
    await expectRows(chosen, true);
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    await screen.dialogButton("positions-confirmation", "deny").click();
    const confirmation = screen.dialog("save-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator(".swal2-html-container")).toHaveText(
      "El Proceso se realizó correctamente el numero de registros afectados fue de : " +
      rows.length + " ¿Desea aceptar los cambios realizados?");
    expect(saves).toEqual([]);

    // 3. Cancel without confirming, clear the filter, and verify selection on the first page.
    await screen.dialogButton("save-confirmation", "deny").click();
    await expect(confirmation).toBeHidden();
    await clearFilter();
    await expectRows(rows.slice(0, 25), true);

    // 4. Reapply the filter, deselect all, clear the filter, and inspect the first page.
    await applyFilter(true);
    await screen.selectAllButton.click();
    await expectRows(chosen, false);
    await clearFilter();
    await expectRows(rows.slice(0, 25), false);
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
