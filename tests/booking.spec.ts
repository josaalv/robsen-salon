import { test, expect, type Page } from '@playwright/test'

// Pruebas E2E del agendamiento público (auditoría de agosto 2026, hallazgo
// H-13: hasta ahora el único testing de este flujo era manual — cada bug de
// esa sesión (login que no debía aparecer, F5 sirviendo el bundle
// equivocado, agendar sin pagar) se descubrió a mano, uno por uno). Corren
// contra el entorno de PREVIEW por defecto — nunca contra producción — para
// no ensuciar datos reales; dejan una cita/clienta de prueba reconocible
// (nombre con prefijo "E2E") en el schema 'preview'.
//
// Nota: se escribieron desde un sandbox donde Chromium no puede alcanzar
// dominios externos por HTTPS, así que no se pudieron correr desde ahí —
// se verificaron por primera vez en GitHub Actions (red real), lo que de
// paso confirmó en vivo el resto de la auditoría: el pago con anticipo sí
// redirige a Mercado Pago, y un F5 en /preview/booking ya no cae en login.
const PREVIEW = (process.env.ROBSEN_PREVIEW_URL || 'https://robseninterno.com/preview/').replace(/\/+$/, '') + '/'

async function irAAgendar(page: Page) {
  await page.goto(PREVIEW + 'booking')
  await expect(page.getByText('Elige tu servicio')).toBeVisible({ timeout: 15_000 })
}

async function elegirDiaYHora(page: Page) {
  // El primer chip de día suele venir preseleccionado; solo hace falta
  // asegurar que haya un horario disponible (no ".off") y elegirlo — si el
  // primer día no tiene ninguno libre, se prueban los siguientes.
  const dias = page.getByTestId('dia-chip')
  const totalDias = await dias.count()
  for (let i = 0; i < totalDias; i++) {
    await dias.nth(i).click()
    const libre = page.locator('[data-testid="hora-slot"]:not(.off)').first()
    if (await libre.count() > 0) {
      await libre.click()
      return
    }
  }
  throw new Error('No se encontró ningún horario disponible en los próximos días — revisar dias_abiertos/agenda en config.')
}

test.describe('Agendamiento público — sin anticipo', () => {
  test('se puede agendar de punta a punta un servicio sin anticipo', async ({ page }) => {
    await irAAgendar(page)

    const opciones = page.locator('[data-testid="servicio-opt"][data-anticipo="0"]')
    test.skip(await opciones.count() === 0, 'No hay ningún servicio en línea sin anticipo para probar este caso.')
    await opciones.first().click()
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByText('Elige a tu estilista')).toBeVisible()
    await page.getByTestId('prof-cualquiera').click()
    await page.getByRole('button', { name: 'Continuar' }).click()

    // getByRole('heading', ...) a propósito, no getByText: el nombre del
    // paso también aparece en el indicador lateral de pasos (ej. "3Fecha y
    // hora"), y con estos dos nombres coincide exactamente con el <h1> —
    // getByText encuentra ambos y truena en "strict mode violation".
    await expect(page.getByRole('heading', { name: 'Fecha y hora' })).toBeVisible()
    await elegirDiaYHora(page)
    await page.getByRole('button', { name: 'Continuar' }).click()

    await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible()
    await page.getByPlaceholder('Tu nombre').fill('E2E Prueba Automatizada')
    await page.getByPlaceholder('33 1234 5678').fill('33 1234 5678')

    const submit = page.getByTestId('submit-cita')
    await expect(submit).toHaveText('Solicitar cita')
    await submit.click()

    await expect(page.getByText('¡Solicitud recibida!')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Agendamiento público — con anticipo', () => {
  test('un servicio con anticipo redirige al checkout de Mercado Pago', async ({ page }) => {
    await irAAgendar(page)

    const conAnticipo = page.locator('[data-testid="servicio-opt"][data-anticipo="1"]')
    test.skip(await conAnticipo.count() === 0, 'No hay ningún servicio en línea con anticipo activo para probar este caso.')
    await conAnticipo.first().click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByTestId('prof-cualquiera').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await elegirDiaYHora(page)
    await page.getByRole('button', { name: 'Continuar' }).click()

    await page.getByPlaceholder('Tu nombre').fill('E2E Prueba Automatizada (anticipo)')
    await page.getByPlaceholder('33 1234 5678').fill('33 1234 5678')

    const submit = page.getByTestId('submit-cita')
    await expect(submit).toContainText('Pagar anticipo')

    // No se completa el pago (no hay credenciales de prueba de Mercado Pago
    // en CI) — solo se confirma que la app de verdad inicia la redirección
    // al checkout, que es la parte que nos compete a nosotros. La cita NO
    // se crea en este punto por diseño (ver H-07 en la auditoría): solo se
    // agenda del lado del servidor cuando el pago se confirma.
    await submit.click()
    await page.waitForURL(/mercadopago\.com/, { timeout: 20_000 })
  })
})

test.describe('Agendamiento público — resistente a caché', () => {
  test('un refresco duro en /booking no cae en la pantalla de login', async ({ page }) => {
    await irAAgendar(page)
    await page.reload()
    await expect(page.getByText('Elige tu servicio')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('¿Quién eres?')).not.toBeVisible()
  })
})
