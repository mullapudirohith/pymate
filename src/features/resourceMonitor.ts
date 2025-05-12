import * as vscode from 'vscode';
import { exec } from 'child_process';

export function monitorResources() {
    exec('docker stats --no-stream', (e, stdout) => {
        if (e) return vscode.window.showErrorMessage('Docker not running');
        vscode.window.showInformationMessage(stdout);
    });
}
