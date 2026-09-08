import { expect, test } from "../fixtures/auth.fixture";
import { SalaryIncreasesPage } from "../../pages/SalaryIncreases.page";

// spec: specs/salary-increases-plan.md
// seed: tests/SalaryIncreases/seed-test.spec.ts

test.describe("P0 - Initial state and calculation validation", () => {
  test("SI-001: Initial filters and empty increases state", async ({ page }) => {
    const salaryIncreasesPage = new SalaryIncreasesPage(page);
    const apiBase = "https://nomina-qa-api.adacsc.co/api/v1/";
    const actionRequests: string[] = [];
    page.on("request", request => {
      if (request.method() === "POST" &&
          ["w-aumento-sueldo/actions/calculate", "w-aumento-sueldo/actions/grabar"]
            .some(path => request.url().split("?")[0] === apiBase + path)) {
        actionRequests.push(request.url());
      }
    });

    // 1. Start with a fresh authenticated browser context through auth.fixture and
    // SalaryIncreasesPage.goto(). Capture current-year context and lookup responses before navigation.
    const startupPaths = [
      "w-aumento-sueldo/context",
      "w-aumento-sueldo/lookups/dw_drop_tipos_tercero",
      "w-aumento-sueldo/lookups/dw_drop_unidades_pago",
      "w-aumento-sueldo/lookups/dw_drop_profesiones",
      "w-empleados-p/lookups/dw_drop_cargos",
      "w-aumento-sueldo/lookups/dw-drop-secciones",
    ];
    const startupResponses = startupPaths.map(path => page.waitForResponse(response =>
      response.request().method() === "GET" &&
      response.url().split("?")[0] === apiBase + path));
    await salaryIncreasesPage.goto();
    const responses = await Promise.all(startupResponses);
    for (const response of responses) {
      expect(response.status(), response.url()).toBe(200);
      expect(await response.finished(), response.url()).toBeNull();
    }
    expect(new URL(responses[0].url()).searchParams.get("year")).toBe(String(new Date().getFullYear()));
    await expect(salaryIncreasesPage.toolbar).toBeVisible();

    // 2. Inspect the filter tab and in-scope inputs.
    await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.increasesTab).toHaveAttribute("aria-selected", "false");
    for (const input of [
      salaryIncreasesPage.startDateInput, salaryIncreasesPage.hireDateInput,
      salaryIncreasesPage.documentStartInput, salaryIncreasesPage.documentEndInput,
    ]) {
      await expect(input).toBeVisible();
      await expect(input).toHaveValue("");
    }
    await expect(salaryIncreasesPage.percentageInput).toHaveValue("0");
    await expect(salaryIncreasesPage.increaseValueInput).toHaveValue("$0");
    await expect(salaryIncreasesPage.roundToHundredCheckbox).not.toBeChecked();
    await expect(salaryIncreasesPage.employeeTypeSelect).toHaveText("(Todos)");
    await expect(salaryIncreasesPage.paymentUnitSelect).toHaveText("(Todas)");
    await expect(salaryIncreasesPage.professionSelect).toHaveText("(Todas)");
    await expect(salaryIncreasesPage.positionOpenButton).toContainText("Seleccione un cargo");
    await expect(salaryIncreasesPage.sectionOpenButton).toContainText("Seleccione una sección");
    await expect(salaryIncreasesPage.resetFiltersButton).toBeEnabled();
    await expect(salaryIncreasesPage.calculateButton).toBeEnabled();
    expect(actionRequests).toEqual([]);

    // 3. Open the increases tab before calculating.
    await salaryIncreasesPage.openIncreases();
    await expect(salaryIncreasesPage.increasesTab).toHaveAttribute("aria-selected", "true");
    await expect(salaryIncreasesPage.filterTab).toHaveAttribute("aria-selected", "false");
    await expect(salaryIncreasesPage.table).toHaveCount(0);
    await expect(salaryIncreasesPage.visibleRows()).toHaveCount(0);
    await expect(salaryIncreasesPage.exportButton).toBeDisabled();
    await expect(salaryIncreasesPage.saveButton).toBeDisabled();
    expect(actionRequests, "Initial navigation and tab navigation must not calculate or save salaries").toEqual([]);
  });
});
