import { test, expect } from "@playwright/test";
import { JuzgadosPage } from "../pages/Juzgados.page";
import { PriorizacionLiqConceptosPage } from "../pages/PriorizacionLiqConceptos.page";
test.describe("Juzgados", () => {
  test("seed for priorizacionLiqConceptos", async ({ page }) => {
    await page.goto("https://nomina-qa.adacsc.co/login");
    await page
      .locator("#mat-mdc-form-field-label-0")
      .getByText("Usuario")
      .click();
    await page.getByRole("textbox", { name: "Usuario" }).fill("SICOF");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("textbox", { name: "Contraseña" }).click();
    await page.getByRole("textbox", { name: "Contraseña" }).click();
    await page.getByRole("textbox", { name: "Contraseña" }).fill("qa304");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(url => !url.pathname.includes("/login"));
     await page.goto("https://nomina-qa.adacsc.co/priorizacion-conceptos");
   await expect(page).toHaveURL(/\/priorizacion-conceptos/);
    await page.getByRole("cell", { name: "SUELDO ORDINARIO" }).dblclick();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--1")
        .getByRole("cell", { name: "SUELDO ORDINARIO" }),
    ).toBeVisible();
    await page
      .getByTestId("priorizacion-conceptos-available-table-concept-row--2")
      .getByRole("cell", { name: "RECARGO NOCTURNO" })
      .click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-assign-button")
      .click();
    await expect(page.getByTitle("Asignar")).toBeVisible();
    await expect(
      page.getByTestId("priorizacion-conceptos-transfer-move-down-button"),
    ).toBeVisible();
    await expect(
      page.getByTestId("priorizacion-conceptos-transfer-move-up-button"),
    ).toBeVisible();
    await expect(
      page.getByTestId("priorizacion-conceptos-transfer-remove-button"),
    ).toBeVisible();
    await expect(
      page.getByTestId(
        "priorizacion-conceptos-available-table-next-page-button",
      ),
    ).toBeVisible();
    await page
      .getByTestId(
        "priorizacion-conceptos-available-table-page-size-button--10",
      )
      .click();
    await page
      .getByTestId("priorizacion-conceptos-available-table-next-page-button")
      .click();
    await page
      .getByTestId(
        "priorizacion-conceptos-available-table-previous-page-button",
      )
      .click();
    await page.getByRole("cell", { name: "AUXILIO POR MATRIMONIO" }).click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-assign-button")
      .click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-move-up-button")
      .click();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--9")
        .getByRole("cell", { name: "2" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--9")
        .getByRole("cell", { name: "AUXILIO POR MATRIMONIO" }),
    ).toBeVisible();
    await page
      .getByTestId("priorizacion-conceptos-transfer-move-up-button")
      .click();
    await expect(
      page.getByRole("cell", { name: "1", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--9")
        .getByRole("cell", { name: "AUXILIO POR MATRIMONIO" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--1")
        .getByRole("cell", { name: "2" }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId("priorizacion-conceptos-priority-table-concept-row--1")
        .getByRole("cell", { name: "SUELDO ORDINARIO" }),
    ).toBeVisible();
    await page
      .getByTestId("priorizacion-conceptos-priority-table-concept-row--2")
      .getByRole("cell", { name: "RECARGO NOCTURNO" })
      .click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-remove-button")
      .click();
    await expect(page.getByText("1-2 de")).toBeVisible();
    await page
      .getByTestId("priorizacion-conceptos-priority-table-concept-row--1")
      .getByRole("cell", { name: "SUELDO ORDINARIO" })
      .click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-remove-button")
      .click();
    await expect(page.getByText("1-1 de")).toBeVisible();
    await page
      .getByTestId(
        "priorizacion-conceptos-priority-table-page-size-button--100",
      )
      .click();
    await page
      .getByTestId(
        "priorizacion-conceptos-priority-table-page-size-button--100",
      )
      .click();
    await page
      .getByTestId("priorizacion-conceptos-priority-table-page-size-button--10")
      .click();
    await page
      .getByTestId("priorizacion-conceptos-priority-table-concept-row--9")
      .getByRole("cell", { name: "AUXILIO POR MATRIMONIO" })
      .click();
    await page
      .getByTestId("priorizacion-conceptos-transfer-remove-button")
      .click();
    await page.getByTestId("priorizacion-conceptos-header-save-button").click();
    await expect(page.getByText("Los parametros han sido")).toBeVisible();
    await expect(
      page.getByTestId("priorizacion-conceptos-success-message"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Priorización de liquidación" }),
    ).toBeVisible();
  });
});
