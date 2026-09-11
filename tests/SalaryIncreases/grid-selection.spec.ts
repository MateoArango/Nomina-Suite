import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P1 - Grid, search, selection and undo", () => {
  test("SI-018: Single selection and cross-page select-all", async ({ page }) => {
    test.setTimeout(120_000);
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
    const rows: Array<{ kaNlTercero: number; ndSalarioMes: number; nuevoSalario: number }> = body.rows;
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
    test.skip(rows.length <= 25,
      "Shared QA requires more than 25 calculated employees to verify cross-page selection");
    expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");

    const allRows = screen.table.locator('tr[data-testid^="aumento-sueldo-increases-row--"]');
    const identities = rows.map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero);
    const expectSelection = async (expected: string[]) => {
      await expect(allRows).toHaveCount(rows.length);
      await expect(allRows.locator('input[type="checkbox"]')).toHaveCount(rows.length);
      await expect.poll(() => allRows.evaluateAll(elements => elements
        .filter(element => element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked)
        .map(element => element.getAttribute("data-testid")))).toEqual(expected);
      expect(calculations).toHaveLength(1);
      expect(saves).toEqual([]);
    };
    const expectPage = async (index: number) => {
      await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
        elements.map(element => element.getAttribute("data-testid"))))
        .toEqual(identities.slice(index * 25, (index + 1) * 25));
    };
    await screen.pageSizeButton(25).click();
    await expectPage(0);
    await expectSelection([]);

    // 2. Select one row using rowCheckbox(employeeId), navigate away and back.
    const employeeId = rows[0]!.kaNlTercero;
    await screen.rowCheckbox(employeeId).check();
    await expectSelection([identities[0]!]);
    await screen.nextPageButton.click();
    await expectPage(1);
    await expect(screen.row(employeeId)).toBeHidden();
    await expectSelection([identities[0]!]);
    await screen.previousPageButton.click();
    await expectPage(0);
    await expect(screen.rowCheckbox(employeeId)).toBeChecked();
    await expectSelection([identities[0]!]);

    // 3. Toggle Select/Deselect all and inspect later and final pages; toggle again.
    await screen.selectAllButton.click();
    await expectSelection(identities);
    const lastPage = Math.ceil(rows.length / 25) - 1;
    for (let index = 1; index <= lastPage; index++) {
      await screen.nextPageButton.click();
      await expectPage(index);
      await expect(screen.visibleRows().locator('input[type="checkbox"]:checked'))
        .toHaveCount(Math.min(25, rows.length - index * 25));
      await expectSelection(identities);
    }
    await expect(screen.nextPageButton).toBeDisabled();
    await screen.selectAllButton.click();
    await expectSelection([]);
    for (let index = lastPage - 1; index >= 0; index--) {
      await screen.previousPageButton.click();
      await expectPage(index);
      await expect(screen.visibleRows().locator('input[type="checkbox"]:checked')).toHaveCount(0);
      await expectSelection([]);
    }
    await expect(screen.previousPageButton).toBeDisabled();
    await expect(screen.rowCheckbox(employeeId)).not.toBeChecked();
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
