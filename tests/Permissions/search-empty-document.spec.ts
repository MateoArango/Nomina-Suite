// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Initial state and employee search", () => {
  test("PER-003 — Search with an empty document", async ({ page }) => {
    const permissionsPage = new PermissionsPage(page);
    const permissionRequests: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(
        "/api/v1/w-vacaciones-licencias-ascensos-permisos/",
      )) {
        permissionRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    const errorDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    });

    // 1. Start a fresh authenticated context, construct PermissionsPage and call goto().
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

    // 2. Leave employeeDocumentInput empty and click employeeSearchButton.
    await permissionsPage.employeeSearchButton.click();

    // 3. Verify the runtime-confirmed local validation dialog, title and exact body.
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog.getByRole("heading", { level: 2 })).toHaveText("Error");
    await expect(errorDialog.getByText("Debe ingresar un CC/NIT v\u00e1lido.", { exact: true }))
      .toBeVisible();

    // 4. Assert no employee is selected, record actions stay disabled and no history appears.
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.employeeNameValue).toHaveCount(0);
    await expect(permissionsPage.historyTable).toHaveCount(0);
    await expect(permissionsPage.historyRows).toHaveCount(0);
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    await expect(permissionsPage.historyEmptyTitle).toHaveText("Sin permisos");
    await expect(permissionsPage.historyEmptyMessage).toHaveText(
      "Busque o seleccione un empleado para consultar sus permisos.",
    );

    // 5. Dismiss only after message assertions and verify local validation made no Permissions API request.
    await errorDialog.getByTestId("permisos-dialog-error-confirm-button").click();
    await expect(errorDialog).toBeHidden();
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.employeeNameValue).toHaveCount(0);
    await expect(permissionsPage.historyRows).toHaveCount(0);
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    expect(permissionRequests, "Empty search must validate locally without loading or mutating permissions")
      .toEqual([]);
  });
});
