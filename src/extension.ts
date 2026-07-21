import * as vscode from 'vscode';
import { buildTable } from './tableModel';
import { getHtml } from './webview';

const log = vscode.window.createOutputChannel('JSON Table Viewer');

async function readSourceText(uri: vscode.Uri): Promise<string> {
  log.appendLine(
    `readSourceText: uri=${uri.toString()} scheme=${uri.scheme} openDocs=[${vscode.workspace.textDocuments
      .map((d) => d.uri.toString())
      .join(', ')}]`
  );
  // An already-open document (including an unsaved "untitled:" buffer, or a saved
  // file with unsaved edits) has no on-disk representation fs.readFile can reach,
  // and its live buffer is more up to date than disk anyway.
  const openDocument = vscode.workspace.textDocuments.find(
    (doc) => doc.uri.toString() === uri.toString()
  );
  if (openDocument) {
    const text = openDocument.getText();
    log.appendLine(`readSourceText: matched open document, length=${text.length}`);
    return text;
  }
  const bytes = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(bytes).toString('utf8');
  log.appendLine(`readSourceText: read from disk, length=${text.length}`);
  return text;
}

function getErrorHtml(message: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: var(--vscode-font-family); padding: 1rem; color: var(--vscode-errorForeground);">
<p>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
</body></html>`;
}

async function renderTable(
  uri: vscode.Uri,
  webview: vscode.Webview,
  notifyOnError: boolean
): Promise<void> {
  let text: string;
  try {
    text = await readSourceText(uri);
  } catch (err) {
    const message = `Could not read file: ${(err as Error).message}`;
    if (notifyOnError) {
      vscode.window.showErrorMessage(message);
    }
    webview.html = getErrorHtml(message);
    return;
  }

  let data: unknown;
  try {
    if (text.trim() === '' && uri.scheme === 'untitled') {
      // VS Code's custom-editor handoff doesn't carry over an unsaved buffer's
      // content when switching editor types, so this reads as empty even when
      // the buffer visibly has text in it. JSON.parse('') would just report
      // "Unexpected end of JSON input", which misleadingly points at the JSON
      // itself rather than this handoff gap.
      throw new Error(
        'This unsaved file appears empty from this view. "Reopen Editor With" ' +
          'cannot read unsaved content for a not-yet-saved file — use ' +
          '"View as Table" from the Command Palette instead, or save the file first.'
      );
    }
    data = JSON.parse(text);
  } catch (err) {
    const message =
      err instanceof SyntaxError ? `Invalid JSON: ${err.message}` : (err as Error).message;
    if (notifyOnError) {
      vscode.window.showErrorMessage(message);
    }
    webview.html = getErrorHtml(message);
    return;
  }

  const title = uri.path.split('/').pop() ?? 'JSON';
  const model = buildTable(data);
  webview.html = getHtml(webview.cspSource, model, title);
}

// Reuse one panel per file instead of creating a new one on every invocation,
// which would otherwise silently pile up hidden webview panels (each a full
// Chromium frame kept alive via retainContextWhenHidden) if the command is run
// more than once for the same file, e.g. while retrying after an error.
const openPanels = new Map<string, vscode.WebviewPanel>();

async function viewAsTable(uri?: vscode.Uri): Promise<void> {
  log.appendLine(`viewAsTable: invoked with uri=${uri?.toString() ?? '(none, using active editor)'}`);
  let targetUri = uri;
  if (!targetUri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage(
        'Open a JSON file or right-click one in the Explorer to view it as a table.'
      );
      return;
    }
    targetUri = editor.document.uri;
  }

  const key = targetUri.toString();
  const existingPanel = openPanels.get(key);
  if (existingPanel) {
    existingPanel.reveal(vscode.ViewColumn.Beside);
    await renderTable(targetUri, existingPanel.webview, true);
    return;
  }

  const title = targetUri.path.split('/').pop() ?? 'JSON';
  const panel = vscode.window.createWebviewPanel(
    'jsonTableViewer',
    `Table: ${title}`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true }
  );
  openPanels.set(key, panel);
  panel.onDidDispose(() => openPanels.delete(key));
  await renderTable(targetUri, panel.webview, true);
}

class TableEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    log.appendLine(`resolveCustomEditor: invoked with uri=${document.uri.toString()}`);
    webviewPanel.webview.options = { enableScripts: true };
    // notifyOnError is false here: VS Code can silently reopen this editor on
    // startup to restore a previous session's layout, and popping an error
    // toast every time that happens (for content the user isn't actively
    // acting on) is unwanted noise. The in-panel error message is enough.
    await renderTable(document.uri, webviewPanel.webview, false);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    log,
    vscode.commands.registerCommand('jsonTableViewer.viewAsTable', viewAsTable),
    vscode.window.registerCustomEditorProvider('jsonTableViewer.tableEditor', new TableEditorProvider(), {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

export function deactivate(): void {}
