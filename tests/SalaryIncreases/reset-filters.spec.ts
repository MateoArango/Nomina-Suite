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
  test("SI-012: Reset restores defaults and clears preview", async ({ page }) => {
    test.setTimeout(90_000);
    const screen = new SalaryIncreasesPage(page);
    const calculateUrl = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    let calculations = 0;
    const saves: string[] = [];
    const moduleRequests: string[] = [];
    page.on("request", request => {
      if (request.url().startsWith(screen.apiBase + "w-aumento-sueldo/") ||
          request.url().startsWith(screen.apiBase + "w-empleados-p/lookups/")) {
        moduleRequests.push(request.method() + " " + request.url());
      }
      if (request.method() !== "POST") return;
      const url = request.url().split("?")[0];
      if (url === calculateUrl) calculations++;
      if (url === screen.apiBase + "w-aumento-sueldo/actions/grabar") saves.push(url);
    });

    // 1. Start fresh, settle startup, populate all in-scope controls and obtain a successful calculation.
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
    const calculate = async (filters: Record<string, number | string | boolean | null> = {}): Promise<Employee[]> => {
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
      keys.every((key, index) => options[index]!.some(option => option.id === row[key]))
      && baseline.some(other => other.nNit !== row.nNit && keys.every(key => other[key] === row[key]))
      && /^\d{4}-\d{2}-\d{2}$/.test(row.ddIngreso)
      && Number.isSafeInteger(Number(row.nNit)));
    test.skip(!target, "Shared QA requires employees sharing all five lookup IDs with distinct documents and valid hire dates");
    if (!target) throw new Error("Missing runtime reset fixture");
    const group = baseline.filter(row => keys.every(key => row[key] === target[key]));
    const documentStart = Math.min(...group.map(row => Number(row.nNit)));
    const documentEnd = Math.max(...group.map(row => Number(row.nNit)));
    const hireDate = group.map(row => row.ddIngreso).sort()[0]!;
    await screen.openFilters();
    const defaultSelects = await Promise.all([
      screen.employeeTypeSelect, screen.paymentUnitSelect, screen.professionSelect,
    ].map(select => select.innerText()));
    const defaultPickers = await Promise.all([
      screen.positionOpenButton.innerText(), screen.sectionOpenButton.innerText(),
    ]);
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
    await screen.documentStartInput.fill(String(documentStart));
    await screen.documentEndInput.fill(String(documentEnd));
    await screen.hireDateInput.fill(displayDate(hireDate));
    await screen.roundToHundredCheckbox.check();
    await expect(screen.roundToHundredCheckbox).toBeChecked();
    const matched = await calculate({
      tipoTercero: target.kaNlTipoTercero, unidad: target.kaNlUnidad,
      profesion: target.kaNiProfesion, rango: target.kaNiCargo, fuerza: target.kaNlSeccion,
      nitInicial: documentStart, nitFinal: documentEnd,
      fechaIngresoDesde: hireDate, aproximarCien: true,
    });
    expect(matched.map(row => row.kaNlTercero)).toContain(target.kaNlTercero);
    await screen.rowCheckbox(target.kaNlTercero).check();
    await expect(screen.rowCheckbox(target.kaNlTercero)).toBeChecked();
    await screen.searchOpenButton.click();
    await screen.searchInput.fill(String(target.nNit));
    await expect(screen.searchInput).toHaveValue(String(target.nNit));
    await screen.columnFilterButton("nNit").click();
    await screen.columnOptionCheckbox("nNit", target.nNit).uncheck();
    await expect(screen.columnOptionCheckbox("nNit", target.nNit)).not.toBeChecked();
    await screen.columnFilterButton("nNit").click();
    await expect(screen.visibleRows()).toHaveCount(0);

    // 2. Return to filters, establish the request baseline, and click Reset.
    await screen.openFilters();
    // Dirty both numeric controls after success without submitting their invalid combination.
    await screen.percentageInput.fill("5");
    await expect(screen.percentageInput).toHaveValue("5");
    await expect(screen.increaseValueInput).not.toHaveValue("$0");
    const beforeReset = [...moduleRequests];
    await screen.resetFiltersButton.click();
    await expect(screen.filterTab).toHaveAttribute("aria-selected", "true");
    for (const [index, select] of selects.entries()) {
      await expect(select).toHaveText(defaultSelects[index]!);
    }
    for (const [index, name] of (["position", "section"] as const).entries()) {
      const picker = screen.picker(name);
      await expect(picker.open).toHaveText(defaultPickers[index]!, { useInnerText: true });
      await picker.open.click();
      await expect(picker.search).toHaveValue("");
      await screen.expectPickerCount(name, options[index + 3]!.length);
      await picker.open.click();
      await expect(picker.panel).toBeHidden();
    }
    for (const input of [screen.startDateInput, screen.hireDateInput,
      screen.documentStartInput, screen.documentEndInput]) {
      await expect(input).toHaveValue("");
    }
    await expect(screen.percentageInput).toHaveValue("0");
    await expect(screen.increaseValueInput).toHaveValue("$0");
    await expect(screen.roundToHundredCheckbox).not.toBeChecked();

    // 3. Open increases again and verify cleared preview, selection, search and column-filter state.
    await screen.openIncreases();
    await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(screen.table).toHaveCount(0);
    await expect(screen.visibleRows()).toHaveCount(0);
    await expect(screen.rowCheckbox(target.kaNlTercero)).toHaveCount(0);
    await expect(screen.searchInput).toHaveCount(0);
    await expect(screen.columnFilterMenu("nNit")).toHaveCount(0);
    await expect(screen.exportButton).toBeDisabled();
    await expect(screen.saveButton).toBeDisabled();
    expect(moduleRequests, "Reset and state inspection must not issue module requests").toEqual(beforeReset);
    expect(calculations).toBe(2);

    // Grid controls are absent when empty; recalculate to verify stale grid state does not return.
    await screen.openFilters();
    await screen.startDateInput.fill(displayDate(date));
    await screen.increaseValueInput.fill("100");
    const restored = await calculate();
    expect(identities(restored)).toEqual(identities(baseline));
    for (const row of restored) await expect(screen.rowCheckbox(row.kaNlTercero)).not.toBeChecked();
    await screen.searchOpenButton.click();
    await expect(screen.searchInput).toHaveValue("");
    await screen.columnFilterButton("nNit").click();
    await expect(screen.columnSelectAllCheckbox("nNit")).toBeChecked();
    await expect(screen.columnOptionCheckbox("nNit", target.nNit)).toBeChecked();
    const columnChecks = screen.columnFilterMenu("nNit").locator('input[type="checkbox"]');
    await expect(columnChecks).toHaveCount(new Set(restored.map(row => row.nNit)).size + 1);
    expect(await columnChecks.evaluateAll(elements =>
      elements.every(element => (element as HTMLInputElement).checked))).toBe(true);
    expect(calculations).toBe(3);
    expect(saves, "Reset verification must never persist salary changes").toEqual([]);
  });
});
