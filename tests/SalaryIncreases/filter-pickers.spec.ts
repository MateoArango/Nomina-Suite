import { expect, test } from "@playwright/test";
import { LoginPage } from "../../pages/Login.page";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type LookupOption = { id: number; codigo: string; descripcion: string };
type Employee = {
  kaNlTercero: number;
  kaNiCargo: number | null;
  kaNlSeccion: number | null;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P1 - Filter controls and employee eligibility", () => {
  test("SI-008: Position and section searchable pickers", async ({ page }) => {
    test.setTimeout(90_000);
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.signIn();

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
    const date = year + "-09-09";
    const positions: LookupOption[] = await responses[4].json();
    const sections: Array<{ kaNlSeccion: number; ssSeccion: string }> = await responses[5].json();
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
      { picker: "position", options: positions.map(o => ({ id: o.id, label: o.descripcion, query: o.codigo })), key: "kaNiCargo", field: "rango", placeholder: "Seleccione un cargo", empty: "No hay cargos que coincidan con la busqueda actual." },
      { picker: "section", options: sections.map(o => ({ id: o.kaNlSeccion, label: o.ssSeccion, query: o.ssSeccion })), key: "kaNlSeccion", field: "fuerza", placeholder: "Seleccione una sección", empty: "No hay secciones que coincidan con la busqueda actual." },
    ] as const;
    for (const filter of cases) {
      await test.step(filter.picker, async () => {
        const option = filter.options.find(o =>
          baseline.some(row => row[filter.key] === o.id) &&
          baseline.some(row => row[filter.key] !== o.id));
        expect(option, "Lookup requires both matching and excluded baseline employees").toBeDefined();
        if (!option) throw new Error("No eligible runtime option: " + filter.picker);
        const picker = screen.picker(filter.picker);
        const row = screen.pickerRow(filter.picker, option.id);
        const noMatch = "ZZZ_SI008_" + Date.now();
        expect(filter.options.every(o => !o.query.includes(noMatch) && !o.label.includes(noMatch))).toBe(true);
        const before = calculations.length;

        // 2. Search a runtime target, erase the query, and enter a guaranteed non-match.
        await screen.openFilters();
        await expect(picker.open).toContainText(filter.placeholder);
        await picker.open.click();
        await picker.search.fill(option.query);
        await expect(row).toBeVisible();
        await picker.search.fill("");
        await screen.expectPickerCount(filter.picker, filter.options.length);
        await picker.search.fill(noMatch);
        await expect(picker.empty).toHaveText(filter.empty);
        await expect(picker.rows).toHaveCount(0);

        // 3. Select the target; reopening and erasing search must preserve selection.
        await picker.search.fill("");
        await picker.search.fill(option.query);
        await row.click();
        await expect(picker.panel).toBeHidden();
        await expect(picker.open).toContainText(option.label);
        await picker.open.click();
        await expect(picker.search).toHaveValue("");
        await picker.search.fill(noMatch);
        await expect(picker.empty).toHaveText(filter.empty);
        await expect(picker.rows).toHaveCount(0);
        await picker.search.fill("");
        await expect(picker.open).toContainText(option.label);
        await screen.expectPickerCount(filter.picker, filter.options.length);

        // 4. Clear with a selection and search present, then verify the reopened defaults.
        await picker.search.fill(option.query);
        await expect(row).toBeVisible();
        await picker.clear.click();
        await expect(picker.panel).toBeHidden();
        await expect(picker.open).toContainText(filter.placeholder);
        await picker.open.click();
        await expect(picker.search).toHaveValue("");
        await screen.expectPickerCount(filter.picker, filter.options.length);

        // 5. Select again and calculate the exact baseline subset with the other picker empty.
        await picker.search.fill(option.query);
        await row.click();
        await expect(picker.panel).toBeHidden();
        expect(calculations, "Picker interactions must not calculate").toHaveLength(before);
        const filtered = await calculate({ [filter.field]: option.id });
        expect(identities(filtered)).toEqual(identities(baseline.filter(row => row[filter.key] === option.id)));

        // 6. Clear and recalculate with unchanged values to restore every baseline employee.
        await screen.openFilters();
        await picker.open.click();
        await picker.clear.click();
        await expect(picker.panel).toBeHidden();
        await expect(picker.open).toContainText(filter.placeholder);
        expect(calculations).toHaveLength(before + 1);
        const restored = await calculate();
        expect(identities(restored)).toEqual(identities(baseline));
      });
    }
    expect(calculations).toHaveLength(5);
    expect(saves, "Picker exploration must never save salaries").toEqual([]);
    await screen.goto();
    await expect(screen.calculateButton).toBeEnabled();
    for (const filter of cases) await expect(screen.picker(filter.picker).open).toContainText(filter.placeholder);
    await expect(screen.startDateInput).toHaveValue("");
    expect(calculations).toHaveLength(5);
    expect(saves).toEqual([]);
  });
});
