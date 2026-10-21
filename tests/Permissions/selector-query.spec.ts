// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Employee selector and history", () => {
  test("PER-009 — Search selector by document and name", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
    const mutations: string[] = [];
    const selections: string[] = [];
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith(api + "/")) return;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
      if (path.startsWith(api + "/empleados/") || path === api + "/rows" ||
          path.startsWith(api + "/rows/")) selections.push(request.url());
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const lookupWait = (query: string) => page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" &&
        url.pathname === api + "/lookups/empleados" &&
        url.searchParams.get("limit") === "2000" && url.searchParams.get("query") === query;
    });
    const assertResults = async (employees: Employee[], query: string) => {
      expect(Array.isArray(employees)).toBe(true);
      expect(employees.length, "Prerequisite: matching employee lookup must not be empty").toBeGreaterThan(0);
      await expect(permissions.employeeSelectorQueryInput).toHaveValue(query);
      const visible = employees.slice(0, 10);
      await expect(permissions.employeeSelectorVisibleRows).toHaveCount(visible.length);
      for (const [index, employee] of visible.entries()) {
        await expect(permissions.employeeSelectorVisibleRows.nth(index)).toHaveAttribute(
          "data-testid", `permisos-employee-selector-row--${employee.kaNlTercero}`);
      }
      for (const employee of visible) {
        await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "name"))
          .toHaveText(employee.scNombre.replace(/\s+/g, " ").trim());
        await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "document"))
          .toHaveText(String(employee.nNit));
      }
      await expect(errorDialog).toBeHidden();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(permissions.employeeSelectorPanel.getByText("Sin resultados", { exact: true })).toBeHidden();
    };
    const queryEmployees = async (query: string) => {
      const wait = lookupWait(query);
      await permissions.employeeSelectorQueryInput.fill(query);
      const response = await wait;
      expect(response.status()).toBe(200);
      const employees: Employee[] = await response.json();
      await assertResults(employees, query);
      return employees;
    };

    // 1. Start fresh with the shared fixture and PermissionsPage; resolve runtime employee identity.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    const initialWait = lookupWait("");
    await permissions.employeeSelectorOpenButton.click();
    const initialResponse = await initialWait;
    expect(initialResponse.status()).toBe(200);
    const initial: Employee[] = await initialResponse.json();
    await assertResults(initial, "");
    const employee = initial.find(item =>
      /^\d+$/.test(String(item.nNit)) && item.scNombre.trim().split(/\s+/).some(token => token.length >= 4));
    expect(employee, "Prerequisite: employee with numeric document and searchable name token").toBeDefined();
    if (!employee) throw new Error("Missing searchable employee prerequisite");
    const document = String(employee.nNit);
    // A single token preserves matching when stored names contain repeated spaces.
    const fragment = employee.scNombre.trim().split(/\s+/).find(token => token.length >= 4)!;

    // 2. Query by runtime document; await the matching encoded lookup and stable visible results.
    const documentResults = await queryEmployees(document);
    expect(documentResults.some(item => item.kaNlTercero === employee.kaNlTercero)).toBe(true);
    for (const item of documentResults) expect(String(item.nNit)).toContain(document);

    // 3. Clear the query, then query a distinctive runtime name fragment and compare returned rows.
    await queryEmployees("");
    const nameResults = await queryEmployees(fragment);
    expect(nameResults.find(item => item.kaNlTercero === employee.kaNlTercero)).toEqual(employee);
    for (const item of nameResults) {
      expect(item.scNombre.toLocaleUpperCase()).toContain(fragment.toLocaleUpperCase());
    }

    // 4. Verify the latest query owns visible results and no employee or history was selected.
    await assertResults(nameResults, fragment);
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeNameValue).toHaveCount(0);
    await expect(permissions.historyRows).toHaveCount(0);
    await expect(permissions.historyEmptyTitle).toHaveText("Sin permisos");
    await expect(permissions.historyEmptyMessage).toHaveText(
      "Busque o seleccione un empleado para consultar sus permisos.");
    await expect(permissions.newButton).toBeDisabled();
    await expect(permissions.saveButton).toBeDisabled();
    await expect(permissions.deleteButton).toBeDisabled();

    // 5. Verify matching queries produce no error dialog, selection request, or permission mutation.
    await expect(errorDialog).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(selections).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
