// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Persistence and approved protection", () => {
  test.use({ baseURL: "https://nomina-qa.adacsc.co/" });
  test("PER-035 — Update an existing unapproved permission", async ({ page, baseURL }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    type Row = { kaNlDato: number; kaNlEmpleado: number; ddDesde: string; ddHasta: string; scDescripcion: string };
    let ownedId: number | undefined;
    const description = "PER-035 original " + Date.now();
    const updatedDescription = description.replace("original", "updated");
    const search = async () => {
      const employeeWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/empleados/by-nitsd/70324693"));
      const historyWait = page.waitForResponse(r => r.request().method() === "GET" && r.url().includes(api + "/rows?"));
      await permissions.employeeDocumentInput.fill("70324693");
      await permissions.employeeSearchButton.click();
      const [employeeResponse, historyResponse] = await Promise.all([employeeWait, historyWait]);
      expect(employeeResponse.status()).toBe(200);
      expect(historyResponse.status()).toBe(200);
      const employee = await employeeResponse.json();
      expect(String(employee.nNit)).toBe("70324693");
      const query = new URL(historyResponse.url()).searchParams;
      expect(query.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
      expect(query.get("calamidad")).toBe("N");
      expect(query.get("limit")).toBe("200");
      const history: Row[] = await historyResponse.json();
      for (const row of history) expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.historyRows).toHaveCount(history.length);
      return { employee, history };
    };
    const reload = async () => {
      await page.reload();
      await expect(permissions.heading).toBeVisible();
      return search();
    };
    const selectOwned = async () => {
      const wait = page.waitForResponse(r => r.request().method() === "GET" && r.url().endsWith(api + "/rows/" + ownedId));
      await permissions.historyRow(ownedId!).click();
      const response = await wait;
      expect(response.status()).toBe(200);
      return response.json();
    };
    const acceptSuccess = async () => {
      const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Informaci\u00f3n", exact: true }) });
      await expect(dialog.getByRole("heading")).toHaveText("Informaci\u00f3n");
      await expect(dialog.getByText("El registro se guard\u00f3 correctamente.", { exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Aceptar", exact: true }).click();
    };
    const deleteOwned = async () => {
      await permissions.deleteButton.click();
      const confirmation = page.getByTestId("permisos-dialog-delete-confirmation");
      await expect(confirmation.getByRole("heading")).toHaveText("Atenci\u00f3n");
      await expect(confirmation.getByText("\u00bfDesea eliminar el registro seleccionado?", { exact: true })).toBeVisible();
      const wait = page.waitForResponse(r => r.request().method() === "DELETE" && r.url().endsWith(api + "/rows/" + ownedId));
      await confirmation.getByRole("button", { name: "Si", exact: true }).click();
      expect((await wait).status()).toBe(204);
      await expect(confirmation).toBeHidden();
    };

    // 1. Start fresh, search the supplied document and create an independent disposable unapproved row.
    await permissions.goto(baseURL);
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    const { employee, history: baseline } = await search();
    const candidate = Array.from({ length: 28 }, (_, index) => "2026-01-" + String(index + 2).padStart(2, "0"))
      .find(date => !baseline.some(row => row.ddDesde <= date && row.ddHasta >= date));
    expect(candidate, "Prerequisite: an unused permission date is required").toBeDefined();
    const iso = candidate!;
    const date = iso.split("-").reverse().join("/");
    await permissions.newButton.click();
    for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput]) {
      await input.fill(date);
      await input.press("Tab");
      await expect(input).toHaveValue(date);
    }
    await permissions.descriptionInput.fill(description);
    await permissions.administrativeActInput.fill("35");
    await expect(permissions.approvedNoCheckbox).toBeChecked();
    await expect(permissions.permissionYesCheckbox).toBeChecked();
    await expect(permissions.compensatoryNoCheckbox).toBeChecked();
    try {
      const createWait = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(api + "/rows"));
      await permissions.saveButton.click();
      const created = await createWait;
      const result = await created.json();
      ownedId = result.detail?.kaNlPermiso;
      expect(created.status(), JSON.stringify(result)).toBe(201);
      expect(ownedId).toEqual(expect.any(Number));
      expect(baseline.some(row => row.kaNlDato === ownedId)).toBe(false);
      await acceptSuccess();
      await reload();
      const original = await selectOwned();
      expect(original).toEqual(result.detail);
      expect(original).toMatchObject({ kaNlEmpleado: employee.kaNlTercero, ddDesde: iso, ddHasta: iso,
        scDescripcion: description, ndActoAdministrativo: 35, ddActoAdministrativo: iso,
        aprobada: "N", scCompensatorio: "N", scPermiso: "S" });

      // 2. Change only the owned row's description, keeping dates, act and flags unchanged.
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeEnabled();
      await permissions.descriptionInput.fill(updatedDescription);

      // 3. Save once; capture the update and exact message, then read back the same ID after reload.
      const updateWait = page.waitForResponse(r => r.request().method() === "PUT" && r.url().endsWith(api + "/rows/" + ownedId));
      await permissions.saveButton.click();
      const response = await updateWait;
      const body = await response.json();
      const payload = response.request().postDataJSON();
      const dialog = page.getByRole("dialog").filter({ visible: true });
      await expect(dialog).toBeVisible();
      const message = await dialog.innerText();
      await test.info().attach("update-contract", { body: JSON.stringify({
        method: response.request().method(), url: response.url(), status: response.status(), payload, body, message,
      }, null, 2), contentType: "application/json" });
      if (response.status() !== 200) {
        await reload();
        expect((await search()).history.filter(row => row.kaNlDato !== ownedId)).toEqual(baseline);
        expect(await selectOwned()).toEqual(original);
      }
      expect(response.status(), "Update must succeed without self-overlap. Captured dialog: " + message).toBe(200);
      const { calamidad: _calamity, ...originalPayload } = original;
      expect(payload).toEqual({ ...originalPayload, scDescripcion: updatedDescription });
      expect(body.detail).toEqual({ ...original, scDescripcion: updatedDescription });
      await acceptSuccess();
      const persisted = await reload();
      expect(persisted.history).toHaveLength(baseline.length + 1);
      expect(persisted.history.filter(row => row.kaNlDato !== ownedId)).toEqual(baseline);
      expect(persisted.history.filter(row => row.kaNlDato === ownedId)).toHaveLength(1);
      expect(persisted.history.find(row => row.kaNlDato === ownedId)?.scDescripcion).toBe(updatedDescription);
      expect(await selectOwned()).toEqual({ ...original, scDescripcion: updatedDescription });

      // 4. Remove only the test-owned row and prove restoration after reload.
      await expect(permissions.descriptionInput).toHaveValue(updatedDescription);
      for (const input of [permissions.startDateInput, permissions.endDateInput, permissions.administrativeActDateInput])
        await expect(input).toHaveValue(date);
      await expect(permissions.administrativeActInput).toHaveValue("35");
      await expect(permissions.approvedNoCheckbox).toBeChecked();
      await expect(permissions.permissionYesCheckbox).toBeChecked();
      await expect(permissions.compensatoryNoCheckbox).toBeChecked();
      await deleteOwned();
      expect((await reload()).history).toEqual(baseline);
      await expect(permissions.historyRow(ownedId!)).toHaveCount(0);
      ownedId = undefined;

      // 5. Assert the final UI and network results leave the employee ready for independent work.
      await permissions.newButton.click();
      await expect(permissions.descriptionInput).toHaveValue("");
      await expect(permissions.saveButton).toBeEnabled();
      await expect(permissions.deleteButton).toBeDisabled();
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
    } finally {
      // 6. Preserve failure evidence and always clean up only the independently created ID.
      if (ownedId !== undefined) {
        const remaining = await reload();
        if (remaining.history.some(row => row.kaNlDato === ownedId)) {
          await selectOwned();
          await deleteOwned();
        }
        expect((await reload()).history).toEqual(baseline);
      }
    }
  });
});
