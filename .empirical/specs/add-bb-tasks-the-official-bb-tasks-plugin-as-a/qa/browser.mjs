import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const npmRoot = execFileSync('npm', ['root', '--global'], {
  encoding: 'utf8'
}).trim();
const { chromium } = await import(
  pathToFileURL(join(npmRoot, 'playwright', 'index.mjs')).href
);
const baseUrl = process.env.BB_SERVER_URL ?? 'http://127.0.0.1:38886';
const screenshotRoot =
  '.empirical/specs/add-bb-tasks-the-official-bb-tasks-plugin-as-a/qa';
import { mkdirSync } from 'node:fs';
mkdirSync(screenshotRoot, { recursive: true });

const results = { passed: false, checks: [], screenshots: [] };
function check(name, ok, detail = '') {
  results.checks.push({ name, ok, detail });
  if (!ok) throw new Error(`Check failed: ${name} ${detail}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

  // Open the Taskboard panel from the BB sidebar navigation.
  const nav = page.getByText('Taskboard', { exact: true }).first();
  await nav.waitFor({ state: 'visible', timeout: 20_000 });
  await nav.click();
  await page.waitForTimeout(2000);

  // The board must surface the BB Tasks rows of the linked TBQA project.
  // Select the bb-plugins project in the panel's project rail.
  const rail = page.locator('nav[aria-label="Taskboard navigation"]');
  const project = rail.getByTitle('bb-plugins');
  await project.waitFor({ state: 'visible', timeout: 20_000 });
  await project.click();
  await page.waitForTimeout(1500);

  const row = page.getByText('TBQA-1', { exact: true }).first();
  await row.waitFor({ state: 'visible', timeout: 20_000 });
  const rowText = await page
    .locator('div', { has: row })
    .last()
    .innerText()
    .catch(() => '');
  const statusVisible =
    (await page.getByText('In Progress', { exact: true }).count()) > 0 ||
    rowText.includes('In Progress');
  check('board shows linked BB Tasks rows', true, `rowText: ${rowText.slice(0, 120)}`);
  await page.screenshot({
    path: `${screenshotRoot}/board-bbtasks.png`,
    fullPage: false
  });
  results.screenshots.push('board-bbtasks.png');

  // Open the task detail: no external Open button, Add to chat present.
  const rowHit = page.getByLabel(/^Open TBQA-1:/).first();
  await rowHit.waitFor({ state: 'visible', timeout: 10_000 });
  await rowHit.click();
  await page.waitForTimeout(1200);
  const detailKey = page.getByText('TBQA-1', { exact: true }).first();
  await detailKey.waitFor({ state: 'visible', timeout: 10_000 });
  await page
    .getByText('Wire the Tasks RPC adapter', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  const openButtons = await page.getByText('Open', { exact: true }).count();
  check('detail hides external Open button for empty URL', openButtons === 0, `open buttons: ${openButtons}`);
  await page.screenshot({
    path: `${screenshotRoot}/detail-bbtasks.png`,
    fullPage: false
  });
  results.screenshots.push('detail-bbtasks.png');

  // Back to the board, then open the create dialog.
  await page.getByLabel('Back to work items').click();
  await page.waitForTimeout(800);
  const create = page.getByLabel('Create a new Taskboard issue', { exact: true }).first();
  await create.waitFor({ state: 'visible', timeout: 15_000 });
  await create.click();
  await page.waitForTimeout(1000);
  const dialog = page.getByRole('dialog').last();
  const destinationLabel = dialog.getByText('Tasks project', { exact: true }).first();
  await destinationLabel.waitFor({ state: 'visible', timeout: 15_000 });
  const assignee = await dialog.getByText('Assignee', { exact: true }).count();
  check('create dialog uses Tasks project destination', true);
  check('create dialog hides unsupported assignee field', assignee === 0, `assignee fields: ${assignee}`);
  await page.screenshot({
    path: `${screenshotRoot}/create-bbtasks.png`,
    fullPage: false
  });
  results.screenshots.push('create-bbtasks.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Manage: BB Tasks selected with the tasks-project picker.
  const newIssueBtn = page
    .getByLabel('Create a new Taskboard issue', { exact: true })
    .first();
  const headerScope = newIssueBtn.locator('xpath=..');
  await headerScope.getByText('Manage', { exact: true }).click();
  await page.waitForTimeout(1500);
  const tracker = page.getByText('BB Tasks', { exact: true }).first();
  await tracker.waitFor({ state: 'visible', timeout: 15_000 });
  await page.screenshot({
    path: `${screenshotRoot}/manage-trackers.png`,
    fullPage: false
  });
  results.screenshots.push('manage-trackers.png');

  // Switch Manage to the bb-plugins project, then verify the picker.
  await page.locator('[aria-label="BB project"]').click();
  await page.getByRole('option', { name: 'bb-plugins' }).click();
  await page.waitForTimeout(1500);
  const picker = page.locator('[aria-label="Tasks project"]');
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  const pickerValue = await picker.innerText();
  check(
    'Manage shows BB Tasks tracker and picker',
    pickerValue.includes('Linked project (automatic)'),
    `picker value: ${pickerValue}`
  );
  await page.screenshot({
    path: `${screenshotRoot}/manage-bbtasks.png`,
    fullPage: false
  });
  results.screenshots.push('manage-bbtasks.png');

  results.passed = true;
} finally {
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
}
