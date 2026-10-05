// spec: specs/user-module-assignment-plan.md
// seed: tests/modulesAndUsers/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { ModulesAndUsersPage } from "../../pages/ModulesAndUsers.page";

type RuntimeUser = {
  codigoUsuario: number;
  nombre: string;
  cedula: number;
  bloqueado: "N" | "S";
  cargo: string | null;
  depedencia: string;
};

test.describe("User list", () => {
  test("1.1 Initial list and toolbar state", async ({ page }) => {
    const modulesAndUsersPage = new ModulesAndUsersPage(page);

    // 1. Open the user and module assignment page from a fresh authenticated page.
    await modulesAndUsersPage.goto();
    await expect(page).toHaveURL("https://nomina-qa.adacsc.co/usuarios-modulos");
    await modulesAndUsersPage.expectLoaded();

    await expect(modulesAndUsersPage.listTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(modulesAndUsersPage.statusSelect).toBeVisible();
    await expect(modulesAndUsersPage.statusSelect).toContainText(/activo/i);

    const rows = modulesAndUsersPage.rows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      await expect(rows.first()).toBeVisible();
    } else {
      await expect(modulesAndUsersPage.listTable).toContainText(
        /sin registros|no hay registros|no se encontraron registros/i,
      );
    }

    // 2. Inspect the available tabs, grid columns, and toolbar actions.
    await expect(modulesAndUsersPage.userTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(modulesAndUsersPage.modulesTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(modulesAndUsersPage.inheritTab).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(modulesAndUsersPage.listTable.locator("thead th")).toHaveCount(
      5,
    );
    await expect(modulesAndUsersPage.columnFilter("cedula")).toBeVisible();
    await expect(modulesAndUsersPage.columnFilter("nombre")).toBeVisible();
    await expect(modulesAndUsersPage.columnFilter("cargo")).toBeVisible();
    await expect(
      modulesAndUsersPage.columnFilter("depedencia"),
    ).toBeVisible();

    // 3. Attempt to open each row-dependent tab without first opening a user.
    for (const tab of [
      modulesAndUsersPage.userTab,
      modulesAndUsersPage.modulesTab,
      modulesAndUsersPage.inheritTab,
    ]) {
      await tab.click();
      await expect(modulesAndUsersPage.listTable).toBeVisible();
      await expect(modulesAndUsersPage.rows()).toHaveCount(rowCount);
    }

    await expect(modulesAndUsersPage.reloadButton).toBeEnabled();
    await expect(modulesAndUsersPage.newButton).toBeEnabled();
    await expect(modulesAndUsersPage.saveButton).toBeDisabled();
    await expect(modulesAndUsersPage.undoButton).toBeDisabled();
    await expect(modulesAndUsersPage.deleteButton).toBeDisabled();
  });

  test("1.2 Open a user and verify status filters", async ({ page }) => {
    const modulesAndUsersPage = new ModulesAndUsersPage(page);
    const bootstrap = page.waitForResponse(response =>
      response.url().includes("/w-usuarios-modulos/bootstrap"),
    );

    // 1. Single-click a row, then open the same row with a double-click.
    await modulesAndUsersPage.goto();
    const payload = (await (await bootstrap).json()) as { usuarios: RuntimeUser[] };
    expect(payload.usuarios.length).toBeGreaterThan(0);

    const activeUser = payload.usuarios.find(user => user.bloqueado === "N") ?? payload.usuarios[0];
    const activeRow = modulesAndUsersPage.row(activeUser.codigoUsuario);
    await activeRow.click();
    await expect(modulesAndUsersPage.userTab).toHaveAttribute("aria-selected", "false");

    await activeRow.dblclick();
    await expect(modulesAndUsersPage.userTab).toHaveAttribute("aria-selected", "true");
    await expect(modulesAndUsersPage.modulesTab).toBeEnabled();
    await modulesAndUsersPage.modulesTab.click();
    await expect(page.locator("body")).toContainText(/asignación de módulos/i);
    await modulesAndUsersPage.userTab.click();
    await expect(modulesAndUsersPage.userIdNumberField).toHaveValue(String(activeUser.cedula));

    await modulesAndUsersPage.listTab.click();
    await expect(modulesAndUsersPage.listTable).toBeVisible();

    const visibleUserIds = async (): Promise<number[]> =>
      modulesAndUsersPage.rows().evaluateAll(rows =>
        rows.map(row => Number(row.getAttribute("data-testid")?.replace(/^.*--/, ""))),
      );
    const expectVisibleUsers = async (users: RuntimeUser[]) => {
      const visibleIds = await visibleUserIds();
      expect(new Set(visibleIds)).toEqual(new Set(users.map(user => user.codigoUsuario)));

      for (const user of users.slice(0, 3)) {
        const row = modulesAndUsersPage.row(user.codigoUsuario);
        await expect(row).toContainText(user.nombre);
        await expect(row).toContainText(String(user.cedula));
        await expect(row).toContainText(user.cargo ?? "");
        await expect(row).toContainText(user.depedencia);
      }
    };

    const selectStatus = async (label: RegExp) => {
      await modulesAndUsersPage.statusSelect.click();
      await page.getByRole("option", { name: label }).click();
    };

    // 2. Switch among active, blocked, and all-user filters; inspect sorting and reload behavior.
    await selectStatus(/^Activos$/i);
    const activeUsers = payload.usuarios.filter(user => user.bloqueado === "N");
    await expectVisibleUsers(activeUsers);

    await expectVisibleUsers(activeUsers);

    await selectStatus(/^Bloqueados$/i);
    const blockedUsers = payload.usuarios.filter(user => user.bloqueado === "S");
    if (blockedUsers.length === 0) {
      await expect(page.locator("body")).toContainText(
        "Sin usuarios para el filtro actual",
      );
      await expect(page.locator("body")).toContainText(
        "Cambie estado o criterios de busqueda.",
      );
    } else {
      await expectVisibleUsers(blockedUsers);
    }

    await selectStatus(/^(Todos|Todos los usuarios)$/i);
    await expectVisibleUsers(payload.usuarios);

    const refreshedBootstrap = page.waitForResponse(response =>
      response.url().includes("/w-usuarios-modulos/bootstrap"),
    );
    await modulesAndUsersPage.reload();
    const refreshedPayload = (await (await refreshedBootstrap).json()) as {
      usuarios: RuntimeUser[];
    };
    await expectVisibleUsers(refreshedPayload.usuarios);
  });
});
