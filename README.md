# Pymate

A VS Code extension integrating Docker Compose management, automated test coverage analysis, test case suggestions, and static code analysis for Python.

## Setup

1. Install dependencies:

```bash
npm install
pip install -r requirements.txt
```

2. Compile the extension:

```bash
npm run compile
```

3. Launch in VS Code:

- Press F5 to start the Extension Development Host.

## Commands

- **Validate Docker Compose File**
- **Show Docker Compose Dependency Graph**
- **Manage Docker Containers**
- **Monitor Docker Resources**
- **Run Tests and Coverage**
- **Suggest Test Cases**

Configure your OpenAI API key in VS Code settings under `pymate.openaiApiKey` for test suggestions.
