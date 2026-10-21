// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string };

test.describe("Employee selector and history", () => {
  test("PER-011 — Select an employee from lookup", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const lookupWait = (query: string) => page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" &&
        url.pathname === api + "/lookups/empleados" &&
        url.searchParams.get("limit") === "2000" && url.searchParams.get("query") === query;
    });

    // 1. Start a fresh authenticated context with no selected employee.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.newButton).toBeDisabled();
    await expect(permissions.historyRows).toHaveCount(0);

    // 2. Open the selector, resolve a visible runtime identity and query its document.
    const initialWait = lookupWait("");
    await permissions.employeeSelectorOpenButton.click();
    const initialResponse = await initialWait;
    expect(initialResponse.status()).toBe(200);
    const employees: Employee[] = await initialResponse.json();
    expect(employees.length, "Prerequisite: employee lookup must contain employees").toBeGreaterThan(0);
    await expect(permissions.employeeSelectorVisibleRows.first()).toBeVisible();
    const visibleId = await permissions.employeeSelectorVisibleRows.first().getAttribute("data-testid");
    const employee = employees.find(item => visibleId === "permisos-employee-selector-row--" + item.kaNlTercero);
    expect(employee, "Prerequisite: visible employee must match runtime lookup").toBeDefined();
    if (!employee) throw new Error("Missing visible employee prerequisite");
    const document = String(employee.nNit);
    const name = employee.scNombre.replace(/\s+/g, " ").trim();
    const queryWait = lookupWait(document);
    await permissions.employeeSelectorQueryInput.fill(document);
    const queryResponse = await queryWait;
    expect(queryResponse.status()).toBe(200);
    const matches: Employee[] = await queryResponse.json();
    expect(matches.find(item => item.kaNlTercero === employee.kaNlTercero)).toEqual(employee);
    const row = permissions.employeeSelectorRow(employee.kaNlTercero);
    await expect(row).toBeVisible();
    await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "document")).toHaveText(document);
    await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "name")).toHaveText(name);

    // 3. Register employee-detail and history waits before selecting the visible row.
    const detailWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/empleados/" + employee.kaNlTercero);
    const historyWait = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === api + "/rows" &&
        url.searchParams.get("kaNlTercero") === String(employee.kaNlTercero) &&
        url.searchParams.get("limit") === "200" && url.searchParams.get("calamidad") === "N";
    });
    await row.click();
    const detailResponse = await detailWait;
    const historyResponse = await historyWait;
    expect(detailResponse.status()).toBe(200);
    const selected: Employee & { kaNlEmpleado: number } = await detailResponse.json();
    expect(selected.kaNlTercero).toBe(employee.kaNlTercero);
    expect(selected.kaNlEmpleado).toBe(employee.kaNlTercero);
    expect(String(selected.nNit)).toBe(document);
    expect(selected.scNombre).toBe(employee.scNombre);
    expect(historyResponse.status()).toBe(200);
    const history: HistoryRow[] = await historyResponse.json();
    expect(Array.isArray(history)).toBe(true);

    // 4. Verify the selector closes and selected identity and history match runtime responses.
    await expect(permissions.employeeSelectorTable).toBeHidden();
    await expect(permissions.employeeSelectorQueryInput).toBeHidden();
    await expect(permissions.employeeDocumentInput).toHaveValue(document);
    await expect(permissions.employeeNameValue).toHaveText(name);
    await expect(permissions.newButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(history.length);
    for (const record of history) {
      expect(record.kaNlEmpleado).toBe(employee.kaNlTercero);
      expect(String(record.nNit)).toBe(document);
      const historyRow = permissions.historyRow(record.kaNlDato);
      await expect(historyRow).toHaveCount(1);
      await expect(historyRow.getByRole("cell").nth(1)).toHaveText(record.scNombre);
    }

    // 5. Verify actual empty-history wording when applicable, no errors and no permission mutation.
    if (history.length === 0) {
      await expect(permissions.historyEmptyTitle).toHaveText("Sin permisos");
      await expect(permissions.historyEmptyMessage).toHaveText(
        "Busque o seleccione un empleado para consultar sus permisos.");
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
    } else {
      await expect(permissions.historyTable).toBeVisible();
      await expect(permissions.historyEmptyState).toBeHidden();
    }
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "Employee selection must not create, update or delete permissions").toEqual([]);
  });
});
