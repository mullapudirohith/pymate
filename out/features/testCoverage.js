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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestTests = exports.runTestsCoverage = void 0;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const axios_1 = __importDefault(require("axios"));
/**
 * Extracts the source code of a function (signature + body) from a Python file.
 */
function extractFunctionCode(filePath, signature) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const sigTrimmed = signature.replace(/:$/, '').trim();
    const startIdx = lines.findIndex(l => l.trim().startsWith(sigTrimmed));
    if (startIdx < 0) {
        return signature; // fallback
    }
    // Determine indentation of signature line
    const indentMatch = lines[startIdx].match(/^(\s*)/);
    const baseIndent = indentMatch ? indentMatch[1] : '';
    const snippet = [];
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
let lastUntested = [];
function runTestsCoverage() {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) {
        vscode.window.showErrorMessage('Open a workspace first');
        return;
    }
    const ws = wsFolder.uri.fsPath;
    // Determine Python interpreter
    const pymateCfg = vscode.workspace.getConfiguration('pymate');
    let pythonPath = pymateCfg.get('pythonPath')?.trim();
    if (!pythonPath) {
        const pyCfg = vscode.workspace.getConfiguration('python');
        pythonPath =
            pyCfg.get('defaultInterpreterPath') ||
                pyCfg.get('pythonPath') ||
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
        if (stdout)
            output.appendLine(stdout);
        if (stderr)
            output.appendLine(stderr);
        const covJson = path.join(ws, 'coverage.json');
        if (!fs.existsSync(covJson)) {
            vscode.window.showErrorMessage('No coverage data found. Did pytest-cov run?');
            return;
        }
        // Analyze coverage with the bundled Python script
        const script = path.join(__dirname, '..', '..', 'analyze_coverage.py');
        output.appendLine(`Analyzing coverage with: ${pythonPath} ${script}`);
        cp.exec(`${pythonPath} "${script}" "${covJson}"`, { cwd: ws, maxBuffer: 1024 * 1024 }, (err2, so2, se2) => {
            if (se2)
                output.appendLine(se2.toString());
            try {
                const res = JSON.parse(so2.toString());
                lastUntested = res.untested || [];
            }
            catch {
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
        });
    });
}
exports.runTestsCoverage = runTestsCoverage;
function suggestTests() {
    if (!lastUntested) {
        vscode.window.showInformationMessage('Run coverage first');
        return;
    }
    const output = vscode.window.createOutputChannel('Pymate');
    output.show();
    const apiKey = vscode.workspace.getConfiguration('pymate').get('openaiApiKey');
    if (!apiKey) {
        output.appendLine('OpenAI API key not set. Untested functions:');
        lastUntested.forEach((e) => e.functions.forEach((fn) => output.appendLine(`- ${fn.name} (in ${path.basename(e.file)})`)));
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
                    const ping = await axios_1.default.get('https://api.openai.com/v1/models', {
                        headers: { Authorization: `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    output.appendLine(`← [DEBUG] Models endpoint reachable: status ${ping.status}`);
                }
                catch (pingErr) {
                    output.appendLine(`! [ERROR] Cannot reach OpenAI models: ${pingErr.message}`);
                    return;
                }
                // 2) Actual chat completion call
                try {
                    const resp = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: 'You are a pytest‐writing assistant.' },
                            { role: 'user', content: prompt }
                        ],
                        max_tokens: 200,
                        temperature: 0
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${apiKey}`
                        },
                        timeout: 10000
                    });
                    output.appendLine(`← [DEBUG] Received status ${resp.status} from OpenAI`);
                    output.appendLine(resp.data.choices[0].message.content.trim());
                }
                catch (callErr) {
                    const status = callErr.response?.status;
                    const msg = callErr.response?.data?.error?.message || callErr.message;
                    output.appendLine(`! Error during OpenAI call for ${fn.name}() [${status}]: ${msg}`);
                }
            }
        }
        vscode.window.showInformationMessage('Done generating suggestions.');
    })();
}
exports.suggestTests = suggestTests;
