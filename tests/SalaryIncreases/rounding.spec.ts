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
  test("SI-015: Nearest-hundred payload and arithmetic", async ({ page }) => {
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

    await screen.percentageInput.fill("0");
    expect(context.salarioMinimoActual).toBeGreaterThan(0);
    const isOrdinary = (row: PreviewRow) => row.liquidaPorPuntos === "N" &&
      row.codigoSustituto == null && row.codigoCausante == null &&
      Number.isSafeInteger(row.ndSalarioMes) && row.ndSalarioMes > 0;
    const calculate = async (amount: number, rounded: boolean) => {
      await screen.increaseValueInput.fill(String(amount));
      await screen.roundToHundredCheckbox.setChecked(rounded);
      await expect(screen.roundToHundredCheckbox).toBeChecked({ checked: rounded });
      const pending = page.waitForResponse(response => response.request().method() === "POST" &&
        response.url().split("?")[0] === screen.apiBase + "w-aumento-sueldo/actions/calculate");
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      const payload = response.request().postDataJSON();
      expect(payload).toEqual({
        tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
        nivel: null, grado: null, nitInicial: null, nitFinal: null,
        salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: amount,
        decreto: 0, fechaDesde: year + "-09-10", fechaIngresoDesde: null,
        aproximarCien: rounded, aumentoPorPuntos: false,
      });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      const rows: PreviewRow[] = body.rows;
      expect(new Set(rows.map(row => row.kaNlTercero)).size).toBe(rows.length);
      const expectedById = new Map<number, number>();
      for (const row of rows.filter(isOrdinary)) {
        const raw = row.ndSalarioMes + amount;
        expect(Number.isSafeInteger(raw + 50)).toBe(true);
        const expected = rounded ? Math.floor((raw + 50) / 100) * 100 : raw;
        expect(row.nuevoSalario, "Independent salary formula for employee " + row.kaNlTercero).toBe(expected);
        if (rounded) expect(row.nuevoSalario % 100).toBe(0);
        expectedById.set(row.kaNlTercero, expected);
      }
      await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
      for (let offset = 0; offset < rows.length; offset += 25) {
        await screen.expectPreviewSalaries(rows.slice(offset, offset + 25).map(row => ({
          ...row, nuevoSalario: expectedById.get(row.kaNlTercero) ?? row.nuevoSalario,
        })));
        if (offset + 25 < rows.length) await screen.nextPageButton.click();
      }
      expect(saves, "Preview must never persist salary changes").toEqual([]);
      await screen.filterTab.click();
      return { rows, payload };
    };
    const baseline = await calculate(100, false);
    const target = baseline.rows.find(isOrdinary);
    test.skip(!target, "Shared QA has no ordinary employees with positive integer monthly salaries");
    if (!target) return;
    const identities = (rows: PreviewRow[]) => rows.map(row => ({
      id: row.kaNlTercero, salary: row.ndSalarioMes,
    })).sort((a, b) => a.id - b.id);
    const hundred = Math.floor(target.ndSalarioMes / 100) * 100 + 200;

    // 2. Calculate with rounding disabled, then enabled; only the rounding payload flag changes.
    // 3. Use runtime amounts just below, at, and above half-hundred, plus the opposite-parity tie.
    for (const delta of [49, 50, 51, 150]) {
      const raw = hundred + delta;
      const amount = raw - target.ndSalarioMes;
      const off = await calculate(amount, false);
      const on = await calculate(amount, true);
      expect(on.payload).toEqual({ ...off.payload, aproximarCien: true });
      expect(identities(off.rows)).toEqual(identities(baseline.rows));
      expect(identities(on.rows)).toEqual(identities(off.rows));
      expect(off.rows.find(row => row.kaNlTercero === target.kaNlTercero)!.nuevoSalario).toBe(raw);
      // Explicit boundary expectations establish positive half-up, including even and odd hundreds.
      const expected = hundred + (delta === 49 ? 0 : delta === 150 ? 200 : 100);
      expect(on.rows.find(row => row.kaNlTercero === target.kaNlTercero)!.nuevoSalario).toBe(expected);
    }
    expect(saves).toEqual([]);
  });
});
