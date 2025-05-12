"use strict";
// src/features/containerControl.ts
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
exports.controlContainers = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
function controlContainers(action) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'yaml') {
        vscode.window.showErrorMessage('Open a Docker Compose YAML file.');
        return;
    }
    const filePath = editor.document.uri.fsPath;
    const cwd = path.dirname(filePath);
    // perform the given action
    const run = (act) => {
        const cmd = act === 'start'
            ? `docker-compose -f "${filePath}" up -d`
            : act === 'stop'
                ? `docker-compose -f "${filePath}" stop`
                : `docker-compose -f "${filePath}" restart`;
        const oc = vscode.window.createOutputChannel('Pymate');
        oc.show();
        oc.appendLine(`Running: ${cmd}`);
        (0, child_process_1.exec)(cmd, { cwd }, (err, stdout, stderr) => {
            if (stdout)
                oc.appendLine(stdout.trim());
            if (stderr)
                oc.appendLine(stderr.trim());
            if (err) {
                oc.appendLine(`❌ ${err.message}`);
                return vscode.window.showErrorMessage(`docker-compose ${act} failed: ${err.message}`);
            }
            vscode.window.showInformationMessage(`Containers ${act}ed`);
        });
    };
    if (action) {
        // one‐click invocation from status bar or command
        run(action);
    }
    else {
        // interactive picker
        vscode.window
            .showQuickPick(['Start', 'Stop', 'Restart'], { placeHolder: 'Select Docker Compose action' })
            .then(choice => {
            if (!choice) {
                return;
            }
            run(choice.toLowerCase());
        });
    }
}
exports.controlContainers = controlContainers;
