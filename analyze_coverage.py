import sys, json, ast, os

def analyze_coverage(cov_path):
    try:
        with open(cov_path, 'r') as f:
            cov_data = json.load(f)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load coverage JSON: {e}"}))
        return
    files_data = cov_data.get("files")
    if files_data is None:
        print(json.dumps({"error": "No coverage data found"}))
        return
    untested = []
    for file_path, data in files_data.items():
        base = os.path.basename(file_path)
        if base.startswith("test_") or "/test" in file_path:
            continue
        executed = set(data.get("executed_lines", []))
        if not executed and "missing_lines" in data:
            all_lines = set(range(1, data.get("summary", {}).get("num_statements", 0) + 1))
            missing = set(data.get("missing_lines", []))
            executed = all_lines - missing
        try:
            source = open(file_path, 'r').read()
            tree = ast.parse(source)
        except Exception:
            continue
        untested_funcs = []
        def traverse(node, parent_is_func=False):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not parent_is_func:
                    start = node.lineno
                    end = getattr(node, 'end_lineno', node.lineno)
                    body_lines = set(range(start+1, end+1)) if end > start else {start}
                    if body_lines and executed.isdisjoint(body_lines):
                        src_lines = source.splitlines()
                        sig_lines = []
                        i = start - 1
                        paren_count = 0
                        while i < len(src_lines):
                            line = src_lines[i].strip()
                            sig_lines.append(line)
                            paren_count += line.count('(') - line.count(')')
                            if line.rstrip().endswith(':') and paren_count <= 0:
                                break
                            i += 1
                        signature = " ".join(sig_lines)
                        untested_funcs.append({"name": node.name, "signature": signature})
            if isinstance(node, ast.FunctionDef):
                return
            for child in ast.iter_child_nodes(node):
                traverse(child, parent_is_func=isinstance(node, ast.FunctionDef))
        for child in ast.iter_child_nodes(tree):
            traverse(child)
        if untested_funcs:
            untested.append({"file": file_path, "functions": untested_funcs})
    print(json.dumps({"untested": untested}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No coverage file path provided"}))
    else:
        analyze_coverage(sys.argv[1])
