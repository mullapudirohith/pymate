import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Extracts the source code of a function (signature + body) from a Python file.
 */
function extractFunctionCode(filePath: string, signature: string): string {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const sigTrimmed = signature.replace(/:$/, '').trim();
  const startIdx = lines.findIndex(l => l.trim().startsWith(sigTrimmed));
  if (startIdx < 0) {
    return signature; // fallback
  }
  // Determine indentation of signature line
  const indentMatch = lines[startIdx].match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1] : '';
  const snippet: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    // Stop once outdented back to or above baseIndent (but include signature line)
    if (i > startIdx && !line.startsWith(baseIndent + ' ') && !line.startsWith(baseIndent + '\t')) {
      break;
    }
    snippet.push(line);
  }
  return snippet.join('\n');
}

let lastUntested: Array<{ file: string; functions: Array<{ name: string; signature: string }> }> = [];

export function runTestsCoverage() {
  const wsFolder = vscode.workspace.workspaceFolders?.[0];
  if (!wsFolder) {
    vscode.window.showErrorMessage('Open a workspace first');
    return;
  }
  const ws = wsFolder.uri.fsPath;

  // Determine Python interpreter
  const pymateCfg = vscode.workspace.getConfiguration('pymate');
  let pythonPath = pymateCfg.get<string>('pythonPath')?.trim();
  if (!pythonPath) {
    const pyCfg = vscode.workspace.getConfiguration('python');
    pythonPath =
      pyCfg.get<string>('defaultInterpreterPath') ||
      pyCfg.get<string>('pythonPath') ||
      'python3';
  }

  const output = vscode.window.createOutputChannel('Pymate');
  output.show();
  output.appendLine(`Running pytest with coverage using interpreter: ${pythonPath}`);

  // Run pytest covering entire workspace
  const pytestCmd = [
    pythonPath, '-m', 'pytest',
    '--cov=.',
    '--cov-report=html:coverage_html',
    '--cov-report=json:coverage.json'
  ].join(' ');
  cp.exec(pytestCmd, { cwd: ws, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (stdout) output.appendLine(stdout);
    if (stderr) output.appendLine(stderr);

    const covJson = path.join(ws, 'coverage.json');
    if (!fs.existsSync(covJson)) {
      vscode.window.showErrorMessage('No coverage data found. Did pytest-cov run?');
      return;
    }

    // Analyze coverage with the bundled Python script
    const script = path.join(__dirname, '..', '..', 'analyze_coverage.py');
    output.appendLine(`Analyzing coverage with: ${pythonPath} ${script}`);
    cp.exec(
      `${pythonPath} "${script}" "${covJson}"`,
      { cwd: ws, maxBuffer: 1024 * 1024 },
      (err2, so2, se2) => {
        if (se2) output.appendLine(se2.toString());
        try {
          const res = JSON.parse(so2.toString());
          lastUntested = res.untested || [];
        } catch {
          vscode.window.showErrorMessage('Failed to parse coverage analysis output');
          return;
        }
        vscode.window
          .showInformationMessage('Coverage analysis complete', 'Open Report')
          .then(choice => {
            if (choice === 'Open Report') {
              const report = path.join(ws, 'coverage_html', 'index.html');
              vscode.env.openExternal(vscode.Uri.file(report));
            }
          });
      }
    );
  });
}

export function suggestTests() {
    if (!lastUntested) {
      vscode.window.showInformationMessage('Run coverage first');
      return;
    }
    const output = vscode.window.createOutputChannel('Pymate');
    output.show();
  
    const apiKey = vscode.workspace.getConfiguration('pymate').get<string>('openaiApiKey');
    if (!apiKey) {
      output.appendLine('OpenAI API key not set. Untested functions:');
      lastUntested.forEach((e: any) =>
        e.functions.forEach((fn: any) =>
          output.appendLine(`- ${fn.name} (in ${path.basename(e.file)})`)
        )
      );
      return;
    }
  
    output.appendLine('=== Generating test case suggestions via Chat Completions API ===');
    output.appendLine(`Found ${lastUntested.length} untested function(s).`);
  
    (async () => {
      for (const entry of lastUntested) {
        for (const fn of entry.functions) {
          const prompt = `Write a pytest test for:\n${fn.signature}`;
          output.appendLine(`→ [DEBUG] About to POST to OpenAI for ${fn.name}()`);
  
          // 1) Quick network‐reachability test
          try {
            const ping = await axios.get('https://api.openai.com/v1/models', {
              headers: { Authorization: `Bearer ${apiKey}` },
              timeout: 5000
            });
            output.appendLine(`← [DEBUG] Models endpoint reachable: status ${ping.status}`);
          } catch (pingErr: any) {
            output.appendLine(`! [ERROR] Cannot reach OpenAI models: ${pingErr.message}`);
            return;
          }
  
          // 2) Actual chat completion call
          try {
            const resp = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-3.5-turbo',
                messages: [
                  { role: 'system', content: 'You are a pytest‐writing assistant.' },
                  { role: 'user', content: prompt }
                ],
                max_tokens: 200,
                temperature: 0
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`
                },
                timeout: 10000
              }
            );
            output.appendLine(`← [DEBUG] Received status ${resp.status} from OpenAI`);
            output.appendLine(resp.data.choices[0].message.content.trim());
          } catch (callErr: any) {
            const status = callErr.response?.status;
            const msg = callErr.response?.data?.error?.message || callErr.message;
            output.appendLine(`! Error during OpenAI call for ${fn.name}() [${status}]: ${msg}`);
          }
        }
      }
      vscode.window.showInformationMessage('Done generating suggestions.');
    })();
  }
  
