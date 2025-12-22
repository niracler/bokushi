#!/usr/bin/env python3
"""
Fix MD060/table-column-style markdownlint errors.

This script normalizes table formatting to "compact" style where each cell
has exactly one space padding on each side of the content.

Usage:
    python scripts/fix-md060.py "src/content/**/*.md"
"""
import sys
from pathlib import Path


def fix_table_row(line: str) -> str:
    """Convert table row to compact style (one space padding on each side)."""
    stripped = line.strip()
    if not stripped.startswith("|"):
        return line

    # Preserve leading whitespace
    leading_ws = line[: len(line) - len(line.lstrip())]

    # Split by pipe, process each cell
    cells = stripped.split("|")
    fixed = []

    for i, cell in enumerate(cells):
        if i == 0 or i == len(cells) - 1:
            # First and last are empty (before first | and after last |)
            fixed.append("")
        else:
            content = cell.strip()
            if content:
                fixed.append(f" {content} ")
            else:
                fixed.append(" ")

    return leading_ws + "|".join(fixed)


def process_file(path: Path) -> bool:
    """Process a single markdown file. Returns True if changes were made."""
    content = path.read_text(encoding="utf-8")
    lines = content.split("\n")
    in_code_block = False
    result = []
    changed = False

    for line in lines:
        # Track code blocks to avoid modifying tables inside them
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and "|" in line:
            new_line = fix_table_row(line)
            if new_line != line:
                changed = True
            result.append(new_line)
        else:
            result.append(line)

    if changed:
        path.write_text("\n".join(result), encoding="utf-8")

    return changed


def main():
    if len(sys.argv) < 2:
        print("Usage: python fix-md060.py <glob-pattern> [...]")
        print('Example: python fix-md060.py "src/content/**/*.md"')
        sys.exit(1)

    fixed_count = 0
    for pattern in sys.argv[1:]:
        for path in Path(".").glob(pattern):
            if path.is_file():
                if process_file(path):
                    print(f"Fixed: {path}")
                    fixed_count += 1

    print(f"\nTotal files fixed: {fixed_count}")


if __name__ == "__main__":
    main()
