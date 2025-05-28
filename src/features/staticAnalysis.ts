// src/features/staticAnalysis.ts

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

/** Parse JSON from Pylint and XML from Checkstyle */
function parseXml(xml: string): any {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(xml);
}

/** Turn a finding into a VS Code Diagnostic */
function toDiagnostic(
  uri: vscode.Uri,
  line: number,
  col: number,
  msg: string,
  severity: vscode.DiagnosticSeverity,
  source: string
): vscode.Diagnostic {
  const rng = new vscode.Range(line - 1, col - 1, line - 1, col);
  const d   = new vscode.Diagnostic(rng, msg, severity);
  d.source = source;
  return d;
}

export function lintDocument(doc: vscode.TextDocument, collection: vscode.DiagnosticCollection) {
  if (doc.languageId !== 'python') return;
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
function runPylint(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
  out: vscode.OutputChannel
) {
  const file = doc.uri.fsPath;
  // 🚀 Use `pylint` from PATH, not workspace python
  const pylintCmd = `pylint --output-format=json "${file}"`;

  out.appendLine(`🔍 [Pylint] ${pylintCmd}`);
  cp.exec(
    pylintCmd,
    { cwd: path.dirname(file), maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
      if (stderr) {
        // If pylint isn’t installed or not on PATH, stderr will help us know
        out.appendLine(`⚠️ [Pylint] stderr:\n${stderr.trim()}`);
        if (stderr.includes('command not found') || stderr.includes('is not recognized')) {
          vscode.window.showErrorMessage(
            'Pylint not found on PATH. Please install pylint globally (e.g. `pip install pylint`).'
          );
          return;
        }
      }

      let issues: any[] = [];
      try {
        issues = JSON.parse(stdout);
      } catch (e) {
        out.appendLine(`❌ [Pylint] JSON parse error: ${e}`);
      }

      const diags: vscode.Diagnostic[] = [];
      for (const issue of issues) {
        const line = issue.line || 1;
        const col  = issue.column || 1;
        const sevMap: Record<string, vscode.DiagnosticSeverity> = {
          convention: vscode.DiagnosticSeverity.Information,
          refactor:   vscode.DiagnosticSeverity.Hint,
          warning:    vscode.DiagnosticSeverity.Warning,
          error:      vscode.DiagnosticSeverity.Error,
          fatal:      vscode.DiagnosticSeverity.Error
        };
        const sev   = sevMap[issue.type] ?? vscode.DiagnosticSeverity.Warning;
        const msgId = issue['message-id'] || issue['messageId'] || '';
        const msg   = `[${issue.symbol}] ${issue.message}${msgId ? ` (${msgId})` : ''}`;

        diags.push(toDiagnostic(doc.uri, line, col, msg, sev, 'pylint'));
      }

      out.appendLine(`✅ [Pylint] ${diags.length} issue(s) found`);
      const existing = collection.get(doc.uri) || [];
      collection.set(doc.uri, existing.concat(diags));
    }
  );
}


function runCheckstyle(
  doc: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
  out: vscode.OutputChannel
) {
  const CHECKSTYLE_CFG = path.join(__dirname, '..', '..', 'checkstyle.xml');
  const file = doc.uri.fsPath;
  const cmd  = `checkstyle -c "${CHECKSTYLE_CFG}" -f xml "${file}"`;

  out.appendLine(`🔍 [Checkstyle] ${cmd}`);
  cp.exec(cmd, { cwd: path.dirname(file), maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (stderr) out.appendLine(`⚠️ [Checkstyle] stderr:\n${stderr.trim()}`);

    const existing = collection.get(doc.uri) || [];
    const diags    = existing.slice();

    if (stdout) {
      const json = parseXml(stdout);
      const errors = json.checkstyle?.file?.error || [];
      for (const e of ([] as any[]).concat(errors)) {
        const line = parseInt(e['@_line'], 10);
        const col  = parseInt(e['@_column'], 10);
        const sev  = e['@_severity'] === 'error'
          ? vscode.DiagnosticSeverity.Error
          : vscode.DiagnosticSeverity.Warning;
        const msg  = `[Checkstyle] ${e['@_message']}`;
        diags.push(toDiagnostic(doc.uri, line, col, msg, sev, 'checkstyle'));
      }
    }

    out.appendLine(`✅ [Checkstyle] ${diags.length - existing.length} new issue(s)`);
    collection.set(doc.uri, diags);
  });
}
