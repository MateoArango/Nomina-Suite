// spec: specs/permissions-test-plan.md
// seed: tests/Permissions/seed-test.spec.ts
import { expect, test } from "../fixtures/auth.fixture";
import { PermissionsPage } from "../../pages/Permissions.page";

type Employee = { kaNlTercero: number; nNit: number | string; scNombre: string };
type HistoryRow = { kaNlDato: number; kaNlEmpleado: number; nNit: number | string; scNombre: string };

test.describe("Employee selector and history", () => {
  test("PER-014 — Permission history pagination", async ({ page }) => {
    const permissions = new PermissionsPage(page);
    const api = "/api/v1/w-vacaciones-licencias-ascensos-permisos";
    const mutations: string[] = [];
    page.on("request", request => {
      if (new URL(request.url()).pathname.startsWith(api + "/") &&
          !["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(request.method() + " " + request.url());
      }
    });

    // 1. Start a fresh authenticated context and search the supplied employee with existing history.
    await permissions.goto();
    await expect(page).toHaveURL(/\/permisos$/);
    await expect(permissions.heading).toBeVisible();
    await expect(permissions.employeeDocumentInput).toHaveValue("");
    await expect(permissions.employeeSearchButton).toBeEnabled();
    await expect(permissions.historyRows).toHaveCount(0);
    const document = "43433798";
    const employeeWait = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === api + "/empleados/by-nitsd/" + document);
    const historyWait = page.waitForResponse(response =>
      response.request().method() === "GET" && new URL(response.url()).pathname === api + "/rows");
    await permissions.employeeDocumentInput.fill(document);
    await permissions.employeeSearchButton.click();
    const employeeResponse = await employeeWait;
    expect(employeeResponse.status(), "Prerequisite: supplied employee must exist").toBe(200);
    const employee: Employee = await employeeResponse.json();
    expect(String(employee.nNit)).toBe(document);
    const historyResponse = await historyWait;
    expect(historyResponse.status()).toBe(200);
    const url = new URL(historyResponse.url());
    expect(url.searchParams.get("kaNlTercero")).toBe(String(employee.kaNlTercero));
    expect(url.searchParams.get("limit")).toBe("200");
    expect(url.searchParams.get("calamidad")).toBe("N");
    const history: HistoryRow[] = await historyResponse.json();
    expect(Array.isArray(history)).toBe(true);
    const total = history.length;
    expect(total, "Prerequisite: existing history must contain more than 10 records for navigation").toBeGreaterThan(10);
    expect(new Set(history.map(row => row.kaNlDato)).size).toBe(total);
    for (const row of history) {
      expect(row.kaNlEmpleado).toBe(employee.kaNlTercero);
      expect(String(row.nNit)).toBe(document);
      expect(row.scNombre).toBe(employee.scNombre);
    }

    // 2. Locate the history pager and exercise every page size.
    const assertPage = async (size: 10 | 25 | 50 | 100, index: number) => {
      const start = index * size;
      const end = Math.min(start + size, total);
      await expect(permissions.historyPageSizeButton(size)).toHaveAttribute("aria-pressed", "true");
      await expect(permissions.historyPageSummary).toHaveText(`${start + 1}-${end} de ${total}`);
      await expect(permissions.historyVisibleRows).toHaveCount(end - start);
      for (let offset = 0; offset < end - start; offset++) {
        await expect(permissions.historyVisibleRows.nth(offset)).toHaveAttribute(
          "data-testid", "permisos-table-row--" + history[start + offset].kaNlDato);
        await expect(permissions.historyVisibleRows.nth(offset).getByRole("cell").nth(1))
          .toHaveText(employee.scNombre);
      }
      await expect(permissions.historyPreviousPageButton).toBeEnabled({ enabled: index > 0 });
      await expect(permissions.historyNextPageButton).toBeEnabled({ enabled: end < total });
      await expect(permissions.employeeNameValue).toHaveText(employee.scNombre);
      await expect(permissions.employeeDocumentInput).toHaveValue(document);
    };
    await expect(permissions.historyPager).toBeVisible();
    for (const size of [10, 25, 50, 100] as const) {
      await permissions.historyPageSizeButton(size).click();
      await assertPage(size, 0);
    }

    // 3. Verify summaries, visible identities and disabled boundaries through Next/Previous.
    await permissions.historyPageSizeButton(10).click();
    await assertPage(10, 0);
    const seen: string[] = [];
    const lastPage = Math.ceil(total / 10) - 1;
    for (let index = 0; index <= lastPage; index++) {
      if (index > 0) await permissions.historyNextPageButton.click();
      await assertPage(10, index);
      for (let offset = 0; offset < Math.min(10, total - index * 10); offset++) {
        seen.push((await permissions.historyVisibleRows.nth(offset).getAttribute("data-testid"))!);
      }
    }
    expect(seen).toEqual(history.map(row => "permisos-table-row--" + row.kaNlDato));
    expect(new Set(seen).size).toBe(total);
    for (let index = lastPage - 1; index >= 0; index--) {
      await permissions.historyPreviousPageButton.click();
      await assertPage(10, index);
    }

    // 4. Verify the final history and employee remain consistent with the runtime responses.
    await expect(permissions.historyRows).toHaveCount(total);
    await expect(permissions.newButton).toBeEnabled();
    await expect(permissions.historyEmptyState).toBeHidden();

    // 5. Check message behavior and confirm pagination did not mutate permission records.
    await expect(page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Error", exact: true }),
    })).toBeHidden();
    await expect(page.getByRole("alertdialog")).toBeHidden();
    expect(mutations, "History pagination must remain read-only").toEqual([]);
  });
});
