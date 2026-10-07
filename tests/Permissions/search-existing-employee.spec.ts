// spec: tests/Permissions/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string; scDescripcion: string; aprobada: string };

test.describe("Initial state and employee search", () => {
  test("PER-002 — Search an existing employee by document", async ({ page }) => {
    const permissionsPage = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });

    // 1. Start a fresh authenticated context and resolve an existing document from lookup data.
    await permissionsPage.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissionsPage.heading).toBeVisible();
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.newButton).toBeDisabled();
    const lookupWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/lookups/empleados");
    await permissionsPage.employeeSelectorOpenButton.click();
    const lookupResponse = await lookupWait;
    expect(lookupResponse.status()).toBe(200);
    const employees: Employee[] = await lookupResponse.json();
    expect(employees.length, "Prerequisite: existing employees must be available").toBeGreaterThan(0);
    await expect(permissionsPage.employeeSelectorVisibleRows.first()).toBeVisible();
    const document = (await permissionsPage.employeeSelectorVisibleRows.first()
      .getByRole("cell").nth(1).innerText()).trim();
    const candidate = employees.find(employee => String(employee.nNit) === document);
    expect(candidate, "Prerequisite: visible document must exist in lookup response").toBeDefined();
    await permissionsPage.employeeSelectorCloseButton.click();
    await expect(permissionsPage.employeeSelectorTable).toBeHidden();
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.newButton).toBeDisabled();

    // 2. Arm document lookup and history waits, fill the document and click Search.
    const employeeWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + document);
    const historyWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/rows" &&
      new URL(response.url()).searchParams.get("kaNlTercero") === String(candidate!.kaNlTercero));
    await permissionsPage.employeeDocumentInput.fill(document);
    await permissionsPage.employeeSearchButton.click();
    const employeeResponse = await employeeWait;
    const historyResponse = await historyWait;

    // 3. Match runtime employee identity and the history query contract.
    expect(employeeResponse.status()).toBe(200);
    const employee: Employee = await employeeResponse.json();
    expect(employee.kaNlTercero).toBe(candidate!.kaNlTercero);
    expect(String(employee.nNit)).toBe(document);
    expect(employee.scNombre).toBe(candidate!.scNombre);
    expect(historyResponse.status()).toBe(200);
    const historyUrl = new URL(historyResponse.url());
    expect(historyUrl.searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
    expect(historyUrl.searchParams.get("limit")).toBe("200");
    expect(historyUrl.searchParams.get("calamidad")).toBe("N");
    const history: HistoryRow[] = await historyResponse.json();
    for (const row of history) {
      expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      expect(String(row.nNit)).toBe(document);
    }

    // 4. Assert employee identity, history and record-dependent action states.
    await expect(permissionsPage.employeeDocumentInput).toHaveValue(document);
    await expect(permissionsPage.employeeNameValue).toHaveText(employee.scNombre);
    await expect(permissionsPage.newButton).toBeEnabled();
    if (history.length === 0) {
      await expect(permissionsPage.historyRows).toHaveCount(0);
      await expect(permissionsPage.saveButton).toBeEnabled();
      await expect(permissionsPage.deleteButton).toBeDisabled();
      await expect(permissionsPage.descriptionInput).toHaveValue("");
    } else {
      await expect(permissionsPage.historyTable).toBeVisible();
      await expect(permissionsPage.historyRows).toHaveCount(history.length);
      for (const row of history.slice(0, 10)) {
        await expect(permissionsPage.historyRow(row.kaNlDato)).toBeVisible();
        await expect(permissionsPage.historyRow(row.kaNlDato).getByRole("cell").nth(1))
          .toHaveText(row.scNombre);
      }
      const selectedRow = permissionsPage.historyTable.locator('tr.selected[data-testid^="permisos-table-row--"]');
      await expect(selectedRow).toHaveCount(1);
      const selectedId = await selectedRow
        .getAttribute("data-testid");
      const record = history.find(row => selectedId === "permisos-table-row--" + row.kaNlDato);
      expect(record, "Selected detail must belong to returned history").toBeDefined();
      await expect(permissionsPage.descriptionInput).toHaveValue(record!.scDescripcion);
      await expect(permissionsPage.saveButton).toBeEnabled({ enabled: record!.aprobada !== "S" });
      await expect(permissionsPage.deleteButton).toBeEnabled({ enabled: record!.aprobada !== "S" });
    }

    // 5. Verify message behavior and prove no permission mutation request occurred.
    if (history.length === 0) {
      await expect(permissionsPage.historyEmptyTitle).toHaveText("Sin permisos");
      await expect(permissionsPage.historyEmptyMessage).toHaveText(
        "Busque o seleccione un empleado para consultar sus permisos.");
    } else {
      await expect(permissionsPage.historyEmptyState).toBeHidden();
    }
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "Employee search must not create, update or delete permissions").toEqual([]);
  });
});
