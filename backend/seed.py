#!/usr/bin/env python3
"""Convenience entry point for the real TU seed at database/seed/seed.py."""

from pathlib import Path
import runpy


seed_script = Path(__file__).resolve().parent.parent / "database" / "seed" / "seed.py"
runpy.run_path(str(seed_script), run_name="__main__")
