// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type HistoryRow = {
  kaNlDato: number; kaNlEmpleado: number; nNit: string | number;
  ddDesde: string; ddHasta: string; scDescripcion: string; aprobada: string;
};
type Detail = {
  kaNlPermiso: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string;
  scDescripcion: string; aprobada: string; scCompensatorio: string; scPermiso: string;
  ndActoAdministrativo: string | number | null; ddActoAdministrativo: string | null;
};

test.describe("Persistence and approved protection", () => {
  test("PER-036 — Cancel deletion preserves an unapproved record", async ({ page }, testInfo) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const document = "70324693";
    const mutations: string[] = [];
    // Fail closed if Delete ever bypasses confirmation; preserve the supplied existing fixture.
    await page.route("**/api/v1/w-vacaciones-licencias-ascensos-permisos/**", async route => {
      const request = route.request();
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
        await route.abort();
      } else await route.continue();
    });
    const date = (value: string | null) => value ? value.split("-").reverse().join("/") : "";
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/empleados/by-nitsd/" + document);
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows");
      await permissions.employeeDocumentInput.fill(document);
      await permissions.employeeSearchButton.click();
      const employeeResponse = await employeeWait;
      expect(employeeResponse.status()).toBe(200);
      const employee: { kaNlTercero: number; nNit: number | string; scNombre: string } = await employeeResponse.json();
      expect(String(employee.nNit)).toBe(document);
      const historyResponse = await historyWait;
      expect(historyResponse.status()).toBe(200);
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("calamidad")).toBe("N");
      const history: HistoryRow[] = await historyResponse.json();
      expect(Array.isArray(history)).toBe(true);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.employeeDocumentInput).toHaveValue(document);
      return { employee, history };
    };
    const select = async (row: HistoryRow) => {
      while (!(await permissions.historyRow(row.kaNlDato).isVisible())) {
        expect(await permissions.historyNextPageButton.isEnabled(), "Fixture row must be reachable").toBe(true);
        await permissions.historyNextPageButton.click();
      }
      const detailWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows/" + row.kaNlDato);
      await permissions.historyRow(row.kaNlDato).click();
      const response = await detailWait;
      expect(response.status()).toBe(200);
      const detail: Detail = await response.json();
      expect(detail.kaNlPermiso).toBe(row.kaNlDato);
      expect(detail.kaNlEmpleado).toBe(row.kaNlEmpleado);
      for (const field of ["ddDesde", "ddHasta", "scDescripcion", "aprobada"] as const) {
        expect(detail[field]).toBe(row[field]);
      }
      return detail;
    };
    const verifyDetail = async (row: HistoryRow, detail: Detail) => {
      await expect(permissions.historyRow(row.kaNlDato)).toHaveClass(/\bselected\b/);
      for (const [input, value] of [
        [permissions.startDateInput, date(detail.ddDesde)],
        [permissions.endDateInput, date(detail.ddHasta)],
        [permissions.descriptionInput, detail.scDescripcion],
        [permissions.administrativeActInput, String(detail.ndActoAdministrativo ?? "")],
        [permissions.administrativeActDateInput, date(detail.ddActoAdministrativo)],
      ] as const) await expect(input).toHaveValue(value);
      for (const [yes, no, flag] of [
        [permissions.compensatoryYesCheckbox, permissions.compensatoryNoCheckbox, detail.scCompensatorio],
        [permissions.permissionYesCheckbox, permissions.permissionNoCheckbox, detail.scPermiso],
        [permissions.approvedYesCheckbox, permissions.approvedNoCheckbox, detail.aprobada],
      ] as const) {
        expect(["S", "N"]).toContain(flag);
        await expect(yes).toBeChecked({ checked: flag === "S" });
        await expect(no).toBeChecked({ checked: flag === "N" });
      }
      await expect(permissions.deleteButton).toBeEnabled();
    };

    // 1. Start fresh, directly search the supplied employee and snapshot the exact existing fixture.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.historyRows).toHaveCount(0);
    const baseline = await search();
    const matches = baseline.history.filter(row =>
      row.ddDesde === "2026-01-06" && row.scDescripcion === "per-036");
    expect(matches, "Prerequisite: exactly one supplied per-036 record dated 06/01/2026").toHaveLength(1);
    const row = matches[0];
    expect(row.aprobada, "Prerequisite: supplied record is unapproved").toBe("N");
    expect(row.kaNlEmpleado).toBe(baseline.employee.kaNlTercero);
    expect(String(row.nNit)).toBe(document);

    // 2. Select the runtime row and inspect confirmation before any destructive action.
    const detail = await select(row);
    await verifyDetail(row, detail);
    await permissions.deleteButton.click();
    const confirmation = page.getByTestId("permisos-dialog-delete-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("heading")).toHaveText("Atención");
    await expect(confirmation).toContainText("¿Desea eliminar el registro seleccionado?");
    await expect(confirmation.getByRole("button")).toHaveText(["Si", "No"]);
    expect(mutations, "Opening confirmation must not dispatch a mutation").toEqual([]);
    await testInfo.attach("delete-confirmation", {
      body: JSON.stringify({ rowId: row.kaNlDato, text: await confirmation.innerText() }),
      contentType: "application/json",
    });

    // 3. Cancel and reload history/details without confirming deletion.
    await confirmation.getByRole("button", { name: "No", exact: true }).click();
    await expect(confirmation).toBeHidden();
    await verifyDetail(row, detail);
    await expect(page.getByRole("dialog").filter({
      hasNot: page.getByTestId("permisos-employee-selector-close-button"),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const reloaded = await search();

    // 4. Assert identical complete history, runtime record identity, detail and no mutation.
    expect(reloaded).toEqual(baseline);
    expect(reloaded.history.filter(candidate => candidate.kaNlDato === row.kaNlDato)).toEqual([row]);
    const persistedDetail = await select(row);
    expect(persistedDetail).toEqual(detail);
    await verifyDetail(row, persistedDetail);
    expect(mutations, "Cancel must dispatch no DELETE or other permission mutation").toEqual([]);

    // 5. No deletion success message; preserve the supplied fixture without cleanup.
    await expect(confirmation).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(page.getByRole("dialog").filter({
      hasNot: page.getByTestId("permisos-employee-selector-close-button"),
    })).toBeHidden();
  });
});
