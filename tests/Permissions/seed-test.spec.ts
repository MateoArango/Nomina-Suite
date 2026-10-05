// spec: tests/Permissions/Pseudo_Plan_Permissions.md
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

test.describe("Permissions", () => {
  test("Permissions page seed", async ({ page }) => {
    const permissionsPage = new PermissionsPage(page);

    // 1. Open the permissions page using the shared authentication fixture.
    await permissionsPage.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissionsPage.heading).toBeVisible();

    // 2. Verify the employee search controls are ready with no employee selected.
    const employeeId = permissionsPage.employeeDocumentInput;
    await expect(employeeId).toBeVisible();
    await expect(employeeId).toHaveValue("");
    await expect(permissionsPage.employeeSearchButton).toBeEnabled();
    await expect(permissionsPage.employeeSelectorOpenButton).toBeEnabled();

    // 3. Verify the empty permission history and basic permission details fields.
    await expect(permissionsPage.historyHeading).toBeVisible();
    await expect(permissionsPage.historyEmptyMessage).toBeVisible();
    await expect(permissionsPage.detailsHeading).toBeVisible();
    await expect(permissionsPage.startDateInput).toBeVisible();
    await expect(permissionsPage.endDateInput).toBeVisible();
    await expect(permissionsPage.descriptionInput).toBeVisible();

    // 4. Verify record actions are disabled until an employee is selected.
    await expect(permissionsPage.newButton).toBeDisabled();
    await expect(permissionsPage.saveButton).toBeDisabled();
    await expect(permissionsPage.deleteButton).toBeDisabled();
  });
});
