import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

// Edit before each run: use a supported YYYY-MM-DD date unused for all three selected employees.
const INCREASE_DATE = "2026-10-03";

type Employee = {
  kaNlTercero: number;
  nNit: number;
  scNombre: string;
  ndSalarioMes: number;
  nuevoSalario: number;
  ddIngreso: string;
  codigoSustituto: number | null;
  codigoCausante: number | null;
};

test.describe("P0 - Save guards, confirmations and persistence - Mutation", () => {
  // This test persists an increase. A retry must never repeat a successful save.
  test.describe.configure({ retries: 0 });

  test("SI-023: Full salary-increase flow for three existing employees", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const date = INCREASE_DATE;
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(date + "T00:00:00Z").toISOString().slice(0, 10)).toBe(date);
    const displayDate = date.split("-").reverse().join("/");
    const screen = new SalaryIncreasesPage(page);
    const calculatePath = screen.apiBase + "w-aumento-sueldo/actions/calculate";
    const savePath = screen.apiBase + "w-aumento-sueldo/actions/grabar";
    const saves: Request[] = [];
    const calculations: Request[] = [];
    page.on("request", request => {
      if (request.method() !== "POST") return;
      const path = request.url().split("?")[0];
      if (path === savePath) saves.push(request);
      if (path === calculatePath) calculations.push(request);
    });
    const startupPaths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const settleStartup = async (navigate: () => Promise<unknown>) => {
      const pending = startupPaths.map(path => page.waitForResponse(response =>
        response.request().method() === "GET" &&
        response.url().split("?")[0] === screen.apiBase + path));
      await navigate();
      const responses = await Promise.all(pending);
      for (const response of responses) {
        expect(response.status(), response.url()).toBe(200);
        expect(await response.finished()).toBeNull();
      }
      return responses[0]!.json();
    };
    const command = {
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null as number | null, nitFinal: null as number | null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 1,
      decreto: 0, fechaDesde: date, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const calculate = async (expectedCommand: typeof command) => {
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculatePath);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status(), await response.text()).toBe(200);
      expect(response.request().postDataJSON()).toEqual(expectedCommand);
      const body = await response.json();
      expect(Array.isArray(body.rows)).toBe(true);
      return body as { context: unknown; rows: Employee[] };
    };

    // 1. Start with a fresh authenticated context, settle startup, set a supported date and positive amount, then calculate.
    const context = await settleStartup(() => screen.goto());
    await screen.startDateInput.fill(displayDate);
    await screen.increaseValueInput.fill("1");
    await screen.percentageInput.fill("0");
    const before = await calculate(command);
    expect(before.context).toEqual(context);
    expect(new Set(before.rows.map(row => row.kaNlTercero)).size).toBe(before.rows.length);
    const eligible = (row: Employee) =>
      Number.isSafeInteger(row.nNit) && Number.isSafeInteger(row.ndSalarioMes) &&
      row.ndSalarioMes > 0 && row.ddIngreso.slice(0, 10) <= date &&
      row.codigoSustituto === null && row.codigoCausante === null;
    const first = before.rows.find(eligible);
    const later = before.rows.slice(25).filter(eligible).slice(0, 2);
    test.skip(!first || later.length < 2 || before.rows.length < 4,
      "Shared QA requires three eligible employees across pages and an unselected baseline employee");
    const selected = [first!, ...later];
    const selectedIds = selected.map(row => row.kaNlTercero);
    expect(new Set(selectedIds).size).toBe(3);
    for (const employee of selected) expect(employee.nuevoSalario).toBe(employee.ndSalarioMes + 1);
    expect(saves).toHaveLength(0);

    // 2. Select exactly three runtime employees across pages and verify their salary previews.
    await screen.pageSizeButton(25).click();
    const allRows = screen.table.locator('tr[data-testid^="aumento-sueldo-increases-row--"]');
    await expect(allRows).toHaveCount(before.rows.length);
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    let currentPage = 0;
    for (const employee of selected) {
      const targetPage = Math.floor(before.rows.indexOf(employee) / 25);
      while (currentPage < targetPage) {
        await screen.nextPageButton.click();
        currentPage++;
      }
      await screen.expectPreviewSalaries(before.rows.slice(targetPage * 25, targetPage * 25 + 25));
      await screen.rowCheckbox(employee.kaNlTercero).check();
      await expect(screen.rowCheckbox(employee.kaNlTercero)).toBeChecked();
    }
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(3);

    // 3. Click Save, decline position updates, and verify the final confirmation reports exactly three employees before persistence.
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    expect(saves).toHaveLength(0);
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(screen.dialog("positions-confirmation")).toBeHidden();
    const confirmation = screen.dialog("save-confirmation");
    await expect(confirmation).toBeVisible();
    // Compare the complete numeric count in the confirmation without translating product copy.
    await expect(confirmation.locator(".swal2-html-container")).toContainText(/:\s*3\s/);
    expect(saves).toHaveLength(0);
    await testInfo.attach("salary-before-save", {
      body: JSON.stringify({ date, employees: selected.map(row => ({
        employeeId: row.kaNlTercero, document: row.nNit,
        originalSalary: row.ndSalarioMes, expectedSalary: row.nuevoSalario,
      })) }, null, 2),
      contentType: "application/json",
    });

    // 4. Accept once and assert the actual save request schema and successful response.
    const pendingSave = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === savePath);
    await screen.dialogButton("save-confirmation", "confirm").click();
    const saved = await pendingSave;
    expect(await saved.finished()).toBeNull();
    expect(saves).toHaveLength(1);
    expect(saved.request().postDataJSON()).toEqual({
      command, selectedEmployeeIds: selectedIds,
      actualizarCargosVacantes: false, confirmarCambios: true,
    });
    const savedBody = await saved.json();
    await testInfo.attach("salary-save-response", {
      body: JSON.stringify({ status: saved.status(), body: savedBody }, null, 2),
      contentType: "application/json",
    });
    expect(saved.status(), JSON.stringify(savedBody)).toBe(201);
    expect(savedBody).toMatchObject({ affectedEmployees: 3, updatedVacantCargos: 0 });
    for (const key of ["updatedHistoricoCargos", "updatedHistoricoEncargos", "updatedSustitutos"]) {
      expect(Number.isInteger(savedBody[key]), key).toBe(true);
      expect(savedBody[key], key).toBeGreaterThanOrEqual(0);
    }
    await expect(confirmation).toBeHidden();

    // 5. Verify saved rows show a dash, then retry Save without recalculating or changing the date.
    // Successful Save returns the grid to its first page.
    await expect(screen.previousPageButton).toBeDisabled();
    currentPage = 0;
    for (const employee of selected) {
      const targetPage = Math.floor(before.rows.indexOf(employee) / 25);
      while (currentPage < targetPage) {
        await screen.nextPageButton.click();
        currentPage++;
      }
      await expect(screen.row(employee.kaNlTercero)).toBeVisible();
      await expect(screen.row(employee.kaNlTercero).locator("td:nth-child(12)")).toHaveText("-");
      await expect(screen.rowCheckbox(employee.kaNlTercero)).not.toBeChecked();
      await screen.rowCheckbox(employee.kaNlTercero).check();
      await expect(screen.rowCheckbox(employee.kaNlTercero)).toBeChecked();
    }
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(3);
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator(".swal2-html-container")).toContainText(/:\s*3\s/);
    expect(saves).toHaveLength(1);
    const pendingRepeat = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === savePath);
    await screen.dialogButton("save-confirmation", "confirm").click();
    const repeated = await pendingRepeat;
    expect(await repeated.finished()).toBeNull();
    expect(repeated.request().postDataJSON()).toEqual({
      command, selectedEmployeeIds: selectedIds,
      actualizarCargosVacantes: false, confirmarCambios: true,
    });
    const repeatBody = await repeated.json();
    await testInfo.attach("completed-save-retry", {
      body: JSON.stringify({ date, status: repeated.status(), body: repeatBody }, null, 2),
      contentType: "application/json",
    });
    expect(repeated.status(), JSON.stringify(repeatBody)).toBe(400);
    // Preserve the exact product contract, including its trailing space.
    const expectedMessage = `No es posible registrar el aumento de sueldo al empleado ${selected[0]!.scNombre}, debido que ya cuenta con un registro en su histórico con la misma fecha del aumento a realizar. `;
    expect(repeatBody).toMatchObject({ code: "BAD_REQUEST", message: expectedMessage });
    await screen.expectApiErrorMessage(expectedMessage);
    expect(calculations).toHaveLength(1);
    expect(saves).toHaveLength(2);
    await screen.dialogButton("api-error", "confirm").click();
    await expect(screen.dialog("api-error")).toBeHidden();

    // 6. Reload and calculate; verify each selected salary increased once and unselected salaries stayed unchanged.
    const reloadedContext = await settleStartup(() => page.reload());
    await expect(screen.visibleRows()).toHaveCount(0);
    await screen.startDateInput.fill(displayDate);
    await screen.increaseValueInput.fill("1");
    const after = await calculate(command);
    expect(after.context).toEqual(reloadedContext);
    expect(after.rows.map(row => row.kaNlTercero).sort((a, b) => a - b))
      .toEqual(before.rows.map(row => row.kaNlTercero).sort((a, b) => a - b));
    const persisted = new Map(after.rows.map(row => [row.kaNlTercero, row]));
    for (const original of before.rows) {
      const actual = persisted.get(original.kaNlTercero)!;
      expect(actual.nNit).toBe(original.nNit);
      expect(actual.ndSalarioMes, `Employee ${original.kaNlTercero}`)
        .toBe(original.ndSalarioMes + (selectedIds.includes(original.kaNlTercero) ? 1 : 0));
    }
    await screen.pageSizeButton(25).click();
    currentPage = 0;
    for (const employee of selected) {
      const actual = persisted.get(employee.kaNlTercero)!;
      const targetPage = Math.floor(after.rows.indexOf(actual) / 25);
      while (currentPage < targetPage) {
        await screen.nextPageButton.click();
        currentPage++;
      }
      await expect(screen.row(actual.kaNlTercero)).toBeVisible();
      await screen.expectPreviewSalaries(after.rows.slice(targetPage * 25, targetPage * 25 + 25));
    }
    await testInfo.attach("batch-after-reload", {
      body: JSON.stringify({ date, employees: selected.map(row => ({
        employeeId: row.kaNlTercero, originalSalary: row.ndSalarioMes,
        currentSalary: persisted.get(row.kaNlTercero)!.ndSalarioMes,
      })), unchangedEmployees: before.rows.length - selected.length }, null, 2),
      contentType: "application/json",
    });
    expect(calculations).toHaveLength(2);
    expect(saves).toHaveLength(2);
    // Saved increases remain in QA. Choose an unused date before another execution.
  });
});
