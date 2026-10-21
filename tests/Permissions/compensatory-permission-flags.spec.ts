// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: string | number; scNombre: string };

test.describe("New form, flags and required validation", () => {
  test("PER-016 Compensatory and permission transitions", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });

    // 1. Start a fresh authenticated context, select a runtime employee and click New.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const lookupWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/lookups/empleados" &&
      new URL(response.url()).searchParams.get("limit") === "2000");
    await permissions.employeeSelectorOpenButton.click();
    const lookupResponse = await lookupWait;
    expect(lookupResponse.status()).toBe(200);
    const employees: Employee[] = await lookupResponse.json();
    expect(employees.length, "Prerequisite: an existing employee is required").toBeGreaterThan(0);
    const firstRow = permissions.employeeSelectorVisibleRows.first();
    await expect(firstRow).toBeVisible();
    const rowId = await firstRow.getAttribute("data-testid");
    const employee = employees.find(item =>
      rowId === "permisos-employee-selector-row--" + item.kaNlTercero);
    if (!employee) throw new Error("Prerequisite: visible employee must match runtime lookup");
    const historyWait = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" && url.pathname === api + "/rows" &&
        url.searchParams.get("kaNlTercero") === String(employee.kaNlTercero) &&
        url.searchParams.get("limit") === "200" && url.searchParams.get("calamidad") === "N";
    });
    await firstRow.dblclick();
    const historyResponse = await historyWait;
    expect(historyResponse.status()).toBe(200);
    const history: { kaNlDato: number; kaNlEmpleado: number }[] = await historyResponse.json();
    for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
    await expect(permissions.historyRows).toHaveCount(history.length);
    await expect(permissions.employeeDocumentInput).toHaveValue(String(employee.nNit));
    await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    await permissions.newButton.click();
    const historyBefore = await permissions.historyRows.allTextContents();
    const rowIdsBefore = await permissions.historyRows.evaluateAll(rows =>
      rows.map(row => row.getAttribute("data-testid")));--HERE--
    const assertPair = async (compensatory: boolean, permission: boolean) => {
      expect(compensatory && permission, "Both Yes choices must never coexist").toBe(false);
      await expect(permissions.compensatoryYesCheckbox).toBeChecked({ checked: compensatory });
      await expect(permissions.compensatoryNoCheckbox).toBeChecked({ checked: !compensatory });
      await expect(permissions.permissionYesCheckbox).toBeChecked({ checked: permission });
      await expect(permissions.permissionNoCheckbox).toBeChecked({ checked: !permission });
      await expect(permissions.approvedYesCheckbox).not.toBeChecked();
      await expect(permissions.approvedNoCheckbox).toBeChecked();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      await expect(page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Error", exact: true }),
      })).toBeHidden();
      // The employee selector remains mounted independently of flag transitions.
      await expect(page.getByRole("dialog").filter({ visible: true }).filter({
        hasNot: page.getByTestId("permisos-employee-selector-close-button"),
      })).toHaveCount(0);
    };
    await assertPair(false, true);

    // 2. Check compensatory Yes; verify compensatory No and permission Yes clear.
    await permissions.compensatoryYesCheckbox.check();
    await assertPair(true, false);

    // 3. Exercise compensatory No and permission Yes/No explicitly, covering all permitted pairs.
    await permissions.compensatoryNoCheckbox.check();
    await assertPair(false, false);
    await permissions.permissionYesCheckbox.check();
    await assertPair(false, true);
    await permissions.permissionNoCheckbox.check();
    await assertPair(false, false);

    // 4. Attempt permission Yes after compensatory Yes and verify automatic mutual exclusion.
    await permissions.compensatoryYesCheckbox.check();
    await assertPair(true, false);
    await permissions.permissionYesCheckbox.check();
    await assertPair(false, true);

    // 5. Verify final draft actions, employee and history without saving.
    await expect(permissions.newButton).toBeEnabled();
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(permissions.employeeDocumentInput).toHaveValue(String(employee.nNit));
    await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);
    expect(await permissions.historyRows.evaluateAll(rows =>
      rows.map(row => row.getAttribute("data-testid")))).toEqual(rowIdsBefore);
    await expect(permissions.historyTable.locator("tr.selected")).toHaveCount(0);

    // 6. Verify no error/incompatibility dialog and no permission record mutation.
    await assertPair(false, true);
    expect(mutations, "Unsaved flag transitions must not mutate permission records").toEqual([]);
  });
});
