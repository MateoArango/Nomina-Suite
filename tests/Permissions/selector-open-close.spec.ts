// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Employee selector and history", () => {
  test("PER-008 — Open and close employee selector", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    const selectionRequests: string[] = [];
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith(api + "/")) return;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
      if (path.startsWith(api + "/empleados/") || path === api + "/rows" ||
          path.startsWith(api + "/rows/")) {
        selectionRequests.push(request.url());
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const assertUnselected = async () => {
      await expect(permissions.employeeDocumentInput).toHaveValue("");
      await expect(permissions.employeeNameValue).toHaveCount(0);
      await expect(permissions.historyRows).toHaveCount(0);
      await expect(permissions.historyEmptyTitle).toHaveText("Sin permisos");
      await expect(permissions.historyEmptyMessage).toHaveText(
        "Busque o seleccione un empleado para consultar sus permisos.");
      await expect(permissions.newButton).toBeDisabled();
      await expect(permissions.saveButton).toBeDisabled();
      await expect(permissions.deleteButton).toBeDisabled();
    };
    const openSelector = async () => {
      const lookupWait = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === "GET" &&
          url.pathname === api + "/lookups/empleados" &&
          url.searchParams.get("limit") === "2000" &&
          url.searchParams.get("query") === "";
      });
      await permissions.employeeSelectorOpenButton.click();
      const response = await lookupWait;
      expect(response.status()).toBe(200);
      const employees: { kaNlTercero: number; nNit: number | string; scNombre: string }[] =
        await response.json();
      expect(Array.isArray(employees)).toBe(true);
      expect(employees.length, "Prerequisite: employee lookup must contain existing employees").toBeGreaterThan(0);
      await expect(permissions.employeeSelectorHeading).toBeVisible();
      await expect(permissions.employeeSelectorQueryInput).toBeVisible();
      await expect(permissions.employeeSelectorQueryInput).toBeEnabled();
      await expect(permissions.employeeSelectorQueryInput).toHaveValue("");
      await expect(permissions.employeeSelectorColumnHeaders).toHaveText([
        "Nombre completo", "CC/NIT", "Estado", "Tipo Empleado",
      ]);
      await expect(permissions.employeeSelectorVisibleRows).toHaveCount(Math.min(10, employees.length));
      const first = employees[0];
      await expect(permissions.employeeSelectorRow(first.kaNlTercero)).toBeVisible();
      await expect(permissions.employeeSelectorCell(first.kaNlTercero, "name"))
        .toHaveText(first.scNombre.replace(/\s+/g, " ").trim());
      await expect(permissions.employeeSelectorCell(first.kaNlTercero, "document"))
        .toHaveText(String(first.nNit));
      await expect(errorDialog).toBeHidden();
      await expect(page.getByRole("alertdialog")).toBeHidden();
    };

    // 1. Start fresh using the shared fixture and PermissionsPage, without a selected employee.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.employeeSelectorOpenButton).toBeEnabled();
    await expect(permissions.employeeSelectorQueryInput).toBeHidden();
    await assertUnselected();

    // 2. Open the selector; wait for the current employee lookup and stable panel content.
    await openSelector();
    await assertUnselected();

    // 3. Assert query input and headers, close through the close control, and reopen.
    await permissions.employeeSelectorCloseButton.click();
    await expect(permissions.employeeSelectorQueryInput).toBeHidden();
    await expect(permissions.employeeSelectorTable).toBeHidden();
    await assertUnselected();
    await openSelector();
    await assertUnselected();

    // 4. Verify closing leaves employee/history untouched and search controls usable.
    await permissions.employeeSelectorCloseButton.click();
    await expect(permissions.employeeSelectorQueryInput).toBeHidden();
    await expect(permissions.employeeSelectorTable).toBeHidden();
    await assertUnselected();
    await expect(permissions.employeeDocumentInput).toBeEnabled();
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.employeeSelectorOpenButton).toBeEnabled();

    // 5. Verify no error dialog, employee/history selection request, or permission mutation.
    await expect(errorDialog).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(selectionRequests).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
