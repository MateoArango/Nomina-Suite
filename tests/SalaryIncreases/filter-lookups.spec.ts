import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type LookupOption = { id: number; codigo: string; descripcion: string };
type Employee = {
  kaNlTercero: number;
  kaNlTipoTercero: number | null;
  kaNlUnidad: number | null;
  kaNiProfesion: number | null;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P1 - Filter controls and employee eligibility", () => {
  test("SI-007: Employee type, payment unit and profession", async ({ page }) => {
    test.setTimeout(90_000);
    const screen = new SalaryIncreasesPage(page);
    const calculateUrl = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const calculations: string[] = [];
    const saves: string[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations.push(url);
      if (url === screen.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start fresh, capture lookup responses and choose runtime IDs with matching employees.
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
    const context = await responses[0].json();
    const year = new URL(responses[0].url()).searchParams.get("year");
    expect(year).toMatch(/^\d{4}$/);
    const date = year + "-09-08";
    const lookups: LookupOption[][] = await Promise.all(responses.slice(1, 4).map(response => response.json()));
    const setIncrease = async () => {
      await screen.startDateInput.fill(date);
      await screen.percentageInput.fill("0");
      await screen.increaseValueInput.fill("100");
    };
    const basePayload = {
      tipoTercero: null, unidad: null, profesion: null, rango: null,
      fuerza: null, nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const calculate = async (filters: Record<string, number> = {}): Promise<Employee[]> => {
      const before = calculations.length;
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ ...basePayload, ...filters });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      expect(body.rows.length, "Runtime matching employees are required").toBeGreaterThan(0);
      await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
      await screen.expectPreviewSalaries(body.rows.slice(0, 25));
      expect(calculations).toHaveLength(before + 1);
      expect(saves).toEqual([]);
      return body.rows;
    };
    await expect(screen.calculateButton).toBeEnabled();
    await setIncrease();
    const baseline = await calculate();
    const identities = (rows: Employee[]) => rows.map(row => row.kaNlTercero).sort((a, b) => a - b);
    const cases = [
      { select: screen.employeeTypeSelect, options: lookups[0], field: "tipoTercero", rowKey: "kaNlTipoTercero", all: "(Todos)" },
      { select: screen.paymentUnitSelect, options: lookups[1], field: "unidad", rowKey: "kaNlUnidad", all: "(Todas)" },
      { select: screen.professionSelect, options: lookups[2], field: "profesion", rowKey: "kaNiProfesion", all: "(Todas)" },
    ] as const;

    for (const filter of cases) {
      await test.step(filter.field, async () => {
        // 2. Independently select each lookup and calculate with a valid date and amount.
        await screen.openFilters();
        const option = filter.options.find(option =>
          baseline.some(row => row[filter.rowKey] === option.id));
        expect(option, "Lookup must contain an option with baseline employees").toBeDefined();
        if (!option) throw new Error("Missing eligible lookup option: " + filter.field);
        const expected = baseline.filter(row => row[filter.rowKey] === option.id);
        await screen.selectLookupOption(filter.select, option, filter.options);
        const filtered = await calculate({ [filter.field]: option.id });
        expect(filtered.every(row => row[filter.rowKey] === option.id)).toBe(true);
        expect(identities(filtered)).toEqual(identities(expected));

        // 3. Restore all records through Reset, re-enter the increase and recalculate.
        // Discovery: these dropdowns have no all-records option or individual clear action.
        await screen.openFilters();
        await screen.resetFiltersButton.click();
        for (const control of cases) await expect(control.select).toHaveText(control.all);
        await setIncrease();
        const restored = await calculate();
        expect(identities(restored)).toEqual(identities(baseline));
      });
    }
    expect(calculations).toHaveLength(7);
    expect(saves, "Lookup calculations must never save salaries").toEqual([]);
  });
});
