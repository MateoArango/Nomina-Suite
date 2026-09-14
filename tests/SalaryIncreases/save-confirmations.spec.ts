import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Save guards, confirmations and persistence - Mutation", () => {
  test("SI-022: Save without selection and final cancellation", async ({ page }) => {
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

    // 1. Start with a fresh authenticated context, settle startup, calculate non-empty results, and explicitly deselect all employees.
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

    test.skip(rows.length === 0, "Shared QA requires at least one calculated employee for save-selection guards");
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await screen.pageSizeButton(25).click();
    const firstPage = rows.slice(0, 25);
    await expect.poll(() => screen.visibleRows().evaluateAll(elements =>
      elements.map(element => element.getAttribute("data-testid")))).toEqual(
      firstPage.map(row => "aumento-sueldo-increases-row--" + row.kaNlTercero));
    const expectSelection = async (selectedIds: number[]) => {
      await expect.poll(() => screen.visibleRows().locator('input[type="checkbox"]')
        .evaluateAll(elements => elements.map(element => (element as HTMLInputElement).checked)))
        .toEqual(firstPage.map(row => selectedIds.includes(row.kaNlTercero)));
    };
    await expectSelection([]);
    await screen.selectAllButton.click();
    await expectSelection(firstPage.map(row => row.kaNlTercero));
    await screen.selectAllButton.click();
    await expectSelection([]);

    // 2. Click Save and acknowledge the missing-selection dialog.
    await screen.saveButton.click();
    const missingSelection = screen.dialog("missing-selection");
    await expect(missingSelection).toBeVisible();
    await expect(missingSelection.locator(".swal2-html-container")).toHaveText(
      "Debe seleccionar los empleados a los cuales va a realizar el aumento salarial.");
    await expect(screen.dialog("positions-confirmation")).toBeHidden();
    await expect(screen.dialog("save-confirmation")).toBeHidden();
    expect(saves).toEqual([]);
    await screen.dialogButton("missing-selection", "confirm").click();
    await expect(missingSelection).toBeHidden();

    // 3. Select exactly one runtime employee on the first page, click Save, and decline position updates.
    const employee = firstPage[0]!;
    await screen.rowCheckbox(employee.kaNlTercero).check();
    await expect(screen.rowCheckbox(employee.kaNlTercero)).toBeChecked();
    await expectSelection([employee.kaNlTercero]);
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    expect(saves).toEqual([]);
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(screen.dialog("positions-confirmation")).toBeHidden();
    const confirmation = screen.dialog("save-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator(".swal2-html-container")).toHaveText(
      "El Proceso se realizó correctamente el numero de registros afectados fue de : 1 ¿Desea aceptar los cambios realizados?");
    expect(saves).toEqual([]);

    // 4. Cancel the employee save confirmation using its visible negative action, without confirming.
    await expect(screen.dialogButton("save-confirmation", "deny")).toBeVisible();
    await screen.dialogButton("save-confirmation", "deny").click();
    await expect(confirmation).toBeHidden();
    await expect(screen.saveButton).toBeEnabled();
    await expectSelection([employee.kaNlTercero]);
    expect(calculations).toHaveLength(1);
    expect(saves).toEqual([]);
  });
});
