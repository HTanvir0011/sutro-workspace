"""Execute a notebook's code cells in one namespace (quick local check). Usage: run_nb.py <ipynb>"""
import json, sys
sys.stdout.reconfigure(encoding="utf-8")
nb = json.load(open(sys.argv[1], encoding="utf-8")); ns = {"__name__": "__main__"}
for i, c in enumerate(nb["cells"]):
    if c["cell_type"] != "code": continue
    print(f"===== cell {i} =====", flush=True); exec(compile("".join(c["source"]), f"cell{i}", "exec"), ns)
print("NOTEBOOK OK")
