#!/usr/bin/env python3
"""Check that all CJK characters in blog content are covered by font-chars.txt."""

import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
FONT_CHARS_PATH = os.path.join(SCRIPT_DIR, "font-chars.txt")

# CJK Unified Ideographs (U+4E00..U+9FFF) + Extension A (U+3400..U+4DBF)
CJK_PATTERN = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")

SCAN_DIRS = [
    ("src/content/blog", ("*.md", "*.mdx")),
    ("src/components", ("*.astro",)),
    ("src/pages", ("*.astro",)),
    ("src/layouts", ("*.astro",)),
]


def load_font_chars():
    with open(FONT_CHARS_PATH, "r", encoding="utf-8") as f:
        return set(f.read())


def scan_content():
    """Return dict: char -> list of relative file paths that use it."""
    char_sources: dict[str, list[str]] = {}

    for rel_dir, extensions in SCAN_DIRS:
        abs_dir = os.path.join(REPO_ROOT, rel_dir)
        if not os.path.isdir(abs_dir):
            continue
        for root, _dirs, files in os.walk(abs_dir):
            for fname in files:
                if not any(fname.endswith(ext.lstrip("*")) for ext in extensions):
                    continue
                filepath = os.path.join(root, fname)
                with open(filepath, "r", encoding="utf-8") as f:
                    text = f.read()
                for char in set(CJK_PATTERN.findall(text)):
                    if char not in char_sources:
                        char_sources[char] = []
                    char_sources[char].append(
                        os.path.relpath(filepath, REPO_ROOT)
                    )

    return char_sources


def main():
    font_chars = load_font_chars()
    char_sources = scan_content()

    missing = {c: srcs for c, srcs in char_sources.items() if c not in font_chars}

    if not missing:
        print("Font coverage check passed.")
        return 0

    sorted_missing = sorted(missing.items(), key=lambda x: len(x[1]), reverse=True)

    print(
        f"Font coverage check FAILED: {len(missing)} character(s) missing "
        f"from scripts/font-chars.txt\n"
    )
    for char, sources in sorted_missing:
        files = ", ".join(sorted(sources))
        print(f"  {char} (U+{ord(char):04X}) - used in: {files}")

    print(
        "\nFix: Add missing characters to scripts/font-chars.txt, "
        "then regenerate the font subset."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
