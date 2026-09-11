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
  test("SI-013: Fixed amount salary preview", async ({ page }) => {
    test.setTimeout(60_000);
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

    // 2. Calculate a positive fixed amount with percentage zero and verify the ordinary salary formula without saving.
    const amount = 100;
    await screen.increaseValueInput.fill(String(amount));
    await screen.percentageInput.fill("0");
    const pending = page.waitForResponse(response => response.request().method() === "POST" &&
      response.url().split("?")[0] === screen.apiBase + "w-aumento-sueldo/actions/calculate");
    await screen.calculateButton.click();
    const response = await pending;
    expect(await response.finished()).toBeNull();
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: amount,
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
      Number.isFinite(row.ndSalarioMes));
    test.skip(!ordinary.length, "Shared QA has no ordinary non-points employees with a numeric monthly salary");
    for (const row of ordinary) {
      expect(row.nuevoSalario, "Fixed increase for employee " + row.kaNlTercero)
        .toBe(row.ndSalarioMes + amount);
    }

    // 3. Compare every visible row by employee ID, including all descriptive fields, ISO hire date and formatted salaries; verify tab and totals.
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    const visible = rows.slice(0, 25);
    await screen.expectPreviewSalaries(visible);
    const byId = new Map(rows.map(row => [String(row.kaNlTercero), row]));
    expect(byId.size).toBe(rows.length);
    const fields = ["nNit", "scNombre", "scDetalleCargo", "ssSeccion", "scUnidadDePago",
      "sDescripcion", "tipoPension", "tipoCotizante", "ddIngreso"] as const;
    const format = (value: number) => value.toLocaleString("es-CO", { maximumFractionDigits: 0 });
    for (const locator of await screen.visibleRows().all()) {
      const id = (await locator.getAttribute("data-testid"))!.split("--")[1]!;
      const row = byId.get(id);
      expect(row, "Visible employee must exist in the calculate response").toBeDefined();
      if (!row) throw new Error("Unexpected preview employee " + id);
      await expect(locator.locator("td")).toHaveText([
        "", ...fields.map(field => String(row[field] ?? "-")),
        format(row.ndSalarioMes), format(row.nuevoSalario),
      ]);
    }
    await expect(page.getByText("1-" + visible.length + " de " + rows.length, { exact: true })).toBeVisible();
    expect(saves, "Preview must never persist salary changes").toEqual([]);
  });
});
