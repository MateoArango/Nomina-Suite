import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type PreviewRow = {
  kaNlTercero: number;
  nNit: number;
  scNombre: string;
  scDetalleCargo: string | null;
  ssSeccion: string | null;
  scUnidadDePago: string | null;
  sDescripcion: string | null;
  tipoPension: string | null;
  tipoCotizante: string | null;
  ddIngreso: string | null;
  ndSalarioMes: number;
  nuevoSalario: number;
  liquidaPorPuntos: string | null;
  codigoSustituto: number | null;
  codigoCausante: number | null;
};

test.describe("P0 - Salary calculation and API-to-grid mapping", () => {
  test("SI-014: Percentage salary preview", async ({ page }) => {
    test.setTimeout(90_000);
    const screen = new SalaryIncreasesPage(page);
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" &&
          request.url().split("?")[0] === screen.apiBase + "w-aumento-sueldo/actions/grabar") {
        saves.push(request.url());
      }
    });

    // 1. Start with a fresh authenticated context, settle startup, and use a supported date with rounding and points off.
    const paths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startup = paths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" && response.url().split("?")[0] === screen.apiBase + path));
    await screen.goto();
    const responses = await Promise.all(startup);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const context = await responses[0]!.json();
    const year = new URL(responses[0]!.url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    await screen.startDateInput.fill("10/09/" + year);
    await screen.roundToHundredCheckbox.uncheck();
    await screen.increaseByPointsCheckbox.uncheck();
    await expect(screen.roundToHundredCheckbox).not.toBeChecked();
    await expect(screen.increaseByPointsCheckbox).not.toBeChecked();

    await screen.increaseValueInput.fill("0");
    expect(context.salarioMinimoActual, "Current year must have a configured minimum salary").toBeGreaterThan(0);
    const coverage = { below: false, above: false, tieEven: false, tieOdd: false };

    // 2. Calculate with a positive percentage and independently verify API integer precision.
    // 3. Exercise a fractional percentage, covering both sides of .5 and exact ties separately.
    for (const percentage of [5, 1.02]) {
      await screen.percentageInput.fill(String(percentage));
      await expect(screen.percentageInput).toHaveValue(String(percentage));
      const pending = page.waitForResponse(response => response.request().method() === "POST" &&
        response.url().split("?")[0] === screen.apiBase + "w-aumento-sueldo/actions/calculate");
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({
        tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
        nivel: null, grado: null, nitInicial: null, nitFinal: null,
        salarioInicial: null, salarioFinal: null, porcentaje: percentage, valor: 0,
        decreto: 0, fechaDesde: year + "-09-10", fechaIngresoDesde: null,
        aproximarCien: false, aumentoPorPuntos: false,
      });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      const rows: PreviewRow[] = body.rows;
      expect(saves).toEqual([]);
      const ordinary = rows.filter(row => row.liquidaPorPuntos === "N" &&
        row.codigoSustituto == null && row.codigoCausante == null &&
        Number.isSafeInteger(row.ndSalarioMes) && row.ndSalarioMes > 0);
      test.skip(!ordinary.length, "Shared QA has no ordinary employees with positive integer monthly salaries");
      const expectedById = new Map<number, number>();
      for (const row of ordinary) {
        // Integer hundredths of a percent avoid floating-point ambiguity at exact .5 ties.
        const numerator = row.ndSalarioMes * (10_000 + Math.round(percentage * 100));
        expect(Number.isSafeInteger(numerator)).toBe(true);
        const whole = Math.floor(numerator / 10_000);
        const remainder = numerator % 10_000;
        const expected = whole + (remainder >= 5_000 ? 1 : 0);
        expect(Number.isInteger(row.nuevoSalario), "API preview must already be an integer").toBe(true);
        expect(row.nuevoSalario, "Percentage formula for employee " + row.kaNlTercero).toBe(expected);
        expectedById.set(row.kaNlTercero, expected);
        if (percentage === 1.02) {
          coverage.below ||= remainder > 0 && remainder < 5_000;
          coverage.above ||= remainder > 5_000;
        }
        if (remainder === 5_000) {
          coverage.tieEven ||= whole % 2 === 0;
          coverage.tieOdd ||= whole % 2 === 1;
        }
      }
      await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
      expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
      for (let offset = 0; offset < rows.length; offset += 25) {
        const visible = rows.slice(offset, offset + 25).map(row => ({
          ...row, nuevoSalario: expectedById.get(row.kaNlTercero) ?? row.nuevoSalario,
        }));
        await screen.expectPreviewSalaries(visible);
        if (offset + 25 < rows.length) await screen.nextPageButton.click();
      }
      await screen.filterTab.click();
    }
    expect(saves, "Preview must never persist salary changes").toEqual([]);
    const missing = Object.entries(coverage).filter(([, found]) => !found).map(([name]) => name);
    test.skip(missing.length > 0, "Shared QA lacks runtime rounding prerequisites: " + missing.join(", "));
  });
});
