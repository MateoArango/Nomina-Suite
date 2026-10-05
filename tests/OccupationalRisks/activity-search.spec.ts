// spec: specs/riesgos-profesionales-plan.md
// seed: tests/riesgosProfesionales/seed-test.spec.ts

import { expect, test } from "../fixtures/auth.fixture";
import { RiesgosProfesionalesPage } from "../../pages/RiesgosProfesionales.page";

type Activity = {
  kaNlActividad: number;
  scCodActividad: number;
  ssActividad: string;
};

const activitiesUrl =
  "https://nomina-qa-api.adacsc.co/api/v1/w-riesgos-profesionales/lookups/dddw-actividad-riesgo";

const normalizeSearchValue = (value: string | number): string =>
  String(value).toLocaleLowerCase("es");

const matchingActivities = (
  activities: Activity[],
  term: string,
): Activity[] => {
  const normalizedTerm = normalizeSearchValue(term);

  return activities.filter(
    activity =>
      normalizeSearchValue(activity.scCodActividad).includes(normalizedTerm) ||
      normalizeSearchValue(activity.ssActividad).includes(normalizedTerm),
  );
};

const activityIdFromRow = async (
  row: ReturnType<RiesgosProfesionalesPage["activityOptionRow"]>,
): Promise<number> => {
  const testId = await row.getAttribute("data-testid");
  const id = Number(testId?.split("--").at(-1));

  expect(id, `Unexpected activity row test ID: ${testId}`).toBeGreaterThan(0);
  return id;
};

test.describe("Activity lookup and modal behavior", () => {
  test("RP-017: Activity search handles matches, duplicates, and no-results", async ({
    page,
  }) => {
    const risksPage = new RiesgosProfesionalesPage(page);
    const activitiesResponsePromise = page.waitForResponse(
      response =>
        response.url() === activitiesUrl &&
        response.request().method() === "GET",
    );

    await page.goto("https://nomina-qa.adacsc.co/riesgos-profesionales");

    const activitiesResponse = await activitiesResponsePromise;
    expect(activitiesResponse.ok()).toBe(true);
    const activities = (await activitiesResponse.json()) as Activity[];
    expect(activities.length).toBeGreaterThan(0);

    await risksPage.createButton.click();
    await risksPage.openActivityModalButton.click();

    const visibleRows = risksPage.activityModal.locator(
      'tbody tr[data-testid^="riesgos-profesionales-actividad-modal-option-row--"]:visible',
    );
    const activityPager = risksPage.previousActivityPageButton.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " erp-table-pager ")][1]',
    );
    const activityPagerSummary = activityPager.locator(
      ".erp-table-pager__summary",
    );
    const initialVisibleIds = await visibleRows.evaluateAll(rows =>
      rows.map(row =>
        Number(row.getAttribute("data-testid")?.split("--").at(-1)),
      ),
    );
    expect(initialVisibleIds.length).toBeGreaterThan(0);

    const candidateTerms = activities.flatMap(activity =>
      activity.ssActividad
        .split(/[^\p{L}\p{N}]+/u)
        .filter(token => token.length >= 7),
    );
    const selectiveTerm = candidateTerms.find(term => {
      const matchCount = matchingActivities(activities, term).length;
      return matchCount > 0 && matchCount <= 10;
    });
    expect(
      selectiveTerm,
      "RP-017 requires a runtime-derived term with one to ten matches",
    ).toBeDefined();
    const selectiveMatches = matchingActivities(activities, selectiveTerm!);

    // 1. Derive a selective search term from the runtime lookup data, enter it in the modal search, and trigger search according to the current control behavior.
    await risksPage.openActivitySearchButton.click();
    await risksPage.activitySearchInput.fill(selectiveTerm!);

    await expect(visibleRows).toHaveCount(selectiveMatches.length);
    const selectiveVisibleIds = await visibleRows.evaluateAll(rows =>
      rows.map(row =>
        Number(row.getAttribute("data-testid")?.split("--").at(-1)),
      ),
    );
    expect(selectiveVisibleIds.sort((a, b) => a - b)).toEqual(
      selectiveMatches
        .map(activity => activity.kaNlActividad)
        .sort((a, b) => a - b),
    );

    for (const activity of selectiveMatches) {
      const row = risksPage.activityOptionRow(activity.kaNlActividad);
      await expect(row).toBeVisible();
      await expect(row.locator("td").nth(0)).toHaveText(
        String(activity.scCodActividad),
      );
      await expect(row.locator("td").nth(1)).toContainText(selectiveTerm!, {
        ignoreCase: true,
      });
    }

    const selectivePagerText =
      (await activityPagerSummary.textContent())?.trim() ?? "";
    const selectivePagerMatch = selectivePagerText.match(
      /^(\d+)-(\d+) de (\d+)$/,
    );
    expect(
      selectivePagerMatch,
      `Unexpected filtered activity pager summary: "${selectivePagerText}"`,
    ).not.toBeNull();
    expect(Number(selectivePagerMatch![1])).toBe(1);
    expect(Number(selectivePagerMatch![2])).toBe(selectiveMatches.length);
    expect(Number(selectivePagerMatch![3])).toBe(selectiveMatches.length);

    const activitiesByCode = new Map<number, Activity[]>();
    for (const activity of activities) {
      const group = activitiesByCode.get(activity.scCodActividad) ?? [];
      group.push(activity);
      activitiesByCode.set(activity.scCodActividad, group);
    }
    const duplicateGroup = [...activitiesByCode.values()].find(group => {
      if (group.length < 2) {
        return false;
      }

      const codeMatches = matchingActivities(
        activities,
        String(group[0].scCodActividad),
      );
      return codeMatches.length <= 10;
    });

    // 2. When duplicate displayed activity codes exist, verify rows remain distinguishable by kaNlActividad.
    if (duplicateGroup) {
      const duplicateCode = String(duplicateGroup[0].scCodActividad);
      await risksPage.activitySearchInput.fill(duplicateCode);

      const duplicateCodeMatches = matchingActivities(activities, duplicateCode);
      await expect(visibleRows).toHaveCount(duplicateCodeMatches.length);

      const duplicateIds = new Set<number>();
      for (const activity of duplicateGroup) {
        const row = risksPage.activityOptionRow(activity.kaNlActividad);
        await expect(row).toBeVisible();
        await expect(row.locator("td").nth(0)).toHaveText(duplicateCode);
        duplicateIds.add(await activityIdFromRow(row));
      }

      expect(duplicateIds.size).toBe(duplicateGroup.length);
    }

    let absentTerm = "RP017-NO-RESULTS";
    while (matchingActivities(activities, absentTerm).length > 0) {
      absentTerm += "X";
    }
    const originalActivityValue = await risksPage.activityInput.inputValue();

    // 3. Search for a generated value absent from the lookup response.
    await risksPage.activitySearchInput.fill(absentTerm);

    await expect(visibleRows).toHaveCount(0);
    await expect(
      risksPage.activityModal.getByText(
        "No existen actividades que coincidan con la búsqueda.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(risksPage.previousActivityPageButton).toBeHidden();
    await expect(risksPage.nextActivityPageButton).toBeHidden();
    await expect(risksPage.acceptActivityButton).toBeDisabled();
    await expect(risksPage.activityInput).toHaveValue(originalActivityValue);

    // 4. Clear search.
    await risksPage.activitySearchInput.fill("");

    await expect(visibleRows).toHaveCount(initialVisibleIds.length);
    const restoredVisibleIds = await visibleRows.evaluateAll(rows =>
      rows.map(row =>
        Number(row.getAttribute("data-testid")?.split("--").at(-1)),
      ),
    );
    expect(restoredVisibleIds).toEqual(initialVisibleIds);
    await expect(activityPagerSummary).toHaveText(
      `1-${Math.min(initialVisibleIds.length, activities.length)} de ${activities.length}`,
    );
    await expect(risksPage.previousActivityPageButton).toBeDisabled();
    if (activities.length > initialVisibleIds.length) {
      await expect(risksPage.nextActivityPageButton).toBeEnabled();
    } else {
      await expect(risksPage.nextActivityPageButton).toBeDisabled();
    }
  });
});
