// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type HistoryRow = {
  kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string;
  ddDesde: string; ddHasta: string; scDescripcion: string;
  scCompensatorio: string; scPermiso: string; aprobada: string;
};
type Detail = Omit<HistoryRow, "kaNlDato" | "nNit" | "scNombre"> & {
  kaNlPermiso: number; ndActoAdministrativo: number | string | null;
  ddActoAdministrativo: string | null;
};

test.describe("Employee selector and history", () => {
  test("PER-013 — History columns and selected-row detail", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });
    const displayDate = (value: string | null) => {
      if (value === null) return "";
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      return value.split("-").reverse().join("/");
    };

    // 1. Start a fresh authenticated context and search the supplied employee with existing history.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const document = "43433798";
    const employeeWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + document);
    const historyWait = page.waitForResponse(response =>
      response.request().method() === "GET" && new URL(response.url()).pathname === api + "/rows");
    await permissions.employeeDocumentInput.fill(document);
    await permissions.employeeSearchButton.click();
    const employeeResponse = await employeeWait;
    expect(employeeResponse.status(), "Prerequisite: supplied employee must exist").toBe(200);
    const employee: { kaNlTercero: number; nNit: number | string; scNombre: string } =
      await employeeResponse.json();
    expect(String(employee.nNit)).toBe(document);
    const historyResponse = await historyWait;
    expect(historyResponse.status()).toBe(200);
    const historyUrl = new URL(historyResponse.url());
    expect(historyUrl.searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
    expect(historyUrl.searchParams.get("limit")).toBe("200");
    expect(historyUrl.searchParams.get("calamidad")).toBe("N");
    const history: HistoryRow[] = await historyResponse.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length, "Prerequisite: employee must have at least one permission row").toBeGreaterThan(0);

    // 2. Verify seven history columns and disabled status indicators using runtime row identities.
    await expect(permissions.historyTable.getByRole("columnheader")).toHaveText([
      "Aprobada", "Empleado", "Desde", "Hasta", "Descripción", "Compensatorio", "Días",
    ]);
    const visibleRows = permissions.historyRows.filter({ visible: true });
    await expect(visibleRows.first()).toBeVisible();
    const visibleCount = await visibleRows.count();
    expect(visibleCount).toBeGreaterThan(0);
    for (let index = 0; index < visibleCount; index++) {
      const row = visibleRows.nth(index);
      const testId = await row.getAttribute("data-testid");
      const record = history.find(item => testId === "permisos-table-row--" + item.kaNlDato);
      expect(record, "Rendered history row must match the response").toBeDefined();
      if (!record) throw new Error("Missing runtime history row");
      expect(record.kaNlEmpleado).toBe(employee.kaNlTercero);
      expect(String(record.nNit)).toBe(document);
      const cells = row.getByRole("cell");
      await expect(cells).toHaveCount(7);
      await expect(cells.nth(1)).toHaveText(record.scNombre);
      await expect(cells.nth(2)).toHaveText(displayDate(record.ddDesde));
      await expect(cells.nth(3)).toHaveText(displayDate(record.ddHasta));
      await expect(cells.nth(4)).toHaveText(record.scDescripcion);
      const days = (Date.parse(record.ddHasta) - Date.parse(record.ddDesde)) / 86_400_000 + 1;
      await expect(cells.nth(6)).toHaveText(String(days));
      for (const [column, flag] of [[0, record.aprobada], [5, record.scCompensatorio]] as const) {
        expect(["S", "N"]).toContain(flag);
        const indicator = cells.nth(column).locator('input[type="checkbox"]');
        await expect(indicator).toHaveCount(1);
        await expect(indicator).toBeDisabled();
        await expect(indicator).toBeChecked({ checked: flag === "S" });
      }
    }

    // 3. Arm the runtime detail GET before clicking the row and compare every detail field.
    const selectedTestId = await visibleRows.first().getAttribute("data-testid");
    const selected = history.find(item => selectedTestId === "permisos-table-row--" + item.kaNlDato);
    if (!selected) throw new Error("Prerequisite: visible history record must exist in response");
    const detailWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/rows/" + selected.kaNlDato);
    const selectedRow = permissions.historyRow(selected.kaNlDato);
    await selectedRow.click();
    const detailResponse = await detailWait;
    expect(detailResponse.status()).toBe(200);
    const detail: Detail = await detailResponse.json();
    expect(detail.kaNlPermiso).toBe(selected.kaNlDato);
    expect(detail.kaNlEmpleado).toBe(employee.kaNlTercero);
    for (const field of ["ddDesde", "ddHasta", "scDescripcion", "scCompensatorio", "scPermiso", "aprobada"] as const) {
      expect(detail[field]).toBe(selected[field]);
    }
    await expect(permissions.startDateInput).toHaveValue(displayDate(detail.ddDesde));
    await expect(permissions.endDateInput).toHaveValue(displayDate(detail.ddHasta));
    await expect(permissions.descriptionInput).toHaveValue(detail.scDescripcion);
    await expect(permissions.administrativeActInput).toHaveValue(String(detail.ndActoAdministrativo ?? ""));
    await expect(permissions.administrativeActDateInput).toHaveValue(displayDate(detail.ddActoAdministrativo));
    for (const [yes, no, flag] of [
      [permissions.compensatoryYesCheckbox, permissions.compensatoryNoCheckbox, detail.scCompensatorio],
      [permissions.permissionYesCheckbox, permissions.permissionNoCheckbox, detail.scPermiso],
      [permissions.approvedYesCheckbox, permissions.approvedNoCheckbox, detail.aprobada],
    ] as const) {
      expect(["S", "N"]).toContain(flag);
      await expect(yes).toBeChecked({ checked: flag === "S" });
      await expect(no).toBeChecked({ checked: flag === "N" });
    }

    // 4. Verify the selected row and employee identity remain consistent with the responses.
    await expect(selectedRow).toHaveClass(/\bselected\b/);
    await expect(permissions.historyTable.locator("tr.selected")).toHaveCount(1);
    await expect(permissions.employeeDocumentInput).toHaveValue(String(employee.nNit));
    await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    await expect(permissions.historyEmptyState).toBeHidden();

    // 5. Verify no error dialog or permission record mutation occurred.
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "History selection must not create, update or delete permissions").toEqual([]);
  });
});
