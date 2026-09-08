import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-006: Context-dependent unsupported year", async ({ page }) => {
    const salary = new SalaryIncreasesPage(page);
    const calculateUrl = salary.apiBase + "w-aumento-sueldo/actions/calculate";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations.push(url);
      if (url === salary.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start fresh and discover supported and unsupported years from current context responses.
    const paths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = paths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" && response.url().split("?")[0] === salary.apiBase + path));
    await salary.goto();
    const responses = await Promise.all(startup);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const contextUrl = new URL(responses[0].url());
    const runtimeYear = Number(contextUrl.searchParams.get("year"));
    expect(Number.isInteger(runtimeYear) && runtimeYear > 10 && runtimeYear < 9990).toBe(true);
    type Context = { salarioMinimoActual: number | null; dobleMesada: boolean; dobleMesadaFlag: string };
    let supported: { year: number; context: Context } | undefined;
    let unsupported: { year: number; context: Context } | undefined;
    // Reuse the authenticated context request without logging or persisting its headers.
    const headers = await responses[0].request().allHeaders();
    for (const offset of [0, 1, -1, 5, -5, 10, -10]) {
      const year = runtimeYear + offset;
      let context: Context;
      if (offset === 0) {
        context = await responses[0].json();
      } else {
        contextUrl.searchParams.set("year", String(year));
        const response = await page.request.get(contextUrl.toString(), { headers });
        expect(response.status(), "Context discovery for year " + year).toBe(200);
        context = await response.json();
        await response.dispose();
      }
      if (context.salarioMinimoActual === null) unsupported ??= { year, context };
      else {
        expect(context.salarioMinimoActual).toBeGreaterThan(0);
        supported ??= { year, context };
      }
      if (supported && unsupported) break;
    }
    expect(supported, "A candidate year must have configured minimum-wage context").toBeDefined();
    expect(unsupported, "A candidate year must have missing minimum-wage context").toBeDefined();
    if (!supported || !unsupported) throw new Error("Required live year contexts are unavailable");
    await expect(salary.calculateButton).toBeEnabled();
    expect(calculations).toHaveLength(0);

    // 2. Calculate with the unsupported year and verify the configuration error and empty preview.
    const unsupportedDate = unsupported.year + "-01-01";
    await salary.startDateInput.fill(unsupportedDate);
    await salary.increaseValueInput.fill("100");
    await salary.percentageInput.fill("0");
    const invalidPromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
    await salary.calculateButton.click();
    const invalid = await invalidPromise;
    expect(await invalid.finished()).toBeNull();
    expect(invalid.status()).toBe(400);
    const payload = invalid.request().postDataJSON();
    expect(payload).toEqual({
      tipoTercero: null, unidad: null, profesion: null, rango: null,
      fuerza: null, nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: unsupportedDate, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    });
    const error = await invalid.json();
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.message).toBe("Debe definir el salario mínimo para el año actual");
    await salary.expectApiErrorMessage(error.message);
    expect(calculations).toHaveLength(1);
    await salary.dialogButton("api-error", "confirm").click();
    await expect(salary.dialog("api-error")).toBeHidden();
    await salary.openIncreases();
    await expect(salary.visibleRows()).toHaveCount(0);
    await expect(salary.exportButton).toBeDisabled();
    await expect(salary.saveButton).toBeDisabled();

    // 3. Correct only the year and verify successful recovery against the supported context.
    await salary.openFilters();
    const supportedDate = supported.year + "-01-01";
    await salary.startDateInput.fill(supportedDate);
    const validPromise = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
    await salary.calculateButton.click();
    const valid = await validPromise;
    expect(await valid.finished()).toBeNull();
    expect(valid.status()).toBe(200);
    expect(valid.request().postDataJSON()).toEqual({ ...payload, fechaDesde: supportedDate });
    const body = await valid.json();
    expect(body.context).toEqual(supported.context);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.rows.length, "The live dataset must contain matching employees").toBeGreaterThan(0);
    await expect(salary.dialog("api-error")).toBeHidden();
    await expect(salary.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(salary.table).toBeVisible();
    await salary.expectPreviewSalaries(body.rows.slice(0, 25));
    await expect(salary.exportButton).toBeEnabled();
    expect(calculations).toHaveLength(2);
    expect(saves, "Year validation and recovery must never save salaries").toEqual([]);
  });
});
