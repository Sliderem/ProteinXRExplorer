import sys
from pathlib import Path

PYTHON_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PYTHON_DIR))

FIXTURES = Path(__file__).resolve().parent / "fixtures"
