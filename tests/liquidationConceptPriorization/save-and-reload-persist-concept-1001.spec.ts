// spec: specs/priorizacion-liq-conceptos-test-plan.md
// seed: tests/seed.spec.ts

import type { Locator, Request, Response } from "@playwright/test";
import { expect, test } from "../fixtures/auth.fixture";
import { PriorizacionLiqConceptosPage } from "../../pages/PriorizacionLiqConceptos.page";

type PrioritizedConcept = {
  kaNlConcepto: number;
  kaNlOrden: number | null;
  ssCodigo: string | number;
  ssConcepto?: string;
  scSigno?: string;
};

type SavePayload = {
  ordenes: Array<{
    kaNlConcepto: number;
    kaNlOrden: number | null;
  }>;
};

const conceptCode = "1001";
const conceptName = "SUELDO ORDINARIO ADMINISTRATIVO";
const pageUrl = "https://nomina-qa.adacsc.co/priorizacion-conceptos";
const rowsUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/rows";
const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-priorizacion-conceptos/actions/grabar";

async function readRows(response: Response): Promise<PrioritizedConcept[]> {
  expect(response.ok()).toBe(true);
  return (await response.json()) as PrioritizedConcept[];
}

async function readRowsFromRequest(
  request: Request,
): Promise<PrioritizedConcept[]> {
  const response = await request.response();
  expect(response).not.toBeNull();
  return readRows(response!);
}

async function findRowAcrossPages(
  row: Locator,
  pageSizeButton: Locator,
  previousPageButton: Locator,
  nextPageButton: Locator,
): Promise<void> {
  await pageSizeButton.click();

  while (await previousPageButton.isEnabled()) {
    await previousPageButton.click();
  }

  while (
    (await row.count()) === 0 &&
    (await nextPageButton.isEnabled())
  ) {
    await nextPageButton.click();
  }

  await expect(row).toHaveCount(1);
}

test.describe("Liquidation Concept Prioritization", () => {
  test.describe.configure({ mode: "serial" });

  test("PLC-010: Save and reload persist concept 1001", async ({ page }) => {
    test.setTimeout(90_000);

    const prioritizationPage = new PriorizacionLiqConceptosPage(page);
    let saveAttempted = false;
    let conceptId: number | undefined;

    const waitForRowsRequest = (): Promise<Request> =>
      page.waitForRequest(
        request =>
          request.url() === rowsUrl && request.method() === "GET",
      );
    const waitForSaveResponse = (): Promise<Response> =>
      page.waitForResponse(
        response =>
          response.url() === saveUrl && response.request().method() === "POST",
      );

    const reloadAndReadRows = async (): Promise<PrioritizedConcept[]> => {
      const rowsRequestPromise = waitForRowsRequest();
      const reloadPromise = page.reload();
      const rows = await readRowsFromRequest(await rowsRequestPromise);
      await reloadPromise;
      return rows;
    };

    const persistedConcept = (
      rows: PrioritizedConcept[],
    ): PrioritizedConcept => {
      const concept = rows.find(row => String(row.ssCodigo) === conceptCode);
      expect(
        concept,
        `Expected /rows to contain displayed concept code ${conceptCode}`,
      ).toBeDefined();
      return concept!;
    };

    const initialRowsRequestPromise = waitForRowsRequest();
    const gotoPromise = page.goto(pageUrl);
    const initialRows = await readRowsFromRequest(await initialRowsRequestPromise);
    await gotoPromise;
    await expect(page).toHaveURL(/\/priorizacion-conceptos/);
    const initialConcept = persistedConcept(initialRows);
    conceptId = initialConcept.kaNlConcepto;
    const availableRow = prioritizationPage.availableConceptRow(conceptId);
    const priorityRow = prioritizationPage.priorityConceptRow(conceptId);
    test.skip(
      initialConcept.kaNlOrden !== null,
      "PLC-010 requires concept 1001 to start unprioritized",
    );

    try {
      // 1. Locate concept 1001 in the available table and assert its row displays SUELDO ORDINARIO ADMINISTRATIVO.
      await findRowAcrossPages(
        availableRow,
        prioritizationPage.availablePageSizeButton(100),
        prioritizationPage.availablePreviousPageButton,
        prioritizationPage.availableNextPageButton,
      );
      await expect(availableRow).toContainText(conceptCode);
      await expect(availableRow).toContainText(conceptName);

      // 2. Double-click concept 1001 and assert it appears exactly once in the priority table.
      await availableRow.dblclick();
      await findRowAcrossPages(
        priorityRow,
        prioritizationPage.priorityPageSizeButton(100),
        prioritizationPage.priorityPreviousPageButton,
        prioritizationPage.priorityNextPageButton,
      );
      await expect(priorityRow).toHaveCount(1);
      const displayedOrderText = (await priorityRow.locator("td").first().textContent())?.trim();
      const displayedOrder = Number(displayedOrderText);
      expect(displayedOrder).toBeGreaterThan(0);

      // 3. Assert Save changes from disabled to enabled.
      await expect(prioritizationPage.saveButton).toBeEnabled();

      // 4. Start waiting for the prioritization save response, then click Save.
      const saveResponsePromise = waitForSaveResponse();
      saveAttempted = true;
      await prioritizationPage.saveButton.click();
      const saveResponse = await saveResponsePromise;

      // 5. Assert the mutation request uses the documented method and endpoint and that its payload contains concept 1001 once with the priority order shown in the UI.
      expect(saveResponse.request().method()).toBe("POST");
      expect(saveResponse.url()).toBe(saveUrl);
      const savePayload = saveResponse.request().postDataJSON() as SavePayload;
      const savedConcepts = savePayload.ordenes.filter(
        concept => concept.kaNlConcepto === conceptId,
      );
      expect(savedConcepts).toEqual([
        { kaNlConcepto: conceptId, kaNlOrden: displayedOrder },
      ]);

      // 6. Assert the save response is successful and Save returns to disabled or another explicit saved-state indicator appears.
      expect(saveResponse.ok()).toBe(true);
      await expect(prioritizationPage.saveButton).toBeDisabled();
      await expect(
        page.getByText("Los parametros han sido configurados correctamente."),
      ).toBeVisible();

      // 7. Reload the page and wait for a fresh GET /rows response.
      const persistedRows = await reloadAndReadRows();

      // 8. Assert the response reports a non-null kaNlOrden for concept 1001.
      expect(persistedConcept(persistedRows).kaNlOrden).toBe(displayedOrder);

      // 9. Navigate to the priority page containing concept 1001 and assert its persisted row displays the expected ID, name, and order.
      await findRowAcrossPages(
        priorityRow,
        prioritizationPage.priorityPageSizeButton(100),
        prioritizationPage.priorityPreviousPageButton,
        prioritizationPage.priorityNextPageButton,
      );
      await expect(priorityRow).toContainText(String(displayedOrder));
      await expect(priorityRow).toContainText(conceptCode);
      await expect(priorityRow).toContainText(conceptName);
    } finally {
      // 10. If this test persisted concept 1001, reload the current server state, remove only concept 1001, save the cleanup, reload again, and assert /rows reports kaNlOrden === null for concept 1001.
      if (saveAttempted) {
        const currentRows = await reloadAndReadRows();
        if (persistedConcept(currentRows).kaNlOrden !== null) {
          await findRowAcrossPages(
            priorityRow,
            prioritizationPage.priorityPageSizeButton(100),
            prioritizationPage.priorityPreviousPageButton,
            prioritizationPage.priorityNextPageButton,
          );
          await priorityRow.dblclick();
          await expect(priorityRow).toHaveCount(0);
          await expect(prioritizationPage.saveButton).toBeEnabled();

          const cleanupResponsePromise = waitForSaveResponse();
          await prioritizationPage.saveButton.click();
          const cleanupResponse = await cleanupResponsePromise;
          expect(
            cleanupResponse.ok(),
            "PLC-010 cleanup save request must succeed",
          ).toBe(true);
          await expect(prioritizationPage.saveButton).toBeDisabled();

          const restoredRows = await reloadAndReadRows();
          expect(persistedConcept(restoredRows).kaNlOrden).toBeNull();
        }
      }
    }
  });
});
