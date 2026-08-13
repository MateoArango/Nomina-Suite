import { test, expect } from '@playwright/test';
import { JuzgadosPage } from '../pages/Juzgados.page';

test.describe('Juzgados', () => {
  test('fixed page elements are available', async ({ page }) => {
    const juzgadosPage = new JuzgadosPage(page);

    // Use "Record at cursor" here to add login and navigation steps.

    await expect(juzgadosPage.saveButton).toBeVisible();
    await expect(juzgadosPage.clearButton).toBeVisible();
    await expect(juzgadosPage.deleteButton).toBeVisible();
    await expect(juzgadosPage.codeInput).toBeVisible();
    await expect(juzgadosPage.nameInput).toBeVisible();
    await expect(juzgadosPage.abbreviationInput).toBeVisible();
    await expect(juzgadosPage.citySelect).toBeVisible();
    await expect(juzgadosPage.previousPageButton).toBeVisible();
    await expect(juzgadosPage.nextPageButton).toBeVisible();
  });
});
