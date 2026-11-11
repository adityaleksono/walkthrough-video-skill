// Example recording script. Copy it next to your own scenes.json and rewrite the scenes.
//
//   node record.cjs <folder-with-playwright> <out-dir> <durations.json> [dry]
//
// Run it with "dry" first: nothing is recorded and nothing waits for the voice, so a wrong
// selector shows up in seconds instead of after a full take.
const path = require('path');
const wt = require('../scripts/walkthrough.cjs');

const [, , playwrightFrom, out, scenes, mode] = process.argv;

wt.record(
  {
    playwrightFrom,
    out,
    scenes,
    dry: mode === 'dry',
    // For a real app: baseURL: 'http://localhost:3000', and sign in off camera:
    // login: async (page) => {
    //   await page.goto('/login');
    //   await page.getByLabel('Email').fill(process.env.DEMO_EMAIL);
    //   await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD);
    //   await page.getByRole('button', { name: 'Sign in' }).click();
    //   await page.waitForURL(/dashboard/);
    // },
  },
  async ({ page, scene, ring, moveTo, clickAt, typeInto, step, card, wait }) => {
    await page.goto('file://' + path.join(__dirname, 'app', 'index.html'));
    await page.getByRole('heading', { name: 'Team tasks' }).waitFor();
    await wait(1000);

    await step('Step 1 of 2 · Add a task');
    await scene('01', async () => {
      await ring(page.locator('#list'));
      await wait(2500);
      await ring(null);
    });

    await scene('02', async () => {
      const add = page.getByRole('button', { name: 'Add task' });
      await ring(add);
      await clickAt(add);
      await ring(null);
      await typeInto(page.getByLabel('Task name'), 'Prepare the quarterly demo');
      await clickAt(page.getByRole('button', { name: 'Save task' }));
    });

    await scene('03', async () => {
      await ring(page.locator('li.task').first());
      await wait(1800);
      await ring(null);
    });

    await step('Step 2 of 2 · Hide finished tasks');
    await scene('04', async () => {
      const filter = page.getByLabel('Show');
      await ring(filter);
      await moveTo(filter, 1200);
      // A native <select> opens outside the page, so it would not be in the recording. Set it directly.
      await filter.selectOption('open');
      await wait(600);
      await ring(null);
    });

    // When a setting changes what is on screen, say what it was and what it is now.
    await scene('05', async () => {
      await card({
        before: { title: 'Before · 5 tasks', items: ['Prepare the quarterly demo', 'Draft the release notes', { text: 'Review the pricing page', mark: 'gone' }, 'Book the demo room', { text: 'Send the onboarding survey', mark: 'gone' }] },
        after: { title: 'After · 3 open tasks', items: ['Prepare the quarterly demo', 'Draft the release notes', 'Book the demo room'] },
      });
      await wait(3500);
      await card(null);
    });

    await scene('06', async () => {
      await step(null);
      await card({ title: 'Team tasks', subtitle: 'Add task · Show open only' });
      await wait(1500);
    });
  },
).catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
