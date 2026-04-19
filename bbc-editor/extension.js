const vscode = require('vscode');
const bbc = require('bulletin-board-code');

let panel = null;
let currentDocument = null;
let updateTimer = null;

const parser = new bbc.Parser();

function activate(context) {
    const previewCommand = vscode.commands.registerCommand('bbcode.preview', openPreview);

    const changeListener = vscode.workspace.onDidChangeTextDocument(onDocumentChange);
    const switchListener = vscode.window.onDidChangeActiveTextEditor(onEditorSwitch);

    context.subscriptions.push(previewCommand, changeListener, switchListener);
}

function openPreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    currentDocument = editor.document;

    if (panel) {
        panel.reveal(vscode.ViewColumn.Beside);
    } else {
        panel = vscode.window.createWebviewPanel(
            'bbcodePreview',
            'BBCode Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: false,
                retainContextWhenHidden: true
            }
        );

        panel.onDidDispose(() => {
            panel = null;
            currentDocument = null;
        });
    }

    scheduleUpdate();
}

function onDocumentChange(event) {
    if (!panel || !currentDocument) return;
    if (event.document === currentDocument) {
        scheduleUpdate();
    }
}

function onEditorSwitch(editor) {
    if (!panel || !editor) return;

    currentDocument = editor.document;
    scheduleUpdate();
}

function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updatePreview, 80);
}

const TOKENS = {
    BR: '%%BB_BR%%'
};

function preprocess(text) {
    return text
        .replace(/\[br\/?\]/gi, TOKENS.BR)
        .replace(/\[newline\]/gi, TOKENS.BR);
}

function postprocess(html) {
    return html
        .replace(new RegExp(TOKENS.BR, 'g'), '<br/>');
}

function updatePreview() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !panel) return;

        const raw = editor.document.getText();

        const pre = preprocess(raw);
        const parsed = parser.toHTML(pre);
        const final = postprocess(parsed);

        panel.webview.html = renderHtml(final, panel.webview);
    } catch (err) {
        panel.webview.html = renderError(err);
    }
}

function renderHtml(content, webview) {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src 'unsafe-inline';
               img-src data: https:;
               font-src https:;
               script-src 'nonce-${nonce}';">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
${baseStyles()}
</style>

</head>
<body>
<div class="bb-root">
${content}
</div>
</body>
</html>`;
}

function renderError(err) {
    return `<!DOCTYPE html>
<html>
<body style="font-family: monospace; color: red;">
<pre>${escapeHtml(err.stack || String(err))}</pre>
</body>
</html>`;
}

function baseStyles() {
    return `
:root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-editor-foreground);
    --link: var(--vscode-textLink-foreground);
    --border: var(--vscode-editorGroup-border);
    --code-bg: var(--vscode-textCodeBlock-background, rgba(0,0,0,0.2));
    --quote-border: var(--vscode-textBlockQuote-border);
}

body {
    margin: 0;
    padding: 1rem;
    background: color-mix(in oklab, var(--bg), black 12.5%);
    color: var(--fg);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.bb-root {
    max-width: 900px;
    margin: auto;
}

a {
    color: var(--link);
    text-decoration: none;
}
a:hover {
    text-decoration: underline;
}

pre {
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid var(--border);
}

code {
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

blockquote {
    border-left: 4px solid var(--quote-border);
    padding-left: 1rem;
    margin: 1rem 0;
}

img {
    max-width: 100%;
    border-radius: 6px;
}

table {
    border-collapse: collapse;
    width: 100%;
}

td, th {
    border: 1px solid var(--border);
    padding: 0.5rem;
}

body.vscode-light {
    --code-bg: #f3f3f3;
}

body.vscode-dark {
    --code-bg: #1e1e1e;
}

body.vscode-high-contrast {
    outline: 1px solid var(--fg);
}
`;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getNonce() {
    return Math.random().toString(36).slice(2);
}

function deactivate() {}

module.exports = { activate, deactivate };
