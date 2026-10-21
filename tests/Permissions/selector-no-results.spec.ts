// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Employee selector and history", () => {
  test("PER-010 — Selector no-results message and recovery", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
    const mutations: string[] = [];
    const selections: string[] = [];
    const navigations: string[] = [];
    page.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith(api + "/")) return;
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
      if (path.startsWith(api + "/empleados/") || path === api + "/rows" ||
          path.startsWith(api + "/rows/")) selections.push(request.url());
    });
    const lookupWait = (query: string) => page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" &&
        url.pathname === api + "/lookups/empleados" &&
        url.searchParams.get("limit") === "2000" && url.searchParams.get("query") === query;
    });
    const emptyState = permissions.employeeSelectorPanel
      .getByTestId("permisos-employee-selector-empty-state");
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const assertResults = async (employees: Employee[]) => {
      expect(Array.isArray(employees)).toBe(true);
      expect(employees.length, "Prerequisite: unfiltered employee lookup must contain employees")
        .toBeGreaterThan(0);
      await expect(permissions.employeeSelectorTable).toBeVisible();
      const visible = employees.slice(0, 10);
      await expect(permissions.employeeSelectorVisibleRows).toHaveCount(visible.length);
      for (const [index, employee] of visible.entries()) {
        await expect(permissions.employeeSelectorVisibleRows.nth(index)).toHaveAttribute(
          "data-testid", `permisos-employee-selector-row--${employee.kaNlTercero}`);
        await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "name"))
          .toHaveText(employee.scNombre.replace(/\s+/g, " ").trim());
        await expect(permissions.employeeSelectorCell(employee.kaNlTercero, "document"))
          .toHaveText(String(employee.nNit));
      }
      await expect(emptyState).toBeHidden();
    };

    // 1. Start a fresh authenticated context with no selected employee.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    page.on("framenavigated", frame => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    const absentQuery = `PER010_NO_MATCH_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // 2. Open the selector, submit an absent query and await its completed lookup and empty state.
    const initialWait = lookupWait("");
    await permissions.employeeSelectorOpenButton.click();
    const initialResponse = await initialWait;
    expect(initialResponse.status()).toBe(200);
    await assertResults(await initialResponse.json());
    const absentWait = lookupWait(absentQuery);
    await permissions.employeeSelectorQueryInput.fill(absentQuery);
    const absentResponse = await absentWait;
    expect(absentResponse.status()).toBe(200);
    expect(await absentResponse.json()).toEqual([]);
    await expect(permissions.employeeSelectorQueryInput).toHaveValue(absentQuery);
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator(".empty-state__title")).toHaveText("Sin resultados");
    await expect(emptyState.locator(".empty-state__subtitle"))
      .toHaveText("No se encontraron empleados para la consulta actual.");
    await expect(permissions.employeeSelectorVisibleRows).toHaveCount(0);
    await expect(errorDialog).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();

    // 3. Clear the query and wait for actual results to return without reloading.
    const restoredWait = lookupWait("");
    await permissions.employeeSelectorQueryInput.fill("");
    const restoredResponse = await restoredWait;
    expect(restoredResponse.status()).toBe(200);
    await assertResults(await restoredResponse.json());
    await expect(permissions.employeeSelectorQueryInput).toHaveValue("");

    // 4. Verify restored rows remain selectable and no employee or history was selected.
    await expect(permissions.employeeSelectorHeading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeNameValue).toHaveCount(0);
    await expect(permissions.historyRows).toHaveCount(0);
    await expect(permissions.historyEmptyTitle).toHaveText("Sin permisos");
    await expect(permissions.historyEmptyMessage)
      .toHaveText("Busque o seleccione un empleado para consultar sus permisos.");
    await expect(permissions.newButton).toBeDisabled();
    await expect(permissions.saveButton).toBeDisabled();
    await expect(permissions.deleteButton).toBeDisabled();
    expect(navigations).toEqual([]);

    // 5. Verify no error dialog, employee selection, or permission mutation occurred.
    await expect(errorDialog).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(selections).toEqual([]);
    expect(mutations).toEqual([]);
  });
});
