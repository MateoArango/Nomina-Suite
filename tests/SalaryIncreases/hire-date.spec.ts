import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type Preview = {
  kaNlTercero: number;
  ddIngreso: string;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P1 - Filter controls and employee eligibility", () => {
  test("SI-010: Hire-date lower bound and equality", async ({ page }) => {
    test.setTimeout(60_000);
    const screen = new SalaryIncreasesPage(page);
    const calculateUrl = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    let calculations = 0;
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations++;
      if (url === screen.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start fresh, settle startup traffic, and calculate a baseline with a runtime hire-date threshold.
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
      expect(response.status()).toBe(200);
      expect(await response.finished()).toBeNull();
    }
    const context = await responses[0].json();
    const year = new URL(responses[0].url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    const date = year + "-09-10";
    const displayDate = (iso: string) => iso.split("-").reverse().join("/");
    await screen.startDateInput.fill(displayDate(date));
    await expect(screen.startDateInput).toHaveValue(displayDate(date));
    await screen.percentageInput.fill("0");
    await screen.increaseValueInput.fill("100");
    const basePayload = {
      tipoTercero: null, unidad: null, profesion: null, rango: null,
      fuerza: null, nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const identities = (rows: Preview[]) => rows.map(row => row.kaNlTercero).sort((a, b) => a - b);
    const calculate = async (bound: string | null): Promise<Preview[]> => {
      const before = calculations;
      await screen.openFilters();
      const displayedBound = bound === null ? "" : displayDate(bound);
      await screen.hireDateInput.fill(displayedBound);
      await expect(screen.hireDateInput).toHaveValue(displayedBound);
      expect(calculations, "Changing the hire date must not calculate automatically").toBe(before);
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ ...basePayload, fechaIngresoDesde: bound });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      const rows: Preview[] = body.rows;
      expect(new Set(identities(rows)).size).toBe(rows.length);
      for (const row of rows) expect(row.ddIngreso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (rows.length) {
        await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
        await screen.expectPreviewSalaries(rows.slice(0, 25));
        await expect(screen.exportButton).toBeEnabled();
      } else {
        await expect(screen.dialog("empty-results")).toBeVisible();
        await screen.dialogButton("empty-results", "confirm").click();
        await expect(screen.dialog("empty-results")).toBeHidden();
        await screen.openIncreases();
        await expect(screen.visibleRows()).toHaveCount(0);
        await expect(screen.exportButton).toBeDisabled();
        await expect(screen.saveButton).toBeDisabled();
      }
      expect(calculations).toBe(before + 1);
      expect(saves).toEqual([]);
      return rows;
    };
    const baseline = await calculate(null);
    const dates = [...new Set(baseline.map(row => row.ddIngreso))].sort();
    test.skip(dates.length < 3, "Shared QA requires eligible employees on at least three distinct hire dates");
    const threshold = dates[Math.floor(dates.length / 2)]!;
    const before = baseline.filter(row => row.ddIngreso < threshold);
    const equal = baseline.filter(row => row.ddIngreso === threshold);
    const after = baseline.filter(row => row.ddIngreso > threshold);
    expect(before.length).toBeGreaterThan(0);
    expect(equal.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);

    // 2. Apply the lower bound with identical remaining inputs and prove exclusion, inclusion, and equality.
    const filtered = await calculate(threshold);
    expect(identities(filtered)).toEqual(identities([...equal, ...after]));
    expect(filtered.every(row => row.ddIngreso >= threshold)).toBe(true);
    expect(identities(filtered.filter(row => row.ddIngreso === threshold))).toEqual(identities(equal));
    expect(identities(filtered.filter(row => row.ddIngreso > threshold))).toEqual(identities(after));
    const filteredIds = new Set(identities(filtered));
    expect(before.every(row => !filteredIds.has(row.kaNlTercero))).toBe(true);

    // 3. Clear the hire-date input, verify a null request bound, and restore the complete baseline.
    const restored = await calculate(null);
    expect(identities(restored)).toEqual(identities(baseline));
    expect(calculations).toBe(3);
    expect(saves, "Hire-date filtering must never persist salary changes").toEqual([]);
  });
});
