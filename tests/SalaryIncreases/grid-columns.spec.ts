import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P1 - Grid, search, selection and undo", () => {
  test("SI-020: Identification column sorting and value filtering", async ({ page }) => {
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

    // 1. Start with a fresh authenticated context, settle startup, and calculate a runtime set with at least three numeric Identification values.
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
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    test.skip(rows.some(row => !Number.isSafeInteger(row.nNit)),
      "Shared QA requires safe numeric Identification values for numeric sorting");
    const values = [...new Set(rows.map(row => row.nNit))].sort((a, b) => a - b);
    test.skip(values.length < 3,
      "Shared QA requires at least three distinct numeric Identification values");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(screen.searchInput).toBeHidden();
    await screen.pageSizeButton(25).click();

    const expectPage = async (expected: typeof rows, index: number) => {
      const slice = expected.slice(index * 25, (index + 1) * 25);
      await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
        elements.map(element => element.getAttribute("data-testid")))).toEqual(
        slice.map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero));
      await expect(screen.visibleRows().locator("td:nth-child(2)")).toHaveText(
        slice.map(row => String(row.nNit)));
      await expect.poll(() => screen.visibleRows().locator('input[type="checkbox"]')
        .evaluateAll(elements => elements.map(element => (element as HTMLInputElement).checked)))
        .toEqual(slice.map(() => false));
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
      for (let index = Math.ceil(expected.length / 25) - 2; index >= 0; index--) {
        await screen.previousPageButton.click();
        await expectPage(expected, index);
      }
      expect(calculations).toHaveLength(1);
      expect(saves).toEqual([]);
    };
    await expectAllPages(rows);

    // 2. Independently verify ascending and descending numeric Identification sorting across all unfiltered result pages.
    for (const direction of ["asc", "desc"] as const) {
      await test.step("Identification numeric sort: " + direction, async () => {
        await screen.columnFilterButton("nNit").click();
        await expect(screen.columnFilterMenu("nNit")).toBeVisible();
        await expect(screen.columnSelectAllCheckbox("nNit")).toBeChecked();
        await screen.columnSortButton("nNit", direction).click();
        if (await screen.columnFilterMenu("nNit").isVisible()) await screen.columnFilterButton("nNit").click();
        await expect(screen.columnFilterMenu("nNit")).toBeHidden();
        const sorted = [...rows].sort((a, b) =>
          direction === "asc" ? a.nNit - b.nNit : b.nNit - a.nNit);
        await expectAllPages(sorted);
      });
    }

    // 3. Uncheck all column values, choose runtime IDs while excluding another, and verify the complete filtered identity set.
    const chosen = values.length === 3
      ? [values[0]!, values[2]!]
      : [values[0]!, values[Math.floor(values.length / 2)]!, values[values.length - 1]!];
    const excluded = values.find(value => !chosen.includes(value))!;
    await screen.columnFilterButton("nNit").click();
    await screen.columnSelectAllCheckbox("nNit").uncheck();
    await expect(screen.columnSelectAllCheckbox("nNit")).not.toBeChecked();
    for (const value of chosen) {
      await expect(screen.columnOptionCheckbox("nNit", value)).not.toBeChecked();
      await screen.columnOptionCheckbox("nNit", value).check();
      await expect(screen.columnOptionCheckbox("nNit", value)).toBeChecked();
    }
    await expect(screen.columnOptionCheckbox("nNit", excluded)).not.toBeChecked();
    await screen.columnFilterButton("nNit").click();
    await expect(screen.columnFilterMenu("nNit")).toBeHidden();

    const filtered = rows.filter(row => chosen.includes(row.nNit));
    const actualIds: number[] = [];
    for (let index = 0; index < Math.ceil(filtered.length / 25); index++) {
      const count = Math.min(25, filtered.length - index * 25);
      await expect(screen.visibleRows()).toHaveCount(count);
      const ids = await screen.visibleRows().evaluateAll(elements =>
        elements.map(element => Number(element.getAttribute("data-testid")!.split("--")[1])));
      actualIds.push(...ids);
      for (const employeeId of ids) {
        const employee = filtered.find(row => row.kaNlTercero === employeeId);
        expect(employee, "Filtered employee must belong to a chosen Identification").toBeDefined();
        await expect(screen.row(employeeId).locator("td:nth-child(2)")).toHaveText(String(employee!.nNit));
        await expect(screen.rowCheckbox(employeeId)).not.toBeChecked();
      }
      if (index === 0) await expect(screen.previousPageButton).toBeDisabled();
      if ((index + 1) * 25 < filtered.length) {
        await expect(screen.nextPageButton).toBeEnabled();
        await screen.nextPageButton.click();
      } else {
        await expect(screen.nextPageButton).toBeDisabled();
      }
    }
    expect(actualIds.sort((a, b) => a - b)).toEqual(
      filtered.map(row => row.kaNlTercero).sort((a, b) => a - b));
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
