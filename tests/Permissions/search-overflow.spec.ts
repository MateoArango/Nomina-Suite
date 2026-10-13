// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Initial state and employee search", () => {
  test("PER-005 — Document numeric overflow", async ({ page }) => {
    const permissionsPage = new PermissionsPage(page);
    const document = "9845258312139342000";
    const apiPrefix = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const permissionRequests: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(apiPrefix + "/")) {
        permissionRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });
    const message = `For input string: "${document}"`;

    // 1. Start a fresh authenticated context with no selected employee.
    await permissionsPage.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissionsPage.heading).toBeVisible();
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.employeeNameValue).toHaveCount(0);
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    await expect(errorDialog).toBeHidden();

    // 2. Fill the 19-digit string and register separate lookup and telemetry waits before Search.
    expect(document).toMatch(/^\d{19}$/);
    await permissionsPage.employeeDocumentInput.fill(document);
    await expect(permissionsPage.employeeDocumentInput).toHaveValue(document);
    const lookupPending = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === `${apiPrefix}/empleados/by-nitsd/${document}`);
    const telemetryPending = page.waitForResponse(response =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/errores-reporte/actions/grabar");
    await permissionsPage.employeeSearchButton.click();

    // 3. Confirm the numeric overflow is rejected and assert the exact response and dialog separately.
    const lookupResponse = await lookupPending;
    expect(new URL(lookupResponse.url()).pathname).toBe(`${apiPrefix}/empleados/by-nitsd/${document}`);
    expect(lookupResponse.status(), "The supplied document must be rejected as numeric overflow").toBe(400);
    expect(await lookupResponse.json()).toMatchObject({ code: "BAD_REQUEST", message });
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
    await expect(errorDialog.getByText(message, { exact: true })).toBeVisible();

    // 4. Verify no employee or history and disabled actions; error-report POST is telemetry.
    await expect(permissionsPage.employeeNameValue).toHaveCount(0);
    await expect(permissionsPage.historyTable).toHaveCount(0);
    await expect(permissionsPage.historyRows).toHaveCount(0);
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    const telemetryResponse = await telemetryPending;
    expect(telemetryResponse.status()).toBe(200);
    expect(telemetryResponse.request().postDataJSON()).toMatchObject({
      scTipo: "AUTOMATICO", scClaseReporte: "ERROR",
    });
    expect(telemetryResponse.request().postDataJSON().observacion).toContain("HTTP 400");
    expect(telemetryResponse.request().postDataJSON().observacion).toContain(message);

    // 5. Dismiss after message assertions and verify final state with no permission mutation.
    await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
    await expect(errorDialog).toBeHidden();
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.employeeDocumentInput).toHaveValue(document);
    await expect(permissionsPage.employeeNameValue).toHaveCount(0);
    await expect(permissionsPage.historyRows).toHaveCount(0);
    await expect(permissionsPage.historyEmptyTitle).toHaveText("Sin permisos");
    await expect(permissionsPage.historyEmptyMessage).toHaveText(
      "Busque o seleccione un empleado para consultar sus permisos.");
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    expect(permissionRequests, "Only the failed employee lookup may reach the Permissions API")
      .toEqual([`GET ${apiPrefix}/empleados/by-nitsd/${document}`]);
  });
});

