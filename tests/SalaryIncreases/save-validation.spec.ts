import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

type Employee = {
  kaNlTercero: number;
  nNit: number;
  ddIngreso: string;
  ndSalarioMes: number;
  nuevoSalario: number;
};

test.describe("P0 - Save guards, confirmations and persistence - Mutation", () => {
  test.describe.configure({ retries: 0 });

  test("SI-024: Increase date before hire date", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
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
      const context = await responses[0]!.json();
      const year = new URL(responses[0]!.url()).searchParams.get("year");
      expect(year).toMatch(/^\d{4}$/);
      return { context, year: year! };
    };
    const displayDate = (date: string) => date.split("-").reverse().join("/");

    // 1. Settle startup, enter a supported baseline date and positive fixed increase, and calculate without employee filters.
    const { context, year } = await settleStartup(() => screen.goto());
    test.skip(!(context.salarioMinimoActual > 0),
      "Shared QA requires a supported startup year with a positive minimum salary");
    const baselineDate = year + "-12-31";
    const command = {
      tipoTercero: null, unidad: null, profesion: null, rango: null, fuerza: null,
      nivel: null, grado: null, nitInicial: null as number | null, nitFinal: null as number | null,
      salarioInicial: null, salarioFinal: null, porcentaje: 0, valor: 1,
      decreto: 0, fechaDesde: baselineDate, fechaIngresoDesde: null,
      aproximarCien: false, aumentoPorPuntos: false,
    };
    const calculate = async () => {
      const pending = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().split("?")[0] === calculatePath);
      await screen.calculateButton.click();
      const response = await pending;
      expect(await response.finished()).toBeNull();
      expect(response.status(), await response.text()).toBe(200);
      expect(response.request().postDataJSON()).toEqual(command);
      const body = await response.json();
      expect(body.context).toEqual(context);
      expect(Array.isArray(body.rows)).toBe(true);
      return body.rows as Employee[];
    };
    await screen.startDateInput.fill(displayDate(baselineDate));
    await screen.increaseValueInput.fill("1");
    await screen.percentageInput.fill("0");
    const baseline = await calculate();
    expect(new Set(baseline.map(row => row.kaNlTercero)).size).toBe(baseline.length);
    await expect(screen.table.locator('tr[data-testid^="aumento-sueldo-increases-row--"]'))
      .toHaveCount(baseline.length);
    await screen.expectPreviewSalaries(baseline.slice(0, 25));
    expect(saves).toHaveLength(0);

    // 2. Derive an existing employee and an increase date one day before hire within the supported year.
    const employee = baseline.find(row => {
      if (!Number.isSafeInteger(row.nNit) || row.nNit <= 0 ||
          !Number.isFinite(row.ndSalarioMes) || row.ndSalarioMes <= 0 ||
          typeof row.ddIngreso !== "string") return false;
      const hire = row.ddIngreso.slice(0, 10);
      const parsed = new Date(hire + "T00:00:00Z");
      return /^\d{4}-\d{2}-\d{2}$/.test(hire) && Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === hire && hire > year + "-01-01" &&
        hire <= baselineDate && baseline.filter(other => other.nNit === row.nNit).length === 1;
    });
    test.skip(!employee,
      "Shared QA requires an employee with a unique positive document, valid salary, and hire date after January 1 within the supported startup year");
    const selected = employee!;
    const hireDate = selected.ddIngreso.slice(0, 10);
    const increaseDate = new Date(new Date(hireDate + "T00:00:00Z").getTime() - 86_400_000)
      .toISOString().slice(0, 10);
    expect(increaseDate < hireDate).toBe(true);
    expect(increaseDate.slice(0, 4)).toBe(year);

    // 3. Set identical document bounds and the derived date; calculate exactly the selected employee.
    await screen.openFilters();
    await screen.documentStartInput.fill(String(selected.nNit));
    await screen.documentEndInput.fill(String(selected.nNit));
    await screen.startDateInput.fill(displayDate(increaseDate));
    Object.assign(command, { nitInicial: selected.nNit, nitFinal: selected.nNit, fechaDesde: increaseDate });
    const preview = await calculate();
    expect(preview).toHaveLength(1);
    expect(preview[0]).toMatchObject(selected);
    expect(preview[0]!.nuevoSalario).toBe(selected.ndSalarioMes + 1);
    await screen.expectPreviewSalaries(preview);
    expect(saves).toHaveLength(0);

    // 4. Select one employee, Save, decline position updates, and confirm once while capturing the rejected request.
    await screen.rowCheckbox(selected.kaNlTercero).check();
    await expect(screen.rowCheckbox(selected.kaNlTercero)).toBeChecked();
    await expect(screen.table.locator('input[type="checkbox"]:checked')).toHaveCount(1);
    await screen.saveButton.click();
    await expect(screen.dialog("positions-confirmation")).toBeVisible();
    expect(saves).toHaveLength(0);
    await screen.dialogButton("positions-confirmation", "deny").click();
    await expect(screen.dialog("positions-confirmation")).toBeHidden();
    const confirmation = screen.dialog("save-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator(".swal2-html-container")).toContainText(/:\s*1\s/);
    expect(saves).toHaveLength(0);
    const pendingSave = page.waitForResponse(response =>
      response.request().method() === "POST" && response.url().split("?")[0] === savePath);
    await screen.dialogButton("save-confirmation", "confirm").click();
    const rejected = await pendingSave;
    expect(await rejected.finished()).toBeNull();
    expect(saves).toHaveLength(1);
    expect(rejected.request().postDataJSON()).toEqual({
      command, selectedEmployeeIds: [selected.kaNlTercero],
      actualizarCargosVacantes: false, confirmarCambios: true,
    });
    const error = await rejected.json();
    expect(rejected.status(), JSON.stringify(error)).toBe(400);

    // 5. Verify the observed employee/date-specific API and dialog message, with no success confirmation.
    // This literal is the product's API contract.
    const expectedMessage = `El empleado con documento ${selected.nNit} no se le puede incrementar salario, ya que la fecha del incremento (${increaseDate}) es menor a la fecha de ingreso (${hireDate})`;
    expect(error).toMatchObject({ code: "BAD_REQUEST", message: expectedMessage });
    await screen.expectApiErrorMessage(expectedMessage);
    await expect(confirmation).toBeHidden();
    await expect(page.locator(".swal2-success:visible")).toHaveCount(0);

    // 6. Dismiss the error, reload, and recalculate the same employee at the baseline date to prove salary is unchanged.
    await screen.dialogButton("api-error", "confirm").click();
    await expect(screen.dialog("api-error")).toBeHidden();
    const reloaded = await settleStartup(() => page.reload());
    expect(reloaded).toEqual({ context, year });
    await expect(screen.visibleRows()).toHaveCount(0);
    await screen.documentStartInput.fill(String(selected.nNit));
    await screen.documentEndInput.fill(String(selected.nNit));
    await screen.startDateInput.fill(displayDate(baselineDate));
    await screen.increaseValueInput.fill("1");
    command.fechaDesde = baselineDate;
    const after = await calculate();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      kaNlTercero: selected.kaNlTercero, nNit: selected.nNit,
      ddIngreso: selected.ddIngreso, ndSalarioMes: selected.ndSalarioMes,
      nuevoSalario: selected.ndSalarioMes + 1,
    });
    await screen.expectPreviewSalaries(after);
    expect(calculations).toHaveLength(3);
    expect(saves).toHaveLength(1);
    await testInfo.attach("hire-date-rejection-and-reload", {
      body: JSON.stringify({
        employeeId: selected.kaNlTercero, document: selected.nNit, increaseDate, hireDate,
        status: rejected.status(), error,
        salaryBefore: selected.ndSalarioMes, salaryAfterReload: after[0]!.ndSalarioMes,
      }, null, 2),
      contentType: "application/json",
    });
  });
});
