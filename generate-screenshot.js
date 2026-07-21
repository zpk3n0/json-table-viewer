const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getHtml } = require('./out/webview');
const { buildTable } = require('./out/tableModel');

const data = [
  { id: 1, name: 'Ada Lovelace', role: 'Mathematician', city: 'London', active: true },
  { id: 2, name: 'Alan Turing', role: 'Computer Scientist', city: 'Maida Vale', active: false },
  { id: 3, name: 'Grace Hopper', role: 'Rear Admiral', city: 'New York', active: true },
  { id: 4, name: 'Katherine Johnson', role: 'Physicist', city: 'White Sulphur Springs', active: true },
  { id: 5, name: 'Margaret Hamilton', role: 'Software Engineer', city: 'Paoli', active: false },
  { id: 6, name: 'Radia Perlman', role: 'Software Engineer', city: 'Portland', active: true },
];

// Dark+ -like theme token values so the screenshot matches how it renders inside VS Code.
const THEME_VARS = `
  --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --vscode-editor-foreground: #cccccc;
  --vscode-editor-background: #1e1e1e;
  --vscode-panel-border: #454545;
  --vscode-input-background: #3c3c3c;
  --vscode-input-foreground: #cccccc;
  --vscode-input-border: #3c3c3c;
  --vscode-descriptionForeground: #9d9d9d;
  --vscode-list-hoverBackground: #2a2d2e;
  --vscode-editor-findMatchHighlightBackground: #ea5c0055;
  --vscode-button-secondaryBackground: #3a3d41;
  --vscode-button-secondaryForeground: #ffffff;
  --vscode-button-secondaryHoverBackground: #45494e;
  --vscode-textLink-foreground: #3794ff;
`;

async function main() {
  const model = buildTable(data);
  let html = getHtml('', model, 'employees.json');
  html = html.replace('<head>', `<head>\n<style>:root {${THEME_VARS}}</style>`);

  const tmpFile = path.join(__dirname, '.screenshot-source.html');
  fs.writeFileSync(tmpFile, html);

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 760, height: 460, deviceScaleFactor: 2 });
    await page.goto('file://' + tmpFile);

    // Demonstrate search highlighting, an active sort, and the column picker open.
    await page.type('#search', 'software');
    await page.click('th'); // sort by the first column (id)
    await page.click('#column-picker-toggle');
    const checkboxes = await page.$$('#column-picker-menu input[type="checkbox"]');
    await checkboxes[3].click(); // uncheck "city" to show it toggled off

    const contentHeight = await page.evaluate(() => {
      const menu = document.getElementById('column-picker-menu');
      const table = document.getElementById('table');
      return Math.max(menu.getBoundingClientRect().bottom, table.getBoundingClientRect().bottom);
    });

    const outPath = path.join(__dirname, 'images', 'screenshot.png');
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 760, height: Math.ceil(contentHeight) + 10 } });
    console.log('Saved', outPath);
  } finally {
    await browser.close();
    fs.unlinkSync(tmpFile);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
