// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Persistence and approved protection", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-034 — Create unapproved permission and prove persistence", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Row = { kaNlDato: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string; scDescripcion: string };
    let ownedId: number | undefined;
    const description = "PER-034 unapproved permission " + Date.now();
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" &&
        r.url().endsWith(api + "/empleados/by-nitsd/70324693"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().includes(api + "/rows?"));
      await permissions.employeeDocumentInput.fill("70324693");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const employee = await employeeResponse.json();
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("limit")).toBe("200");
      expect(query.get("calamidad")).toBe("N");
      expect(String(employee.nNit)).toBe("70324693");
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
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
    const iso = "2026-01-02";
    const date = "02/01/2026";
    expect(original.some(row => row.ddDesde <= iso && row.ddHasta >= iso),
      "Prerequisite: supplied date must have no existing permission overlap").toBe(false);
    for (const input of [permissions.startDateInput, permissions.endDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.descriptionInput.fill(description);
    await permissions.administrativeActInput.fill("34");
    await expect(permissions.approvedNoCheckbox).toBeChecked();
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    try {
      // 2. Enter valid dates, description and act; Save once with permission Yes and approval No.
      await permissions.administrativeActDateInput.fill(date);
      await permissions.administrativeActDateInput.press("Tab");
      await expect(permissions.administrativeActDateInput).toHaveValue(date);
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
      expect(created.status(), "Backend must create the unapproved permission").toBe(201);
      expect(ownedId).toEqual(expect.any(Number));
      expect(original.some(row => row.kaNlDato === ownedId)).toBe(false);
      expect(payload).toMatchObject({ kaNlPermiso: null, kaNlEmpleado: employee.kaNlTercero,
        ddDesde: iso, ddHasta: iso, scDescripcion: description, ndActoAdministrativo: 34,
        ddActoAdministrativo: iso, aprobada: "N", scCompensatorio: "N", scPermiso: "S" });
      const information = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Información", exact: true }) });
      await expect(information.getByRole("heading")).toHaveText("Información");
      await expect(information.getByText("El registro se guardó correctamente.", { exact: true })).toBeVisible();
      await information.getByRole("button", { name: "Aceptar", exact: true }).click();

      // 3. Reload and select the returned record; compare every stored field and history indicator.
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
      await expect(permissions.administrativeActDateInput).toHaveValue(date);
      await expect(permissions.startDateInput).toHaveValue(date);
      await expect(permissions.endDateInput).toHaveValue(date);
      await expect(permissions.descriptionInput).toHaveValue(description);
      await expect(permissions.administrativeActInput).toHaveValue("34");
      await expect(permissions.approvedNoCheckbox).toBeChecked();
      await expect(permissions.compensatoryNoCheckbox).toBeChecked();
      await expect(permissions.permissionYesCheckbox).toBeChecked();
      expect(result.detail).toMatchObject({ ...payload, kaNlPermiso: ownedId,
        ibcPermiso: expect.any(Number), calamidad: "N" });
      const row = permissions.historyRow(ownedId!);
      await expect(row.getByRole("cell").nth(1)).toHaveText(employee.scNombre);
      await expect(row.getByRole("cell").nth(2)).toHaveText(date);
      await expect(row.getByRole("cell").nth(3)).toHaveText(date);
      await expect(row.getByRole("cell").nth(4)).toHaveText(description);
      await expect(row.getByRole("cell").nth(6)).toHaveText("1");
      for (const column of [0, 5]) {
        const indicator = row.getByRole("cell").nth(column).locator('input[type="checkbox"]');
        await expect(indicator).not.toBeChecked();
        await expect(indicator).toBeDisabled();
      }
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeEnabled();

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
      await expect(page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Error", exact: true }),
      })).toBeHidden();
      ownedId = undefined;
    } finally {
      // 6. Verify no error dialog and retain owned-record fallback cleanup is restricted to this creation and never replaces explicit deletion assertions.
      if (ownedId !== undefined) {
        const remaining = await reload();
        if (remaining.history.some(row => row.kaNlDato === ownedId)) {
          const detailWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/rows/" + ownedId));
          await permissions.historyRow(ownedId).click();
          await detailWait;
          await permissions.deleteButton.click();
          const deletionWait = page.waitForResponse(r => r.request().method() === "DELETE" && r.url().endsWith(api + "/rows/" + ownedId));
          await page.getByTestId("permisos-dialog-delete-confirmation").getByRole("button", { name: "Si", exact: true }).click();
          expect((await deletionWait).status()).toBe(204);
        }
        expect((await reload()).history.some(row => row.kaNlDato === ownedId)).toBe(false);
      }
    }
  });
});

