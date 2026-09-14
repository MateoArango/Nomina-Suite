import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

// Edit before each run: use a supported YYYY-MM-DD date unused for the selected employee.
const INCREASE_DATE = "2026-09-22";

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

  test("SI-023: Full salary-increase flow for one existing employee", async ({ page }, testInfo) => {
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
    const employee = before.rows.find(row =>
      Number.isSafeInteger(row.nNit) && Number.isSafeInteger(row.ndSalarioMes) &&
      row.ndSalarioMes > 0 && row.ddIngreso.slice(0, 10) <= date &&
      row.codigoSustituto === null && row.codigoCausante === null);
    test.skip(!employee, "Shared QA requires an existing employee with a safe numeric identity and salary, hired by the increase date, without substitute or deceased-employee linkage");
    const selected = employee!;
    const expectedSalary = selected.ndSalarioMes + 1;
    expect(selected.nuevoSalario).toBe(expectedSalary);
    expect(saves).toHaveLength(0);

    // 2. Select exactly one runtime employee and verify its original and preview salaries.
    const index = before.rows.indexOf(selected);
    await screen.pageSizeButton(25).click();
    for (let offset = 25; offset <= index; offset += 25) await screen.nextPageButton.click();
    const pageStart = Math.floor(index / 25) * 25;
    await screen.expectPreviewSalaries(before.rows.slice(pageStart, pageStart + 25));
    const allRows = screen.table.locator('tr[data-testid^="aumento-sueldo-increases-row--"]');
    await expect(allRows).toHaveCount(before.rows.length);
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    await screen.rowCheckbox(selected.kaNlTercero).check();
    await expect(screen.rowCheckbox(selected.kaNlTercero)).toBeChecked();
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(1);

    // 3. Click Save, decline position updates, and verify the final confirmation reports exactly one employee before persistence.
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    expect(saves).toHaveLength(0);
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(screen.dialog("positions-confirmation")).toBeHidden();
    const confirmation = screen.dialog("save-confirmation");
    await expect(confirmation).toBeVisible();
    // Compare the complete numeric count in the confirmation without translating product copy.
    await expect(confirmation.locator(".swal2-html-container")).toContainText(/:\s*1\s/);
    expect(saves).toHaveLength(0);
    await testInfo.attach("salary-before-save", {
      body: JSON.stringify({ employeeId: selected.kaNlTercero, document: selected.nNit,
        originalSalary: selected.ndSalarioMes, expectedSalary, date }, null, 2),
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
      command, selectedEmployeeIds: [selected.kaNlTercero],
      actualizarCargosVacantes: false, confirmarCambios: true,
    });
    const savedBody = await saved.json();
    await testInfo.attach("salary-save-response", {
      body: JSON.stringify({ status: saved.status(), body: savedBody }, null, 2),
      contentType: "application/json",
    });
    expect(saved.status(), JSON.stringify(savedBody)).toBe(201);
    expect(savedBody).toMatchObject({ affectedEmployees: 1, updatedVacantCargos: 0 });
    for (const key of ["updatedHistoricoCargos", "updatedHistoricoEncargos", "updatedSustitutos"]) {
      expect(Number.isInteger(savedBody[key]), key).toBe(true);
      expect(savedBody[key], key).toBeGreaterThanOrEqual(0);
    }
    await expect(confirmation).toBeHidden();

    // 5. Reload and calculate for the same runtime identity; current salary must equal the saved preview.
    const reloadedContext = await settleStartup(() => page.reload());
    await expect(screen.visibleRows()).toHaveCount(0);
    await screen.startDateInput.fill(displayDate);
    await screen.increaseValueInput.fill("1");
    await screen.documentStartInput.fill(String(selected.nNit));
    await screen.documentEndInput.fill(String(selected.nNit));
    const after = await calculate({ ...command, nitInicial: selected.nNit, nitFinal: selected.nNit });
    expect(after.context).toEqual(reloadedContext);
    const persisted = after.rows.filter(row => row.kaNlTercero === selected.kaNlTercero);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.nNit).toBe(selected.nNit);
    expect(persisted[0]!.ndSalarioMes).toBe(expectedSalary);
    expect(after.rows.every(row => row.nNit === selected.nNit)).toBe(true);
    await screen.expectPreviewSalaries(after.rows.slice(0, 25));
    await expect(screen.row(selected.kaNlTercero)).toBeVisible();
    await testInfo.attach("salary-after-reload", {
      body: JSON.stringify({ employeeId: selected.kaNlTercero,
        currentSalary: persisted[0]!.ndSalarioMes, expectedSalary }, null, 2),
      contentType: "application/json",
    });
    expect(calculations).toHaveLength(2);
    expect(saves).toHaveLength(1);

    // 6. Repeat the increase for the same employee and date after proving the first save persisted.
    expect(persisted[0]!.nuevoSalario).toBe(expectedSalary + 1);
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    await screen.rowCheckbox(selected.kaNlTercero).check();
    await expect(screen.rowCheckbox(selected.kaNlTercero)).toBeChecked();
    await expect(allRows.locator('input[type="checkbox"]:checked')).toHaveCount(1);
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator(".swal2-html-container")).toContainText(/:\s*1\s/);
    expect(saves).toHaveLength(1);
    const pendingDuplicate = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === savePath);
    await screen.dialogButton("save-confirmation", "confirm").click();
    const duplicate = await pendingDuplicate;
    expect(await duplicate.finished()).toBeNull();
    expect(saves).toHaveLength(2);
    expect(duplicate.request().postDataJSON()).toEqual({
      command: { ...command, nitInicial: selected.nNit, nitFinal: selected.nNit },
      selectedEmployeeIds: [selected.kaNlTercero],
      actualizarCargosVacantes: false, confirmarCambios: true,
    });
    const duplicateBody = await duplicate.json();
    const duplicateMessage = `No es posible registrar el aumento de sueldo al empleado ${selected.scNombre}, debido que ya cuenta con un registro en su histórico con la misma fecha del aumento a realizar. `;
    expect(duplicate.status(), JSON.stringify(duplicateBody)).toBe(400);
    expect(duplicateBody).toMatchObject({ code: "BAD_REQUEST", message: duplicateMessage });
    await screen.expectApiErrorMessage(duplicateMessage);
    await testInfo.attach("duplicate-date-rejection", {
      body: JSON.stringify({ status: duplicate.status(), body: duplicateBody }, null, 2),
      contentType: "application/json",
    });

    // 7. Reload again and verify the rejected attempt did not increase the persisted salary.
    const finalContext = await settleStartup(() => page.reload());
    await expect(screen.visibleRows()).toHaveCount(0);
    await screen.startDateInput.fill(displayDate);
    await screen.increaseValueInput.fill("1");
    await screen.documentStartInput.fill(String(selected.nNit));
    await screen.documentEndInput.fill(String(selected.nNit));
    const final = await calculate({ ...command, nitInicial: selected.nNit, nitFinal: selected.nNit });
    expect(final.context).toEqual(finalContext);
    const unchanged = final.rows.filter(row => row.kaNlTercero === selected.kaNlTercero);
    expect(unchanged).toHaveLength(1);
    expect(unchanged[0]!.nNit).toBe(selected.nNit);
    expect(unchanged[0]!.ndSalarioMes).toBe(expectedSalary);
    expect(unchanged[0]!.ndSalarioMes).not.toBe(persisted[0]!.nuevoSalario);
    expect(final.rows.every(row => row.nNit === selected.nNit)).toBe(true);
    await screen.expectPreviewSalaries(final.rows.slice(0, 25));
    await expect(screen.row(selected.kaNlTercero)).toBeVisible();
    await testInfo.attach("salary-after-duplicate-rejection", {
      body: JSON.stringify({ employeeId: selected.kaNlTercero,
        currentSalary: unchanged[0]!.ndSalarioMes, expectedSalary }, null, 2),
      contentType: "application/json",
    });
    expect(calculations).toHaveLength(3);
    expect(saves).toHaveLength(2);
  });
});
