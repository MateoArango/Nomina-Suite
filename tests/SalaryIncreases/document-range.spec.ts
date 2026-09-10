import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type Employee = { kaNlTercero: number; nNit: number | string | null };
type Preview = Employee & { ndSalarioMes: number; nuevoSalario: number };

test.describe("P1 - Filter controls and employee eligibility", () => {
  test("SI-009: Inclusive document bounds", async ({ page }) => {
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

    // 1. Start fresh, fetch unfiltered employee records, and calculate the eligible baseline.
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
    // Reuse the current authenticated request headers without reading or logging stored credentials.
    const employeesUrl = screen.apiBase + "w-empleados-p/rows";
    const employeeResponse = await page.request.get(employeesUrl, {
      headers: await responses[0].request().allHeaders(),
    });
    expect(employeeResponse.status()).toBe(200);
    expect(employeeResponse.url()).toBe(employeesUrl);
    const employees: Employee[] = await employeeResponse.json();
    expect(Array.isArray(employees), "Observed endpoint returns an unpaginated array").toBe(true);
    expect(Object.keys(employeeResponse.headers()).filter(key => /total|page|link|range/i.test(key)),
      "Revisit retrieval if the endpoint starts advertising pagination").toEqual([]);
    expect(new Set(employees.map(row => row.kaNlTercero)).size).toBe(employees.length);
    const hasDocument = (row: Employee) => row.nNit !== null && String(row.nNit).trim() !== "" &&
      Number.isSafeInteger(Number(row.nNit));
    const documentedEmployees = employees.filter(hasDocument);
    const date = year + "-09-10";
    await screen.startDateInput.fill(date);
    await screen.percentageInput.fill("0");
    await screen.increaseValueInput.fill("100");
    const basePayload = {
      tipoTercero: null, unidad: null, profesion: null, rango: null,
      fuerza: null, nivel: null, grado: null, nitInicial: null, nitFinal: null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 100,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const calculate = async (lower: number | null, upper: number | null): Promise<Preview[]> => {
      await screen.openFilters();
      await screen.documentStartInput.fill(lower === null ? "" : String(lower));
      await screen.documentEndInput.fill(upper === null ? "" : String(upper));
      await expect(screen.documentStartInput).toHaveValue(lower === null ? "" : String(lower));
      await expect(screen.documentEndInput).toHaveValue(upper === null ? "" : String(upper));
      const before = calculations;
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculateUrl);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({
        ...basePayload, nitInicial: lower, nitFinal: upper,
      });
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      if (body.rows.length) {
        await expect(screen.increasesTab).toHaveAttribute("aria-selected", "true");
        await screen.expectPreviewSalaries(body.rows.slice(0, 25));
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
      return body.rows;
    };
    const baseline = await calculate(null, null);
    test.skip(baseline.length === 0, "No eligible baseline employees in shared QA");
    const employeeById = new Map(employees.map(row => [row.kaNlTercero, row]));
    for (const row of baseline) {
      expect(hasDocument(row), "Eligible employees require a numeric document").toBe(true);
      expect(employeeById.has(row.kaNlTercero), "Employee list must cover the entire eligible baseline").toBe(true);
      expect(Number(employeeById.get(row.kaNlTercero)!.nNit)).toBe(Number(row.nNit));
    }
    // The endpoint is not document-sorted; explicitly sort the runtime intersection numerically.
    const baselineIds = new Set(baseline.map(row => row.kaNlTercero));
    const documents = [...new Set(documentedEmployees.filter(row => baselineIds.has(row.kaNlTercero))
      .map(row => Number(row.nNit)))].sort((a, b) => a - b);
    test.skip(documents.length < 5, "Need distinct documents below, at, inside, and above the bounds");
    const lower = documents[Math.floor(documents.length / 3)]!;
    const upper = documents[Math.floor(documents.length * 2 / 3)]!;
    expect(documents.some(value => value < lower)).toBe(true);
    expect(documents.some(value => value > lower && value < upper)).toBe(true);
    expect(documents.some(value => value > upper)).toBe(true);
    const identities = (rows: Employee[]) => rows.map(row => row.kaNlTercero).sort((a, b) => a - b);
    const subset = (start: number | null, end: number | null) => baseline.filter(row =>
      (start === null || Number(row.nNit) >= start) && (end === null || Number(row.nNit) <= end));

    // 2. Calculate equal, lower-only, upper-only, and ordered inclusive bounds independently.
    for (const [name, start, end] of [
      ["equal", lower, lower], ["lower only", lower, null],
      ["upper only", null, upper], ["ordered", lower, upper],
    ] as const) {
      await test.step(name, async () => {
        const expected = subset(start, end);
        expect(expected.length).toBeGreaterThan(0);
        expect(expected.length).toBeLessThan(baseline.length);
        expect(identities(await calculate(start, end))).toEqual(identities(expected));
      });
    }

    // 3. Reverse the bounds and use a valid non-matching range; both clear populated previews.
    expect(await calculate(upper, lower)).toEqual([]);
    expect(identities(await calculate(lower, upper))).toEqual(identities(subset(lower, upper)));
    const maximum = Math.max(...documentedEmployees.map(row => Number(row.nNit)));
    expect(Number.isSafeInteger(maximum + 2)).toBe(true);
    expect(await calculate(maximum + 1, maximum + 2)).toEqual([]);
    expect(calculations).toBe(8);
    expect(saves, "Document filtering must never persist salary changes").toEqual([]);
  });
});
