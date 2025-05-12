import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as childProcess from 'child_process';
import * as path from 'path';

export function validateComposeFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'yaml') {
        vscode.window.showErrorMessage('Open a Docker Compose YAML file.');
        return;
    }
    const filePath = editor.document.uri.fsPath;
    try {
        yaml.load(fs.readFileSync(filePath, 'utf8'));
    } catch (e: any) {
        vscode.window.showErrorMessage(`YAML Syntax Error: ${e.message}`);
        return;
    }
    try {
        childProcess.execSync(`docker-compose -f "${filePath}" config`, { cwd: path.dirname(filePath) });
        vscode.window.showInformationMessage('Compose file is valid!');
    } catch (e: any) {
        vscode.window.showErrorMessage(`Docker Compose Error: ${e.message}`);
    }
}
