// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/rows";
const deleteUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/borrar";

test.describe("Initial state, API mapping, and non-mutating grid behavior", () => {
  test("RP-005: Individual selection controls Delete Selected without deleting data", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);
    const deleteRequests: Request[] = [];
    const recordDeleteRequest = (request: Request): void => {
      if (request.url() === deleteUrl) {
        deleteRequests.push(request);
      }
    };
    page.on("request", recordDeleteRequest);

    const rowsResponsePromise = page.waitForResponse(
      response =>
        response.url() === rowsUrl && response.request().method() === "GET",
    );
    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const rowsResponse = await rowsResponsePromise;
    expect(rowsResponse.ok()).toBe(true);

    const selectableIds: number[] = [];
    for (const row of await risksPage.currentPageRiskRows().all()) {
      const testId = await row.getAttribute("data-testid");
      const match = testId?.match(/--(\d+)$/);
      const id = Number(match?.[1]);

      if (id > 0) {
        selectableIds.push(id);
      }
    }

    test.skip(
      selectableIds.length === 0,
      "RP-005 requires at least one deletable occupational-risk row",
    );

    const [firstId, secondId] = selectableIds;
    const checkedCheckboxes = risksPage.riskTable.locator(
      'input[data-testid^="riesgos-profesionales-table-select-checkbox--"]:checked',
    );

    // 1. Select one runtime row by its ID-scoped checkbox.
    await risksPage.riskCheckbox(firstId).click();

    await expect(risksPage.riskCheckbox(firstId)).toBeChecked();
    await expect(checkedCheckboxes).toHaveCount(1);
    await expect(risksPage.deleteButton).toBeEnabled();

    // 2. Select a second row when available, then deselect each row while observing /actions/borrar.
    if (secondId !== undefined) {
      await risksPage.riskCheckbox(secondId).click();

      await expect(risksPage.riskCheckbox(firstId)).toBeChecked();
      await expect(risksPage.riskCheckbox(secondId)).toBeChecked();
      await expect(checkedCheckboxes).toHaveCount(2);
      await expect(risksPage.deleteButton).toBeEnabled();

      await risksPage.riskCheckbox(firstId).click();

      await expect(risksPage.riskCheckbox(firstId)).not.toBeChecked();
      await expect(risksPage.riskCheckbox(secondId)).toBeChecked();
      await expect(checkedCheckboxes).toHaveCount(1);
      await expect(risksPage.deleteButton).toBeEnabled();

      await risksPage.riskCheckbox(secondId).click();
    } else {
      test.info().annotations.push({
        type: "skip",
        description:
          "Independent two-row selection requires a second deletable occupational-risk row",
      });
      await risksPage.riskCheckbox(firstId).click();
    }

    await expect(checkedCheckboxes).toHaveCount(0);
    await expect(risksPage.deleteButton).toBeDisabled();
    expect(deleteRequests).toHaveLength(0);

    page.off("request", recordDeleteRequest);
  });
});
