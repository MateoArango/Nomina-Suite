// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import type { Request } from "@playwright/test";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

const saveUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/actions/grabar";

test.describe("Activity lookup and modal behavior", () => {
  test("RP-015: Activity Cancel and Close discard a pending selection", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);
    const saveRequests: Request[] = [];
    const recordSaveRequest = (request: Request): void => {
      if (request.method() === "POST" && request.url() === saveUrl) {
        saveRequests.push(request);
      }
    };
    page.on("request", recordSaveRequest);

    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");
    await risksPage.createButton.click();

    const viewport = page.viewportSize();
    expect(viewport, "The Chromium project must provide a viewport").not.toBeNull();

    const visibleActivityRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
    );

    // 1. Capture the main activity value, open the modal, select a different activity, and click modal Cancel.
    const originalActivityValue = await risksPage.activityInput.inputValue();
    await risksPage.openActivityModalButton.click();
    await expect(visibleActivityRows.first()).toBeVisible();
    expect(
      await visibleActivityRows.count(),
      "RP-015 requires at least two visible runtime activity rows",
    ).toBeGreaterThanOrEqual(2);

    const cancelPendingRow = visibleActivityRows.first();
    const cancelPendingCells = cancelPendingRow.locator("td");
    const cancelPendingValue =
      `${(await cancelPendingCells.nth(0).innerText()).trim()} - ${(
        await cancelPendingCells.nth(1).innerText()
      ).trim()}`;
    expect(cancelPendingValue).not.toBe(originalActivityValue);

    await cancelPendingRow.click();
    await expect(cancelPendingRow).toHaveClass(/\bcurrent\b/);
    await risksPage.cancelActivityButton.click();

    await expect
      .poll(async () => (await risksPage.activityModal.boundingBox())?.x ?? -1)
      .toBeGreaterThanOrEqual(viewport!.width);
    await expect(risksPage.activityInput).toHaveValue(originalActivityValue);

    // 2. Repeat with the Close control in the modal header.
    await risksPage.openActivityModalButton.click();
    await expect(visibleActivityRows.first()).toBeVisible();

    const closePendingRow = visibleActivityRows.nth(1);
    const closePendingCells = closePendingRow.locator("td");
    const closePendingValue =
      `${(await closePendingCells.nth(0).innerText()).trim()} - ${(
        await closePendingCells.nth(1).innerText()
      ).trim()}`;
    expect(closePendingValue).not.toBe(originalActivityValue);

    await closePendingRow.click();
    await expect(closePendingRow).toHaveClass(/\bcurrent\b/);
    await risksPage.closeActivityModalButton.click();

    await expect
      .poll(async () => (await risksPage.activityModal.boundingBox())?.x ?? -1)
      .toBeGreaterThanOrEqual(viewport!.width);
    await expect(risksPage.activityInput).toHaveValue(originalActivityValue);
    expect(saveRequests).toHaveLength(0);

    page.off("request", recordSaveRequest);
  });
});
