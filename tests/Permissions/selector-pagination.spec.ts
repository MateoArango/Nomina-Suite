// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number };

test.describe("Employee selector and history", () => {
  test("PER-012 — Selector page size and navigation", async ({ page }) => {
    // Includes authenticated setup and traversal to the runtime final page.
    test.setTimeout(60_000);
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });

    // 1. Start a fresh authenticated context with ready search controls and no selected employee.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.employeeSelectorOpenButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);

    // 2. Open the selector and verify 10, 25, 50 and 100 rows per page against runtime data.
    const lookupWait = page.waitForResponse(response => {
      const url = new URL(response.url());
      return response.request().method() === "GET" &&
        url.pathname === api + "/lookups/empleados" &&
        url.searchParams.get("limit") === "2000" && url.searchParams.get("query") === "";
    });
    await permissions.employeeSelectorOpenButton.click();
    const response = await lookupWait;
    expect(response.status()).toBe(200);
    const employees: Employee[] = await response.json();
    expect(Array.isArray(employees)).toBe(true);
    const total = employees.length;
    expect(total, "Prerequisite: lookup must contain more than 10 employees for navigation").toBeGreaterThan(10);
    await expect(permissions.employeeSelectorQueryInput).toBeVisible();
    await expect(permissions.employeeSelectorRows).toHaveCount(total);

    const assertPage = async (size: 10 | 25 | 50 | 100, index: number) => {
      const start = index * size;
      const end = Math.min(start + size, total);
      await expect(permissions.employeeSelectorPageSizeButton(size)).toHaveAttribute("aria-pressed", "true");
      await expect(permissions.employeeSelectorPageSummary).toHaveText(`${start + 1}-${end} de ${total}`);
      await expect(permissions.employeeSelectorVisibleRows).toHaveCount(end - start);
      const expectedIds = employees.slice(start, end)
        .map(employee => "permisos-employee-selector-row--" + employee.kaNlTercero);
      await expect.poll(() => permissions.employeeSelectorVisibleRows.evaluateAll(
        rows => rows.map(row => row.getAttribute("data-testid")),
      )).toEqual(expectedIds);
      if (index === 0) {
        await expect(permissions.employeeSelectorPreviousPageButton).toBeDisabled();
      } else {
        await expect(permissions.employeeSelectorPreviousPageButton).toBeEnabled();
      }
      if (end === total) {
        await expect(permissions.employeeSelectorNextPageButton).toBeDisabled();
      } else {
        await expect(permissions.employeeSelectorNextPageButton).toBeEnabled();
      }
      await expect(permissions.employeeSelectorPanel.locator(".empty-state")).toBeHidden();
    };
    for (const size of [10, 25, 50, 100] as const) {
      await permissions.employeeSelectorPageSizeButton(size).click();
      await assertPage(size, 0);
    }

    // 3. Use a small page size to verify Next changes identities and Previous restores the first page.
    await permissions.employeeSelectorPageSizeButton(10).click();
    await assertPage(10, 0);
    await permissions.employeeSelectorNextPageButton.click();
    await assertPage(10, 1);
    await permissions.employeeSelectorPreviousPageButton.click();
    await assertPage(10, 0);

    // 4. Reach the final page efficiently and verify its runtime remainder and disabled Next boundary.
    await permissions.employeeSelectorPageSizeButton(100).click();
    await assertPage(100, 0);
    const lastPage = Math.ceil(total / 100) - 1;
    for (let index = 1; index <= lastPage; index++) {
      await permissions.employeeSelectorNextPageButton.click();
      await expect(permissions.employeeSelectorPageSummary).toHaveText(
        `${index * 100 + 1}-${Math.min((index + 1) * 100, total)} de ${total}`);
    }
    await assertPage(100, lastPage);
    await expect(permissions.employeeSelectorRows).toHaveCount(total);

    // 5. Verify no errors, empty-results message, selected employee or permission mutation.
    await expect(permissions.employeeSelectorPanel.locator(".empty-state")).toBeHidden();
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.historyRows).toHaveCount(0);
    await expect(permissions.newButton).toBeDisabled();
    await expect(permissions.saveButton).toBeDisabled();
    await expect(permissions.deleteButton).toBeDisabled();
    expect(mutations, "Pagination must not create, update or delete permissions").toEqual([]);
  });
});
