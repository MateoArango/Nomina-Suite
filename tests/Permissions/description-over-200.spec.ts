// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-025 — Description rejects 201 characters", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Row = { kaNlDato: number; kaNlEmpleado: number; ddHasta: string };
    const description = "PER-025-".padEnd(201, "X");
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/empleados/by-nitsd/43442343"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" &&
        new URL(r.url()).pathname === api + "/rows");
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
      const history: Row[] = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history };
    };

    // 1. Start fresh, select an existing employee and prepare a conflict-free valid draft.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const { employee, history } = await search();
    const originalDetails = new Map<number, unknown>();
    for (const row of history) {
      const detailWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/rows/" + row.kaNlDato));
      await permissions.historyRow(row.kaNlDato).click();
      const detail = await detailWait;
      expect(detail.status()).toBe(200);
      originalDetails.set(row.kaNlDato, await detail.json());
    }
    await permissions.newButton.click();
    const [day, month, year] = (await permissions.startDateInput.inputValue()).split("/").map(Number);
    const latest = Math.max(Date.UTC(year, month - 1, day), ...history.map(row => Date.parse(row.ddHasta)));
    const iso = new Date(latest + 86400000).toISOString().slice(0, 10);
    const date = iso.split("-").reverse().join("/");
    for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.administrativeActInput.fill("1");
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.approvedNoCheckbox).toBeChecked();

    // 2. Fill exactly 201 deterministic ASCII characters and verify the complete DOM value.
    await permissions.descriptionInput.fill(description);
    await expect(permissions.descriptionInput).toHaveValue(description);
    expect((await permissions.descriptionInput.inputValue()).length).toBe(201);

    // 3. Send the authorized controlled negative Save and capture the real backend contract.
    const responseWait = page.waitForResponse(r => r.request().method() === "POST" &&
      new URL(r.url()).pathname === api + "/rows");
    await permissions.saveButton.click();
    const response = await responseWait;
    const result = await response.json();
    const payload = response.request().postDataJSON();
    const ownedId = response.ok() ? result.detail?.kaNlPermiso : undefined;
    try {
      await test.info().attach("description-over-200-contract", {
        body: JSON.stringify({ method: "POST", url: response.url(), payload, status: response.status(), response: result }, null, 2),
        contentType: "application/json",
      });
      expect(payload).toMatchObject({ kaNlPermiso: null, kaNlEmpleado: employee.kaNlTercero,
        ddDesde: iso, ddHasta: iso, ddActoAdministrativo: iso, ndActoAdministrativo: 1,
        scDescripcion: description, scCompensatorio: "N", scPermiso: "S", aprobada: "N" });
      expect(payload.scDescripcion.length).toBe(201);
      expect(response.ok(), "Backend must reject the oversized description").toBe(false);
      expect(response.status()).toBe(400);
      expect(result).toMatchObject({ code: "VALIDATION_ERROR", message: "scDescripcion debe tener máximo 200 caracteres" });
      const dialog = page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Error", exact: true }),
      });
      await expect(dialog.getByRole("heading")).toHaveText("Error");
      await expect(dialog.getByText("scDescripcion debe tener máximo 200 caracteres", { exact: true })).toBeVisible();
      await dialog.getByTestId("permisos-dialog-error-confirm-button").click();

      // 4. Verify the draft is unsaved and reload to compare complete employee history.
      await expect(permissions.descriptionInput).toHaveValue(description);
      await expect(permissions.deleteButton).toBeDisabled();
      await page.reload();
      await expect(permissions.heading).toBeVisible();
      const readback = await search();
      expect(readback.employee.kaNlTercero).toBe(employee.kaNlTercero);
      expect(readback.history).toEqual(history);

      // 5. Read existing details back and verify the page remains usable without an error.
      for (const row of history) {
        const detailWait = page.waitForResponse(r => r.request().method() === "GET" &&
          r.url().endsWith(api + "/rows/" + row.kaNlDato));
        await permissions.historyRow(row.kaNlDato).click();
        const detail = await detailWait;
        expect(detail.status()).toBe(200);
        expect(await detail.json()).toEqual(originalDetails.get(row.kaNlDato));
      }
      await permissions.newButton.click();
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
      await expect(dialog).toBeHidden();
    } finally {
      // An unexpected acceptance must fail the test and remove only its returned record.
      if (typeof ownedId === "number") {
        expect(history.some(row => row.kaNlDato === ownedId)).toBe(false);
        const headers = await response.request().allHeaders();
        const cleanup = await page.request.delete(api + "/rows/" + ownedId,
          { headers: { authorization: headers.authorization } });
        expect(cleanup.status(), "Clean up only the unexpectedly created test record").toBe(204);
        await page.reload();
        expect((await search()).history).toEqual(history);
      }
    }
  });
});
