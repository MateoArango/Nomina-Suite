// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-022 — Administrative act date after start", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const requests: string[] = [];
    const mutations: string[] = [];
    page.on("request", request => {
      if (!request.url().includes(api + "/")) return;
      requests.push(request.method() + " " + request.url());
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
        mutations.push(request.method() + " " + request.url());
    });
    // Guard shared QA against an unexpected acceptance.
    await page.route("**" + api + "/**", async route => {
      if (["GET", "HEAD", "OPTIONS"].includes(route.request().method())) await route.continue();
      else await route.abort("blockedbyclient");
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });

    // 1. Start fresh, select employee 43442343 and prepare a valid new draft.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const searchEmployee = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/empleados/by-nitsd/43442343"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().includes(api + "/rows?"));
      await permissions.employeeDocumentInput.fill("43442343");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe("43442343");
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("limit")).toBe("200");
      expect(query.get("calamidad")).toBe("N");
      const history = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history };
    };
    const { employee, history } = await searchEmployee();
    const historyText = await permissions.historyRows.allTextContents();
    await permissions.newButton.click();
    const today = await permissions.startDateInput.inputValue();
    expect(today).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    const [day, month, year] = today.split("/").map(Number);
    let latest = Date.UTC(year, month - 1, day);
    for (const row of history) {
      for (const value of Object.values(row)) {
        if (typeof value !== "string") continue;
        const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(value);
        const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
        if (iso) latest = Math.max(latest, Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
        if (local) latest = Math.max(latest, Date.UTC(+local[3], +local[2] - 1, +local[1]));
      }
    }
    const format = (timestamp: number) => {
      const date = new Date(timestamp);
      return [String(date.getUTCDate()).padStart(2, "0"),
        String(date.getUTCMonth() + 1).padStart(2, "0"), date.getUTCFullYear()].join("/");
    };
    const start = format(latest + 86400000);
    const act = format(latest + 2 * 86400000);
    for (const input of [permissions.startDateInput, permissions.endDateInput]) {
      await input.fill(start);
      await input.press("Tab");
      await expect(input).toHaveValue(start);
    }
    await permissions.descriptionInput.fill("PER-022 administrative act date after start");
    await permissions.administrativeActInput.fill("1");
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();

    // 2. Set the administrative-act date one day after start; end remains equal to start.
    await permissions.administrativeActDateInput.fill(act);
    await permissions.administrativeActDateInput.press("Tab");
    await expect(permissions.administrativeActDateInput).toHaveValue(act);

    // 3. Save and assert the exact relation error before dismissing.
    await expect(permissions.saveButton).toBeEnabled();
    const beforeSave = requests.length;
    await permissions.saveButton.click();
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
    await expect(errorDialog.getByText("La Fecha Acto debe ser menor o igual a la Fecha Desde.", { exact: true })).toBeVisible();
    expect(requests.slice(beforeSave), "Date relation validates locally").toEqual([]);
    await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
    await expect(errorDialog).toBeHidden();

    // 4. Verify preserved draft/history and reload the employee to prove no persistence.
    await expect(permissions.startDateInput).toHaveValue(start);
    await expect(permissions.endDateInput).toHaveValue(start);
    await expect(permissions.administrativeActDateInput).toHaveValue(act);
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(permissions.historyRows).toHaveCount(history.length);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyText);
    await page.reload();
    await expect(permissions.heading).toBeVisible();
    const readback = await searchEmployee();
    expect(readback.employee.kaNlTercero).toBe(employee.kaNlTercero);
    expect(readback.history, "Rejected Save preserves complete history").toEqual(history);
    if (history.length) await expect(permissions.historyRows).toHaveText(historyText);

    // 5. Verify continued usability and no permission mutation.
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await permissions.newButton.click();
    await expect(permissions.saveButton).toBeEnabled();
    await expect(permissions.deleteButton).toBeDisabled();
    await expect(errorDialog).toBeHidden();
    expect(mutations).toEqual([]);
  });
});
