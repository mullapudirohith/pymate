import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

function parse(filePath: string): Record<string, string[]> {
    const data = yaml.load(fs.readFileSync(filePath, 'utf8')) as any;
    const deps: Record<string, string[]> = {};
    for (const service in data.services || {}) {
        const d = data.services[service].depends_on;
        if (d) {
            deps[service] = Array.isArray(d) ? d : [d];
        }
    }
    return deps;
}

function genMermaid(deps: Record<string, string[]>): string {
    // Start graph with a real newline
    let graph = 'graph TD\n';
    for (const service in deps) {
        for (const dep of deps[service]) {
            // Append with a real newline, not an escaped backslash-n
            graph += `  ${service} --> ${dep}\n`;
        }
    }
    return graph;
}

export function showDependencyGraph() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'yaml') {
        vscode.window.showErrorMessage('Open a Docker Compose YAML file.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const deps = parse(filePath);

    if (Object.keys(deps).length === 0) {
        vscode.window.showErrorMessage('No service dependencies found.');
        return;
    }

    const mermaidSrc = genMermaid(deps);
    const panel = vscode.window.createWebviewPanel(
        'docker-compose-dependency-graph',
        'Dependency Graph',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dependency Graph</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true });
  </script>
</head>
<body>
  <div class="mermaid">
${mermaidSrc}
  </div>
</body>
</html>`;
}
