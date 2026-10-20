// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
type HistoryRow = {
  kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string;
  ddDesde: string; ddHasta: string; scDescripcion: string;
  scCompensatorio: string; scPermiso: string; aprobada: string;
};

test.describe("Initial state and employee search", () => {
  test("PER-007 — Switch employees without stale history", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const selectedRow = permissions.historyTable.locator('tr.selected[data-testid^="permisos-table-row--"]');
    const search = async (document: string) => {
      const employeeWait = page.waitForResponse(response =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + document);
      const historyWait = page.waitForResponse(response =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === api + "/rows");
      await permissions.employeeDocumentInput.fill(document);
      await permissions.employeeSearchButton.click();
      const employeeResponse = await employeeWait;
      expect(employeeResponse.status(), "Prerequisite: supplied employee must exist").toBe(200);
      const employee: Employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe(document);
      const historyResponse = await historyWait;
      expect(historyResponse.status()).toBe(200);
      const url = new URL(historyResponse.url());
      expect(url.searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(url.searchParams.get("limit")).toBe("200");
      expect(url.searchParams.get("calamidad")).toBe("N");
      const history: HistoryRow[] = await historyResponse.json();
      for (const row of history) {
        expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
        expect(String(row.nNit)).toBe(document);
        expect(row.scNombre).toBe(employee.scNombre);
      }
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      await expect(errorDialog).toBeHidden();
      await expect(page.getByRole("alertdialog")).toBeHidden();
      return { employee, history };
    };
    const assertDetail = async (record: HistoryRow) => {
      const date = (value: string) => value.slice(0, 10).split("-").reverse().join("/");
      await expect(permissions.descriptionInput).toHaveValue(record.scDescripcion);
      await expect(permissions.startDateInput).toHaveValue(date(record.ddDesde));
      await expect(permissions.endDateInput).toHaveValue(date(record.ddHasta));
      await expect(permissions.compensatoryYesCheckbox).toBeChecked({ checked: record.scCompensatorio === "S" });
      await expect(permissions.compensatoryNoCheckbox).toBeChecked({ checked: record.scCompensatorio !== "S" });
      await expect(permissions.permissionYesCheckbox).toBeChecked({ checked: record.scPermiso === "S" });
      await expect(permissions.permissionNoCheckbox).toBeChecked({ checked: record.scPermiso !== "S" });
      await expect(permissions.approvedYesCheckbox).toBeChecked({ checked: record.aprobada === "S" });
      await expect(permissions.approvedNoCheckbox).toBeChecked({ checked: record.aprobada !== "S" });
      await expect(permissions.saveButton).toBeEnabled({ enabled: record.aprobada !== "S" });
      await expect(permissions.deleteButton).toBeEnabled({ enabled: record.aprobada !== "S" });
    };

    // 1. Start a fresh authenticated context, construct PermissionsPage and open the read-only scenario.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    await expect(permissions.newButton).toBeDisabled();
    await expect(permissions.saveButton).toBeDisabled();
    await expect(permissions.deleteButton).toBeDisabled();
    const initialDate = await permissions.startDateInput.inputValue();

    // 2. Search the first employee and read its history/key.
    const first = await search("43433798");
    expect(first.history.length, "Prerequisite: first employee needs history to detect stale selection").toBeGreaterThan(0);
    await expect(selectedRow).toHaveCount(1);
    const firstSelectedId = await selectedRow.getAttribute("data-testid");
    const firstRecord = first.history.find(row => firstSelectedId === "permisos-table-row--" + row.kaNlDato);
    expect(firstRecord, "Selected first detail must belong to the first employee").toBeDefined();
    await assertDetail(firstRecord!);

    // 3. Search the second employee and wait for its identity/history requests; inspect selected detail.
    const second = await search("43442343");
    expect(second.employee.kaNlTercero).not.toBe(first.employee.kaNlTercero);
    expect(second.employee.scNombre).not.toBe(first.employee.scNombre);
    expect(second.history.map(row => row.kaNlDato)).not.toEqual(first.history.map(row => row.kaNlDato));

    // 4. Assert the second identity, history, selected detail and corresponding actions replace the first.
    await expect(permissions.employeeDocumentInput).toHaveValue(String(second.employee.nNit));
    await expect(permissions.newButton).toBeEnabled();
    for (const row of first.history) {
      await expect(permissions.historyRow(row.kaNlDato)).toHaveCount(0);
    }
    if (second.history.length) {
      await expect(permissions.historyTable).toBeVisible();
      expect(await permissions.historyRows.evaluateAll(rows => rows.map(row => row.getAttribute("data-testid")).sort()))
        .toEqual(second.history.map(row => "permisos-table-row--" + row.kaNlDato).sort());
      await expect(selectedRow).toHaveCount(1);
      const secondSelectedId = await selectedRow.getAttribute("data-testid");
      const record = second.history.find(row => secondSelectedId === "permisos-table-row--" + row.kaNlDato);
      expect(record, "Selected detail must belong to the second employee").toBeDefined();
      await assertDetail(record!);
      await expect(permissions.historyEmptyState).toBeHidden();
    } else {
      await expect(selectedRow).toHaveCount(0);
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.administrativeActInput).toHaveValue("");
      const currentDate = await permissions.startDateInput.inputValue();
      expect(currentDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      if (initialDate) expect(currentDate).toBe(initialDate);
      await expect(permissions.endDateInput).toHaveValue(currentDate);
      await expect(permissions.administrativeActDateInput).toHaveValue(currentDate);
      await expect(permissions.compensatoryNoCheckbox).toBeChecked();
      await expect(permissions.compensatoryYesCheckbox).not.toBeChecked();
      await expect(permissions.permissionYesCheckbox).toBeChecked();
      await expect(permissions.permissionNoCheckbox).not.toBeChecked();
      await expect(permissions.approvedNoCheckbox).toBeChecked();
      await expect(permissions.approvedYesCheckbox).not.toBeChecked();
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
    }

    // 5. Check message behavior and confirm no permission record was created, updated or deleted.
    if (!second.history.length) {
      await expect(permissions.historyEmptyTitle).toHaveText("Sin permisos");
      await expect(permissions.historyEmptyMessage).toHaveText(
        "Busque o seleccione un empleado para consultar sus permisos.");
    }
    await expect(errorDialog).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "Switching employees must remain read-only").toEqual([]);
  });
});
