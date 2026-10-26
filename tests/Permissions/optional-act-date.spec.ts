// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Dates, description and numeric boundaries", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-023 — Create with optional administrative act date, verify persistence and delete", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Row = { kaNlDato: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string; scDescripcion: string };
    let ownedId: number | undefined;
    let historyUrl = "";
    const description = "PER-023 optional act date " + Date.now();
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/empleados/by-nitsd/43442343"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().includes(api + "/rows?"));
      await permissions.employeeDocumentInput.fill("43442343");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const employee = await employeeResponse.json();
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("limit")).toBe("200");
      expect(query.get("calamidad")).toBe("N");
      expect(String(employee.nNit)).toBe("43442343");
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      historyUrl = historyResponse.url();
      const history: Row[] = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history };
    };
    const reload = async () => {
      await page.reload();
      await expect(permissions.heading).toBeVisible();
      return search();
    };

    // 1. Start fresh, capture runtime identity/history and prepare an unused unapproved range.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const { employee, history: original } = await search();
    await permissions.newButton.click();
    const [day, month, year] = (await permissions.startDateInput.inputValue()).split("/").map(Number);
    const latest = Math.max(Date.UTC(year, month - 1, day),
      ...original.map(row => Date.parse(row.ddHasta)));
    const iso = new Date(latest + 86400000).toISOString().slice(0, 10);
    const date = iso.split("-").reverse().join("/");
    for (const input of [permissions.startDateInput, permissions.endDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.descriptionInput.fill(description);
    await permissions.administrativeActInput.fill("1");
    await expect(permissions.approvedNoCheckbox).toBeChecked();
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    try {
      // 2. Clear the optional act date, blur and Save once; capture the actual create contract.
      await permissions.administrativeActDateInput.fill("");
      await permissions.administrativeActDateInput.press("Tab");
      await expect(permissions.administrativeActDateInput).toHaveValue("");
      const createWait = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(api + "/rows"));
      await permissions.saveButton.click();
      const created = await createWait;
      const result = await created.json();
      // Retain ownership before assertions so finally can clean up an accepted create.
      ownedId = result.detail?.kaNlPermiso;
      const payload = created.request().postDataJSON();
      await test.info().attach("create-contract", { body: JSON.stringify({
        method: created.request().method(), url: created.url(), payload, status: created.status(), response: result,
      }, null, 2), contentType: "application/json" });
      expect(created.status(), "Backend must accept an absent optional act date").toBe(201);
      expect(ownedId).toEqual(expect.any(Number));
      expect(original.some(row => row.kaNlDato === ownedId)).toBe(false);
      expect(payload).toMatchObject({ kaNlPermiso: null, kaNlEmpleado: employee.kaNlTercero,
        ddDesde: iso, ddHasta: iso, scDescripcion: description, ndActoAdministrativo: 1,
        ddActoAdministrativo: null, aprobada: "N", scCompensatorio: "N", scPermiso: "S" });
      const information = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Información", exact: true }) });
      await expect(information.getByRole("heading")).toHaveText("Información");
      await expect(information.getByText("El registro se guardó correctamente.", { exact: true })).toBeVisible();
      await information.getByRole("button", { name: "Aceptar", exact: true }).click();

      // 3. Reload and select the returned record; compare persisted fields and absent act date.
      const persisted = await reload();
      expect(persisted.history.filter(row => row.scDescripcion === description)).toHaveLength(1);
      expect(persisted.history.filter(row => row.kaNlDato !== ownedId)).toEqual(original);
      expect(persisted.history.find(row => row.kaNlDato === ownedId)).toMatchObject({
        kaNlEmpleado: employee.kaNlTercero, ddDesde: iso, ddHasta: iso, scDescripcion: description, aprobada: "N",
      });
      const detailWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/rows/" + ownedId));
      await permissions.historyRow(ownedId!).click();
      const detailResponse = await detailWait;
      expect(detailResponse.status()).toBe(200);
      expect(await detailResponse.json()).toEqual(result.detail);
      expect(result.detail.ddActoAdministrativo).toBe(payload.ddActoAdministrativo);
      await expect(permissions.administrativeActDateInput).toHaveValue("");
      await expect(permissions.startDateInput).toHaveValue(date);
      await expect(permissions.endDateInput).toHaveValue(date);
      await expect(permissions.descriptionInput).toHaveValue(description);
      await expect(permissions.administrativeActInput).toHaveValue("1");
      await expect(permissions.approvedNoCheckbox).toBeChecked();

      // 4. Explicitly delete only the returned ID and verify the runtime confirmation/response.
      const deleteWait = page.waitForResponse(r => r.request().method() === "DELETE" && r.url().endsWith(api + "/rows/" + ownedId));
      await permissions.deleteButton.click();
      const confirmation = page.getByTestId("permisos-dialog-delete-confirmation");
      await expect(confirmation.getByRole("heading")).toHaveText("Atención");
      await expect(confirmation.getByText("¿Desea eliminar el registro seleccionado?", { exact: true })).toBeVisible();
      await confirmation.getByRole("button", { name: "Si", exact: true }).click();
      const deleted = await deleteWait;
      expect(deleted.status()).toBe(204);
      expect(await deleted.text()).toBe("");
      await expect(confirmation).toBeHidden();
      await expect(permissions.historyRow(ownedId!)).toHaveCount(0);

      // 5. Reload to prove deletion and unchanged unrelated history; New resets the selected form.
      const after = await reload();
      expect(after.history).toEqual(original);
      await expect(permissions.historyRow(ownedId!)).toHaveCount(0);
      await permissions.newButton.click();
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.administrativeActInput).toHaveValue("");
      await expect(permissions.approvedNoCheckbox).toBeChecked();
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
      ownedId = undefined;
    } finally {
      // 6. Fallback cleanup is restricted to this creation and never replaces explicit deletion assertions.
      if (ownedId !== undefined) {
        const response = await page.request.get(historyUrl);
        expect(response.status()).toBe(200);
        const rows: Row[] = await response.json();
        if (rows.some(row => row.kaNlDato === ownedId)) {
          const deletion = await page.request.delete(new URL(api + "/rows/" + ownedId, historyUrl).href);
          expect(deletion.status()).toBe(204);
        }
        const readback = await page.request.get(historyUrl);
        expect(readback.status()).toBe(200);
        expect((await readback.json() as Row[]).some(row => row.kaNlDato === ownedId)).toBe(false);
      }
    }
  });
});
