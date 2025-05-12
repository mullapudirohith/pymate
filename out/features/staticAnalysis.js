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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fast_xml_parser_1 = require("fast-xml-parser");
const DEFAULT_CHECKSTYLE = path.join(__dirname, '..', '..', 'checkstyle.xml');
const PMD_RULESET = path.join(__dirname, '..', '..', 'pmd-ruleset.xml');
const PMD_PYTHON_PLUGIN = path.join(__dirname, '..', '..', 'lib', 'pmd-python-plugin.jar');
function parseXml(xml) {
    return new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
}
function toDiagnostic(uri, line, col, msg, severity, source) {
    const range = new vscode.Range(line - 1, col - 1, line - 1, col);
    const d = new vscode.Diagnostic(range, msg, severity);
    d.source = source;
    return d;
}
function lintDocument(doc, collection) {
    if (doc.languageId !== 'python')
        return;
    // clear old
    collection.set(doc.uri, []);
    const out = vscode.window.createOutputChannel('Pymate Static');
    out.show(true);
    out.appendLine(`\n🧹 Linting ${doc.uri.fsPath}`);
    runPmd(doc, collection, out);
    runCheckstyle(doc, collection, out);
}
exports.lintDocument = lintDocument;
function runPmd(doc, collection, out) {
    const file = doc.uri.fsPath;
    if (!fs.existsSync(PMD_PYTHON_PLUGIN)) {
        vscode.window.showErrorMessage('PMD Python plugin missing: place pmd-python-plugin.jar into the extension\'s lib/ folder.');
        return;
    }
    const cmd = [
        'pmd', 'check',
        '--dir', `"${file}"`,
        '--rulesets', `"${PMD_RULESET}"`,
        '--format', 'xml',
        '--aux-classpath', `"${PMD_PYTHON_PLUGIN}"`
    ].join(' ');
    out.appendLine(`🔍 [PMD] ${cmd}`);
    cp.exec(cmd, { cwd: path.dirname(file), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (stderr)
            out.appendLine(`⚠️ [PMD] stderr:\n${stderr.trim()}`);
        if (stderr.includes('Cannot resolve rule/ruleset') || stderr.includes('Unknown language')) {
            vscode.window.showErrorMessage('PMD failed to load Python ruleset. Verify pmd-python-plugin.jar is in lib/ and matches your PMD version.');
            return;
        }
        const diags = [];
        if (stdout) {
            try {
                const json = parseXml(stdout);
                const violations = json.pmd?.file?.violation || [];
                for (const v of [].concat(violations)) {
                    const line = parseInt(v['@_beginline'], 10);
                    const col = parseInt(v['@_begincolumn'], 10);
                    const msg = `[PMD ${v['@_rule']}] ${v['#text'].trim()}`;
                    diags.push(toDiagnostic(doc.uri, line, col, msg, vscode.DiagnosticSeverity.Warning, 'pmd'));
                }
            }
            catch (e) {
                out.appendLine(`❌ [PMD] parse error: ${e}`);
            }
        }
        out.appendLine(`✅ [PMD] ${diags.length} issue(s) found`);
        collection.set(doc.uri, diags);
    });
}
function runCheckstyle(doc, collection, out) {
    const file = doc.uri.fsPath;
    // 1) Get user override
    const userPath = vscode.workspace.getConfiguration('pymate').get('checkstyleConfigPath')?.trim() || '';
    const cfgPath = userPath && fs.existsSync(userPath)
        ? userPath
        : DEFAULT_CHECKSTYLE;
    out.appendLine(`🔍 [Checkstyle] using config: ${cfgPath}`);
    // 2) Invoke Checkstyle
    const cmd = `checkstyle -c "${cfgPath}" -f xml "${file}"`;
    out.appendLine(`🔍 [Checkstyle] ${cmd}`);
    cp.exec(cmd, { cwd: path.dirname(file), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
        if (stderr)
            out.appendLine(`⚠️ [Checkstyle] stderr:\n${stderr.trim()}`);
        const existing = collection.get(doc.uri) || [];
        const diags = existing.slice();
        if (stdout) {
            try {
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
            catch (e) {
                out.appendLine(`❌ [Checkstyle] parse error: ${e}`);
            }
        }
        out.appendLine(`✅ [Checkstyle] ${diags.length - existing.length} new issue(s)`);
        collection.set(doc.uri, diags);
    });
}
