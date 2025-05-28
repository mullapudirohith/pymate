"use strict";
// src/features/staticAnalysis.ts
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
exports.lintDocument = void 0;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const fast_xml_parser_1 = require("fast-xml-parser");
/** Parse JSON from Pylint and XML from Checkstyle */
function parseXml(xml) {
    return new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
}
/** Turn a finding into a VS Code Diagnostic */
function toDiagnostic(uri, line, col, msg, severity, source) {
    const rng = new vscode.Range(line - 1, col - 1, line - 1, col);
    const d = new vscode.Diagnostic(rng, msg, severity);
    d.source = source;
    return d;
}
function lintDocument(doc, collection) {
    if (doc.languageId !== 'python')
        return;
    const file = doc.uri.fsPath;
    // 1) Clear old issues  
    collection.set(doc.uri, []);
    // 2) Show output for debugging  
    const out = vscode.window.createOutputChannel('Pymate Static');
    out.show(true);
    out.appendLine(`\n🧹 Linting ${file}`);
    // 3) Run Pylint
    runPylint(doc, collection, out);
    // 4) (Optional) Run Checkstyle‐regex  
    runCheckstyle(doc, collection, out);
}
exports.lintDocument = lintDocument;
function runPylint(doc, collection, out) {
    const file = doc.uri.fsPath;
    // 🚀 Use `pylint` from PATH, not workspace python
    const pylintCmd = `pylint --output-format=json "${file}"`;
    out.appendLine(`🔍 [Pylint] ${pylintCmd}`);
    cp.exec(pylintCmd, { cwd: path.dirname(file), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (stderr) {
            // If pylint isn’t installed or not on PATH, stderr will help us know
            out.appendLine(`⚠️ [Pylint] stderr:\n${stderr.trim()}`);
            if (stderr.includes('command not found') || stderr.includes('is not recognized')) {
                vscode.window.showErrorMessage('Pylint not found on PATH. Please install pylint globally (e.g. `pip install pylint`).');
                return;
            }
        }
        let issues = [];
        try {
            issues = JSON.parse(stdout);
        }
        catch (e) {
            out.appendLine(`❌ [Pylint] JSON parse error: ${e}`);
        }
        const diags = [];
        for (const issue of issues) {
            const line = issue.line || 1;
            const col = issue.column || 1;
            const sevMap = {
                convention: vscode.DiagnosticSeverity.Information,
                refactor: vscode.DiagnosticSeverity.Hint,
                warning: vscode.DiagnosticSeverity.Warning,
                error: vscode.DiagnosticSeverity.Error,
                fatal: vscode.DiagnosticSeverity.Error
            };
            const sev = sevMap[issue.type] ?? vscode.DiagnosticSeverity.Warning;
            const msgId = issue['message-id'] || issue['messageId'] || '';
            const msg = `[${issue.symbol}] ${issue.message}${msgId ? ` (${msgId})` : ''}`;
            diags.push(toDiagnostic(doc.uri, line, col, msg, sev, 'pylint'));
        }
        out.appendLine(`✅ [Pylint] ${diags.length} issue(s) found`);
        const existing = collection.get(doc.uri) || [];
        collection.set(doc.uri, existing.concat(diags));
    });
}
function runCheckstyle(doc, collection, out) {
    const CHECKSTYLE_CFG = path.join(__dirname, '..', '..', 'checkstyle.xml');
    const file = doc.uri.fsPath;
    const cmd = `checkstyle -c "${CHECKSTYLE_CFG}" -f xml "${file}"`;
    out.appendLine(`🔍 [Checkstyle] ${cmd}`);
    cp.exec(cmd, { cwd: path.dirname(file), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (stderr)
            out.appendLine(`⚠️ [Checkstyle] stderr:\n${stderr.trim()}`);
        const existing = collection.get(doc.uri) || [];
        const diags = existing.slice();
        if (stdout) {
            const json = parseXml(stdout);
            const errors = json.checkstyle?.file?.error || [];
            for (const e of [].concat(errors)) {
                const line = parseInt(e['@_line'], 10);
                const col = parseInt(e['@_column'], 10);
                const sev = e['@_severity'] === 'error'
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
                const msg = `[Checkstyle] ${e['@_message']}`;
                diags.push(toDiagnostic(doc.uri, line, col, msg, sev, 'checkstyle'));
            }
        }
        out.appendLine(`✅ [Checkstyle] ${diags.length - existing.length} new issue(s)`);
        collection.set(doc.uri, diags);
    });
}
