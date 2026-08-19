import { expect, test } from '../fixtures/auth.fixture';

test('Seed Test', async ({ page }) => {
  await page.goto('https://nomina-qa.adacsc.co/riesgos-profesionales');
  await expect(page.getByTestId('app-shell-route-host').getByText('Riesgos Profesionales')).toBeVisible();
  await expect(page.locator('bds-button').filter({ hasText: 'Borrar seleccionados' })).toBeVisible();
  await expect(page.getByTestId('riesgos-profesionales-topbar-cancel-button')).toBeVisible();
  await expect(page.getByTestId('riesgos-profesionales-topbar-save-button')).toBeVisible();
  await expect(page.getByTestId('riesgos-profesionales-topbar-create-button')).toBeVisible();
  await expect(page.getByTestId('app-shell-topbar-host').getByText('Nómina')).toBeVisible();
  await page.getByTestId('riesgos-profesionales-form-codigo-input').click();
  await page.getByTestId('riesgos-profesionales-form-codigo-input').fill('SEE');
  await page.getByTestId('riesgos-profesionales-form-clase-input').click();
  await page.getByTestId('riesgos-profesionales-form-clase-input').fill('TEST');
  await page.getByText('Porcentaje: *').click();
  await page.getByTestId('riesgos-profesionales-form-porcentaje-input').fill('1');
  await page.getByTestId('riesgos-profesionales-actividad-modal-open-button').click();
  await expect(page.getByRole('banner').getByRole('heading', { name: 'Actividades' })).toBeVisible();
  await expect(page.locator('section').getByRole('heading', { name: 'Actividades' })).toBeVisible();
  await expect(page.getByTestId('riesgos-profesionales-form-actividad-input')).toBeVisible();
  await page
    .getByTestId('riesgos-profesionales-actividad-modal-option-row--1')
    .getByRole('cell', { name: 'Tejeduría de productos' })
    .click();
  await page
    .getByTestId('riesgos-profesionales-actividad-modal-option-row--1')
    .getByRole('cell', { name: 'Tejeduría de productos' })
    .click();
});
