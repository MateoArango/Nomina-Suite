// spec: tests/Permissions/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Initial state and employee search", () => {
  test("PER-001 — Fresh page and disabled record actions", async ({ page }) => {
    const permissionsPage = new PermissionsPage(page);
    const permissionRequests: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(
        "/api/v1/w-vacaciones-licencias-ascensos-permisos/",
      )) {
        permissionRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    // 1. Start a fresh authenticated context, construct PermissionsPage and call goto().
    await permissionsPage.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissionsPage.heading).toBeVisible();
    await expect(permissionsPage.employeeDocumentInput).toBeVisible();
    await expect(permissionsPage.employeeSearchButton).toBeVisible();
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.employeeSelectorOpenButton).toBeVisible();
    await expect(permissionsPage.employeeSelectorOpenButton).toBeEnabled();

    // 2. Check the document input is empty, empty history and detail controls are visible.
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.historyEmptyTitle).toBeVisible();
    await expect(permissionsPage.historyEmptyMessage).toBeVisible();
    await expect(permissionsPage.detailsHeading).toBeVisible();
    for (const control of [
      permissionsPage.startDateInput,
      permissionsPage.endDateInput,
      permissionsPage.descriptionInput,
      permissionsPage.administrativeActInput,
      permissionsPage.administrativeActDateInput,
      permissionsPage.compensatoryGroup,
      permissionsPage.permissionGroup,
      permissionsPage.approvedGroup,
    ]) {
      await expect(control).toBeVisible();
    }

    // 3. Assert record actions are disabled and initial flags are No, Yes and No.
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
    await expect(permissionsPage.compensatoryYesCheckbox).not.toBeChecked();
    await expect(permissionsPage.compensatoryNoCheckbox).toBeChecked();
    await expect(permissionsPage.permissionYesCheckbox).toBeChecked();
    await expect(permissionsPage.permissionNoCheckbox).not.toBeChecked();
    await expect(permissionsPage.approvedYesCheckbox).not.toBeChecked();
    await expect(permissionsPage.approvedNoCheckbox).toBeChecked();

    // 4. Assert no employee or history row is selected and verify relevant network results.
    await expect(permissionsPage.employeeDocumentInput).toHaveValue("");
    await expect(permissionsPage.historySection.getByTestId("permisos-list-table")).toHaveCount(0);
    await expect(
      permissionsPage.historySection.locator('[data-testid^="permisos-table-row--"]'),
    ).toHaveCount(0);

    // 5. Check exact empty-state messages, no error dialog and no permission record requests.
    await expect(permissionsPage.historyEmptyTitle).toHaveText("Sin permisos");
    await expect(permissionsPage.historyEmptyMessage).toHaveText(
      "Busque o seleccione un empleado para consultar sus permisos.",
    );
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(permissionRequests, "Fresh page must not load employee records or mutate permissions").toEqual([]);
  });
});
