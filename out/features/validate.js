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
exports.validateComposeFile = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
const childProcess = __importStar(require("child_process"));
const path = __importStar(require("path"));
function validateComposeFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'yaml') {
        vscode.window.showErrorMessage('Open a Docker Compose YAML file.');
        return;
    }
    const filePath = editor.document.uri.fsPath;
    try {
        yaml.load(fs.readFileSync(filePath, 'utf8'));
    }
    catch (e) {
        vscode.window.showErrorMessage(`YAML Syntax Error: ${e.message}`);
        return;
    }
    try {
        childProcess.execSync(`docker-compose -f "${filePath}" config`, { cwd: path.dirname(filePath) });
        vscode.window.showInformationMessage('Compose file is valid!');
    }
    catch (e) {
        vscode.window.showErrorMessage(`Docker Compose Error: ${e.message}`);
    }
}
exports.validateComposeFile = validateComposeFile;
