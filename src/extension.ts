// src/extension.ts

import * as vscode from 'vscode';
import { validateComposeFile } from './features/validate';
import { showDependencyGraph } from './features/dependencyGraph';
import { monitorResources } from './features/resourceMonitor';
import { controlContainers } from './features/containerControl';
import { lintDocument } from './features/staticAnalysis';
import { runTestsCoverage, suggestTests } from './features/testCoverage';

export function activate(context: vscode.ExtensionContext) {
    console.log('🛠️ Pymate activating…');
    vscode.window.showInformationMessage('Pymate extension activated!');

    // 1) Register core commands
    context.subscriptions.push(
        vscode.commands.registerCommand('docker-compose.validate', validateComposeFile),
        vscode.commands.registerCommand('docker-compose.graph', showDependencyGraph),
        vscode.commands.registerCommand('docker-compose.monitor', monitorResources),
        vscode.commands.registerCommand('docker-compose.control', controlContainers),
        // wrapper commands for direct actions
        vscode.commands.registerCommand('docker-compose.start', () => controlContainers('start')),
        vscode.commands.registerCommand('docker-compose.stop', () => controlContainers('stop')),
        vscode.commands.registerCommand('docker-compose.restart', () => controlContainers('restart')),

        vscode.commands.registerCommand('pymate.runTestsCoverage', runTestsCoverage),
        vscode.commands.registerCommand('pymate.suggestTests', suggestTests)
    );

    // 2) Create a single diagnostic collection for Python linting
    const diagCollection = vscode.languages.createDiagnosticCollection('pymate');
    context.subscriptions.push(diagCollection);

    // Lint already-open Python files
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'python') {
            lintDocument(doc, diagCollection);
        }
    });

    // Lint on open & on save
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            if (doc.languageId === 'python') {
                lintDocument(doc, diagCollection);
            }
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'python') {
                lintDocument(doc, diagCollection);
            }
        })
    );

    // 3) STATUS BAR BUTTONS

    // Docker Start
    const startItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    startItem.command = 'docker-compose.start';
    startItem.text = '$(play) Start Containers';
    startItem.tooltip = 'Docker Compose: Start services';
    startItem.show();
    context.subscriptions.push(startItem);

    // Docker Stop
    const stopItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    stopItem.command = 'docker-compose.stop';
    stopItem.text = '$(primitive-square) Stop Containers';
    stopItem.tooltip = 'Docker Compose: Stop services';
    stopItem.show();
    context.subscriptions.push(stopItem);

    // Docker Restart
    const restartItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    restartItem.command = 'docker-compose.restart';
    restartItem.text = '$(debug-restart) Restart Containers';
    restartItem.tooltip = 'Docker Compose: Restart services';
    restartItem.show();
    context.subscriptions.push(restartItem);

    // Run Coverage
    const coverageItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    coverageItem.command = 'pymate.runTestsCoverage';
    coverageItem.text = '$(beaker) Run Coverage';
    coverageItem.tooltip = 'Pymate: Run pytest with coverage';
    coverageItem.show();
    context.subscriptions.push(coverageItem);

    // Suggest Tests
    const suggestItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 96);
    suggestItem.command = 'pymate.suggestTests';
    suggestItem.text = '$(lightbulb) Suggest Tests';
    suggestItem.tooltip = 'Pymate: Generate pytest test suggestions';
    suggestItem.show();
    context.subscriptions.push(suggestItem);

    // Dependency Graph
    const graphItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
    graphItem.command = 'docker-compose.graph';
    graphItem.text = '$(symbol-tree) Docker Graph';
    graphItem.tooltip = 'Docker Compose: Show dependency graph';
    graphItem.show();
    context.subscriptions.push(graphItem);
}

export function deactivate() {
    // nothing to clean up
}
