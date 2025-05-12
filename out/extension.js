"use strict";
// src/extension.ts
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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const validate_1 = require("./features/validate");
const dependencyGraph_1 = require("./features/dependencyGraph");
const resourceMonitor_1 = require("./features/resourceMonitor");
const containerControl_1 = require("./features/containerControl");
const staticAnalysis_1 = require("./features/staticAnalysis");
const testCoverage_1 = require("./features/testCoverage");
function activate(context) {
    console.log('🛠️ Pymate activating…');
    vscode.window.showInformationMessage('Pymate extension activated!');
    // 1) Register core commands
    context.subscriptions.push(vscode.commands.registerCommand('docker-compose.validate', validate_1.validateComposeFile), vscode.commands.registerCommand('docker-compose.graph', dependencyGraph_1.showDependencyGraph), vscode.commands.registerCommand('docker-compose.monitor', resourceMonitor_1.monitorResources), vscode.commands.registerCommand('docker-compose.control', containerControl_1.controlContainers), 
    // wrapper commands for direct actions
    vscode.commands.registerCommand('docker-compose.start', () => (0, containerControl_1.controlContainers)('start')), vscode.commands.registerCommand('docker-compose.stop', () => (0, containerControl_1.controlContainers)('stop')), vscode.commands.registerCommand('docker-compose.restart', () => (0, containerControl_1.controlContainers)('restart')), vscode.commands.registerCommand('pymate.runTestsCoverage', testCoverage_1.runTestsCoverage), vscode.commands.registerCommand('pymate.suggestTests', testCoverage_1.suggestTests));
    // 2) Create a single diagnostic collection for Python linting
    const diagCollection = vscode.languages.createDiagnosticCollection('pymate');
    context.subscriptions.push(diagCollection);
    // Lint already-open Python files
    vscode.workspace.textDocuments.forEach(doc => {
        if (doc.languageId === 'python') {
            (0, staticAnalysis_1.lintDocument)(doc, diagCollection);
        }
    });
    // Lint on open & on save
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId === 'python') {
            (0, staticAnalysis_1.lintDocument)(doc, diagCollection);
        }
    }), vscode.workspace.onDidSaveTextDocument(doc => {
        if (doc.languageId === 'python') {
            (0, staticAnalysis_1.lintDocument)(doc, diagCollection);
        }
    }));
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
exports.activate = activate;
function deactivate() {
    // nothing to clean up
}
exports.deactivate = deactivate;
