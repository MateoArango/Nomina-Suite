// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; ddHasta: string };

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });

  test("PER-026 — Whitespace-only description", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const requests: string[] = [];
    const mutations: string[] = [];
    page.on("request", request => {
      if (!new URL(request.url()).pathname.startsWith(api + "/")) return;
      const entry = request.method() + " " + request.url();
      requests.push(entry);
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(entry);
    });
    // Protect shared QA if local required validation regresses.
    await page.route("**" + api + "/**", async route => {
      if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.continue();
      } else {
        await route.abort("blockedbyclient");
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const searchEmployee = async () => {
      const employeeWait = page.waitForResponse(response =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === api + "/empleados/by-nitsd/43442343");
      const historyWait = page.waitForResponse(response => {
        const url = new URL(response.url());
        return response.request().method() === "GET" && url.pathname === api + "/rows" &&
          url.searchParams.get("limit") === "200" && url.searchParams.get("calamidad") === "N";
      });
      await permissions.employeeDocumentInput.fill("43442343");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe("43442343");
      expect(new URL(historyResponse.url()).searchParams.get("kaNlTercero"))
        .toBe(String(employee.kaNlTercero));
      const history: HistoryRow[] = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      await expect(permissions.employeeSelectorTable).toBeHidden();
      return { employee, history };
    };
    const readDetails = async (history: HistoryRow[]) => {
      const details = new Map<number, unknown>();
      for (const row of history) {
        // Pagination may hide otherwise mounted rows.
        if (!(await permissions.historyRow(row.kaNlDato).isVisible())) {
          await permissions.historyPageSizeButton(100).click();
          while (!(await permissions.historyRow(row.kaNlDato).isVisible())) {
            await expect(permissions.historyNextPageButton).toBeEnabled();
            await permissions.historyNextPageButton.click();
          }
        }
        const detailWait = page.waitForResponse(response =>
          response.request().method() === "GET" &&
          new URL(response.url()).pathname === api + "/rows/" + row.kaNlDato);
        await permissions.historyRow(row.kaNlDato).click();
        const response = await detailWait;
        expect(response.status()).toBe(200);
        const detail = await response.json();
        expect(detail.kaNlPermiso).toBe(row.kaNlDato);
        expect(detail.kaNlEmpleado).toBe(row.kaNlEmpleado);
        details.set(row.kaNlDato, detail);
      }
      return details;
    };

    // 1. Start fresh, select an existing employee and prepare a conflict-free valid draft.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const { employee, history } = await searchEmployee();
    const originalDetails = await readDetails(history);
    await permissions.newButton.click();
    const today = await permissions.startDateInput.inputValue();
    expect(today).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const [day, month, year] = today.split("/").map(Number);
    const historyDates = history.map(row => Date.parse(row.ddHasta));
    for (const timestamp of historyDates) expect(Number.isFinite(timestamp)).toBe(true);
    const latest = Math.max(Date.UTC(year, month - 1, day), ...historyDates);
    const date = new Date(latest + 86400000).toISOString().slice(0, 10).split("-").reverse().join("/");
    for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.descriptionInput.fill("PER-026 valid draft");
    await permissions.administrativeActInput.fill("1");
    await expect(permissions.administrativeActInput).toHaveValue("1");
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();
    const historyBefore = await permissions.historyRows.allTextContents();

    // 2. Enter spaces only, blur and attempt Save under controlled conditions.
    const whitespace = " ".repeat(5);
    await permissions.descriptionInput.fill(whitespace);
    await expect(permissions.descriptionInput).toHaveValue(whitespace);
    await permissions.descriptionInput.press("Tab");
    await expect(permissions.descriptionInput).toHaveValue(whitespace);
    await expect(permissions.saveButton).toBeEnabled();
    const beforeSave = requests.length;
    await permissions.saveButton.click();

    // 3. Inspect trimming and the exact validation response before dismissal.
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.getByRole("heading")).toHaveText("Error");
    await expect(errorDialog.getByText("Debe ingresar la Descripcion.", { exact: true })).toBeVisible();
    await expect(permissions.descriptionInput).toHaveValue(whitespace);
    expect(requests.slice(beforeSave), "Whitespace is rejected locally without a Permissions request").toEqual([]);
    await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
    await expect(errorDialog).toBeHidden();

    // 4. Verify the unsaved draft and reload to compare complete history and existing details.
    await expect(permissions.descriptionInput).toHaveValue(whitespace);
    await expect(permissions.startDateInput).toHaveValue(date);
    await expect(permissions.endDateInput).toHaveValue(date);
    await expect(permissions.administrativeActDateInput).toHaveValue(date);
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyBefore);
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    const readback = await searchEmployee();
    expect(readback.employee.kaNlTercero).toBe(employee.kaNlTercero);
    expect(readback.history).toEqual(history);
    expect(await readDetails(readback.history)).toEqual(originalDetails);

    // 5. Verify continued usability and that no permission record was created, updated or deleted.
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await permissions.newButton.click();
    await expect(permissions.descriptionInput).toHaveValue("");
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(errorDialog).toBeHidden();
    expect(mutations, "Whitespace-only description must never mutate permission records").toEqual([]);
  });
});
