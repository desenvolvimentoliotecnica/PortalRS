#!/usr/bin/env python3
"""Fix mojibake (UTF-8 misread as Latin-1) in Portal Vagas App.tsx."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def fix_line(line: str) -> str:
    try:
        return line.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        result: list[str] = []
        i = 0
        while i < len(line):
            j = i
            while j < len(line) and ord(line[j]) < 256:
                j += 1
            if j > i:
                chunk = line[i:j]
                try:
                    result.append(chunk.encode("latin-1").decode("utf-8"))
                except (UnicodeDecodeError, UnicodeEncodeError):
                    result.append(chunk)
                i = j
            else:
                result.append(line[i])
                i += 1
        return "".join(result)


def fix_content(content: str) -> str:
    fixed = content
    for _ in range(5):
        lines = fixed.splitlines(keepends=True)
        new = "".join(fix_line(line) for line in lines)
        if new == fixed:
            break
        fixed = new

    replacements = {
        "\u00e2\u20ac\u009d": "\u201d",
        "\u00e2\u20ac\u009c": "\u201c",
        "\u00e2\u20ac\u201d": "\u201d",
        "\u00e2\u20ac\u0153": "\u201c",
        "\u00e2\u20ac\u201c": "\u201c",
        "\u00e2\u20ac\u201d": "\u201d",
        "\u00e2\u20ac\u2014": "\u2014",
        "\u00e2\u20ac\u2013": "\u2013",
        "\u00e2\u20ac\u00a2": "\u2022",
        "\u00c2\u00a9": "\u00a9",
    }
    for old, new in replacements.items():
        fixed = fixed.replace(old, new)

    return fixed


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "LioTecnica.PortalVagas.React/src/App.tsx")
    content = path.read_text(encoding="utf-8-sig")
    fixed = fix_content(content)

    # Residual one-off fixes for lines that mix UTF-8 punctuation with mojibake.
    fixed = fixed.replace(
        "Nenhuma certifica\u00c3\u00a7\u00c3\u00a3o cadastrada. \u00c3\u201cotimo",
        "Nenhuma certificação cadastrada. Ótimo",
    )

    path.write_text(fixed, encoding="utf-8", newline="\n")

    remaining = [
        i + 1
        for i, line in enumerate(fixed.splitlines())
        if "Ã" in line or "â€" in line or "Â©" in line
    ]
    print(f"Fixed {path}")
    print(f"Remaining mojibake lines: {len(remaining)}")
    for ln in remaining[:20]:
        print(f"  {ln}: {fixed.splitlines()[ln - 1][:120]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
