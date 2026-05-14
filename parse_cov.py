"""Parse coverage.json and extract core/ module coverage data."""
import json

with open("coverage.json") as f:
    cov = json.load(f)

files = cov.get("files", {})
core_files = {}

for path, data in files.items():
    norm = path.replace("\\", "/")
    if "socialsim4/core/" in norm:
        idx = norm.index("socialsim4/")
        rel = norm[idx + len("socialsim4/"):]
        summary = data.get("summary", {})
        line_cov = summary.get("covered_lines", 0)
        line_total = summary.get("num_statements", 0)
        branch_cov = summary.get("covered_branches", 0)
        branch_total = summary.get("num_branches", 0)
        missing_lines = data.get("missing_lines", [])

        line_pct = round(line_cov / line_total * 100) if line_total > 0 else 100
        branch_pct = round(branch_cov / branch_total * 100) if branch_total > 0 else 100

        core_files[rel] = {
            "line_pct": line_pct,
            "branch_pct": branch_pct,
            "missing": missing_lines,
        }

sorted_files = sorted(core_files.items(), key=lambda x: x[1]["line_pct"])

for rel, info in sorted_files:
    missing_str = ", ".join(str(l) for l in info["missing"]) if info["missing"] else "-"
    print(f"{rel}|{info['line_pct']}%|{info['branch_pct']}%|{missing_str}")
