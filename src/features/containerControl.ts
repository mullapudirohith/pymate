// src/features/containerControl.ts

import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

type Action = 'start' | 'stop' | 'restart';

export function controlContainers(action?: Action) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'yaml') {
        vscode.window.showErrorMessage('Open a Docker Compose YAML file.');
        return;
    }

    const filePath = editor.document.uri.fsPath;
    const cwd = path.dirname(filePath);

    // perform the given action
    const run = (act: Action) => {
        const cmd =
            act === 'start'
                ? `docker-compose -f "${filePath}" up -d`
                : act === 'stop'
                ? `docker-compose -f "${filePath}" stop`
                : `docker-compose -f "${filePath}" restart`;

        const oc = vscode.window.createOutputChannel('Pymate');
        oc.show();
        oc.appendLine(`Running: ${cmd}`);
        exec(cmd, { cwd }, (err, stdout, stderr) => {
            if (stdout) oc.appendLine(stdout.trim());
            if (stderr) oc.appendLine(stderr.trim());
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
    } else {
        // interactive picker
        vscode.window
            .showQuickPick(['Start', 'Stop', 'Restart'], { placeHolder: 'Select Docker Compose action' })
            .then(choice => {
                if (!choice) {
                    return;
                }
                run(choice.toLowerCase() as Action);
            });
    }
}
