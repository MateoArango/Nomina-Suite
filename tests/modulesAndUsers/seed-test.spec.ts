import { expect, test } from "../fixtures/auth.fixture";
import { ModulesAndUsersPage } from "./ModulesAndUsers.page";

test("Modules and Users seed", async ({ page }) => {
  const modulesAndUsersPage = new ModulesAndUsersPage(page);

  await modulesAndUsersPage.goto();
  await expect(page).toHaveURL("https://nomina-qa2.adacsc.co/usuarios-modulos");
  await modulesAndUsersPage.expectLoaded();

  await expect(modulesAndUsersPage.reloadButton).toBeVisible();
  await expect(modulesAndUsersPage.newButton).toBeVisible();
  await expect(modulesAndUsersPage.saveButton).toBeDisabled();
  await expect(modulesAndUsersPage.undoButton).toBeDisabled();
  await expect(modulesAndUsersPage.deleteButton).toBeDisabled();

  await expect(modulesAndUsersPage.listTab).toHaveAttribute("aria-selected", "true");
  await expect(modulesAndUsersPage.userTab).toHaveAttribute("aria-selected", "false");
  await expect(modulesAndUsersPage.modulesTab).toHaveAttribute("aria-selected", "false");
  await expect(modulesAndUsersPage.inheritTab).toHaveAttribute("aria-selected", "false");
  await modulesAndUsersPage.openSearchButton.click();
});
