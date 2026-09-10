import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type Option = { id: number; codigo: string; descripcion: string };
type Employee = {
  kaNlTercero: number;
  kaNlTipoTercero: number | null;
  kaNlUnidad: number | null;
  kaNiProfesion: number | null;
  kaNiCargo: number | null;
  kaNlSeccion: number | null;
  nNit: number;
  ddIngreso: string;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P1 - Filter controls and employee eligibility", () => {
  test("SI-011: Combined filters intersect", async ({ page }) => {
    test.setTimeout(90_000);
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

    // 1. Start fresh and choose a runtime employee with baseline exclusions for every filter.
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
    const date = year + "-09-10";
    const displayDate = (value: string) => value.split("-").reverse().join("/");
    const lookups: Option[][] = await Promise.all(responses.slice(1, 5).map(response => response.json()));
    const sections: Array<{ kaNlSeccion: number; ssSeccion: string }> = await responses[5].json();
    const options = [...lookups, sections.map(section => ({
      id: section.kaNlSeccion, codigo: section.ssSeccion, descripcion: section.ssSeccion,
    }))];
    const keys = ["kaNlTipoTercero", "kaNlUnidad", "kaNiProfesion", "kaNiCargo", "kaNlSeccion"] as const;
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
    const identities = (rows: Employee[]) => rows.map(row => row.kaNlTercero).sort((a, b) => a - b);
    const calculate = async (filters: Record<string, number | string | null> = {}): Promise<Employee[]> => {
      const before = calculations;
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
      const rows: Employee[] = body.rows;
      expect(new Set(identities(rows)).size).toBe(rows.length);
      if (rows.length) {
        await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
        await screen.expectPreviewSalaries(rows.slice(0, 25));
        await expect(screen.exportButton).toBeEnabled();
        await expect(screen.saveButton).toBeEnabled();
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
    const baseline = await calculate();
    const target = baseline.find(row =>
      keys.every((key, index) => options[index]!.some(option => option.id === row[key])
        && baseline.some(other => other[key] !== row[key]))
      && /^\d{4}-\d{2}-\d{2}$/.test(row.ddIngreso)
      && Number.isSafeInteger(Number(row.nNit))
      && baseline.some(other => other.ddIngreso < row.ddIngreso)
      && baseline.some(other => Number(other.nNit) < Number(row.nNit))
      && baseline.some(other => Number(other.nNit) > Number(row.nNit)));
    test.skip(!target, "Shared QA requires an employee with all five lookup IDs and exclusions for every bound");
    if (!target) throw new Error("Missing runtime intersection fixture");
    const predicates: Array<(row: Employee) => boolean> = [
      ...keys.map(key => (row: Employee) => row[key] === target[key]),
      row => Number(row.nNit) >= Number(target.nNit),
      row => Number(row.nNit) <= Number(target.nNit),
      row => row.ddIngreso >= target.ddIngreso,
    ];
    const expected = baseline.filter(row => predicates.every(matches => matches(row)));
    expect(expected).toContainEqual(target);
    const alternate = options[2]!.find(option => option.id !== target.kaNiProfesion
      && !baseline.some(row => predicates.every((matches, index) =>
        index === 2 ? row.kaNiProfesion === option.id : matches(row))));
    test.skip(!alternate, "Shared QA requires a profession producing an empty intersection");
    if (!alternate) throw new Error("Missing nonmatching profession");

    // 2. Combine employee type, payment unit, profession, position, section, document bounds and hire date.
    await screen.openFilters();
    const selects = [screen.employeeTypeSelect, screen.paymentUnitSelect, screen.professionSelect];
    for (let index = 0; index < selects.length; index++) {
      const option = options[index]!.find(option => option.id === target[keys[index]!])!;
      await screen.selectLookupOption(selects[index]!, option, options[index]!);
    }
    for (const [index, name] of (["position", "section"] as const).entries()) {
      const option = options[index + 3]!.find(option => option.id === target[keys[index + 3]!])!;
      const picker = screen.picker(name);
      await picker.open.click();
      await picker.search.fill(option.codigo);
      await screen.pickerRow(name, option.id).click();
      await expect(picker.panel).toBeHidden();
      await expect(picker.open).toContainText(option.descripcion);
    }
    await screen.documentStartInput.fill(String(target.nNit));
    await screen.documentEndInput.fill(String(target.nNit));
    await screen.hireDateInput.fill(displayDate(target.ddIngreso));
    await expect(screen.documentStartInput).toHaveValue(String(target.nNit));
    await expect(screen.documentEndInput).toHaveValue(String(target.nNit));
    await expect(screen.hireDateInput).toHaveValue(displayDate(target.ddIngreso));
    expect(calculations, "Filter changes must not automatically calculate").toBe(1);
    const filters = {
      tipoTercero: target.kaNlTipoTercero, unidad: target.kaNlUnidad,
      profesion: target.kaNiProfesion, rango: target.kaNiCargo, fuerza: target.kaNlSeccion,
      nitInicial: Number(target.nNit), nitFinal: Number(target.nNit), fechaIngresoDesde: target.ddIngreso,
    };
    const matched = await calculate(filters);
    expect(identities(matched)).toEqual(identities(expected));
    const matchedIds = new Set(identities(matched));
    for (const [index, matches] of predicates.entries()) {
      expect(matched.every(matches), "Returned rows must satisfy criterion " + index).toBe(true);
      const excluded = baseline.filter(row => !matches(row));
      expect(excluded.length, "Baseline must exercise exclusion for criterion " + index).toBeGreaterThan(0);
      expect(excluded.every(row => !matchedIds.has(row.kaNlTercero))).toBe(true);
    }

    // 3. Change only profession to a nonmatching combination and verify that the previous preview clears.
    await screen.openFilters();
    await screen.selectLookupOption(screen.professionSelect, alternate, options[2]!);
    expect(calculations).toBe(2);
    const empty = await calculate({ ...filters, profesion: alternate.id });
    expect(empty).toEqual([]);
    for (const row of matched) await expect(screen.row(row.kaNlTercero)).toBeHidden();
    expect(calculations).toBe(3);
    expect(saves, "Combined filtering must never persist salary changes").toEqual([]);
  });
});
