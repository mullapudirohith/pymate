"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDependencyGraph = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
function parse(filePath) {
    const data = yaml.load(fs.readFileSync(filePath, 'utf8'));
    const deps = {};
    for (const service in data.services || {}) {
        const d = data.services[service].depends_on;
        if (d) {
            deps[service] = Array.isArray(d) ? d : [d];
        }
    }
    return deps;
}
function genMermaid(deps) {
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
function showDependencyGraph() {
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
    const panel = vscode.window.createWebviewPanel('docker-compose-dependency-graph', 'Dependency Graph', vscode.ViewColumn.One, { enableScripts: true });
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
exports.showDependencyGraph = showDependencyGraph;
