#!/usr/bin/env python3
"""Block agent edits that reduce active expect() / .should() calls in guarded test files."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SPEC_NAME = re.compile(r".+\.spec\.(ts|tsx|js|jsx)$")
TEST_NAME = re.compile(r"test\.(ts|tsx|js|jsx)$")
CY_NAME = re.compile(r".+\.cy\.(ts|tsx)$")


def count_active_assertions(text: str) -> int:
    total = 0
    for line in text.splitlines():
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        if "//" in line:
            line = line.split("//", 1)[0]
        total += line.count("expect(")
        total += line.count(".should(")
    return total


count_active_expects = count_active_assertions


def is_guarded_test_file(file_path: str) -> bool:
    normalized = file_path.replace("\\", "/")
    if "/web/cypress/" in normalized or normalized.startswith("web/cypress/"):
        name = normalized.rsplit("/", 1)[-1]
        return bool(CY_NAME.match(name))
    if "/tests/" in normalized:
        rel = normalized.split("/tests/", 1)[1]
    elif normalized.startswith("tests/"):
        rel = normalized[len("tests/") :]
    else:
        return False
    name = rel.rsplit("/", 1)[-1]
    return bool(SPEC_NAME.match(name) or TEST_NAME.match(name))


def read_after_content(file_path: str, edits: list[dict]) -> str | None:
    path = Path(file_path)
    if path.is_file():
        return path.read_text(encoding="utf-8", errors="replace")
    if not edits:
        return None
    return edits[-1].get("new_string", "")


def reconstruct_before(after: str, edits: list[dict]) -> str | None:
    content = after
    for edit in reversed(edits):
        old = edit.get("old_string")
        new = edit.get("new_string")
        if old is None or new is None:
            return None
        if new not in content:
            return None
        content = content.replace(new, old, 1)
    return content


def estimate_before_count(after_count: int, edits: list[dict]) -> int:
    delta = 0
    for edit in edits:
        old = edit.get("old_string") or ""
        new = edit.get("new_string") or ""
        delta += count_active_assertions(old) - count_active_assertions(new)
    return after_count + delta


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("guard-test-assertions: empty stdin", file=sys.stderr)
        return 1

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"guard-test-assertions: invalid JSON — {exc}", file=sys.stderr)
        return 1

    file_path = payload.get("file_path")
    if not file_path or not isinstance(file_path, str):
        print("guard-test-assertions: missing file_path", file=sys.stderr)
        return 1

    edits = payload.get("edits")
    if edits is None:
        edits = []
    if not isinstance(edits, list):
        print("guard-test-assertions: edits must be an array", file=sys.stderr)
        return 1

    if not is_guarded_test_file(file_path):
        return 0

    after_content = read_after_content(file_path, edits)
    if after_content is None:
        print(
            f"guard-test-assertions: cannot read after content for {file_path}",
            file=sys.stderr,
        )
        return 1

    after_count = count_active_assertions(after_content)
    before_content = reconstruct_before(after_content, edits)
    if before_content is not None:
        before_count = count_active_assertions(before_content)
    else:
        before_count = estimate_before_count(after_count, edits)

    if before_count > after_count:
        message = (
            f"Blocked: test assertions weakened in {file_path} — active expect( / .should( "
            f"count {before_count} -> {after_count}. Do not delete or comment out "
            "assertions to make tests pass. Fix the app, locator, or test data instead."
        )
        out = {"user_message": message, "agent_message": message}
        sys.stdout.write(json.dumps(out))
        sys.stdout.write("\n")
        print(message, file=sys.stderr)
        return 2

    print(
        f"guard-test-assertions: OK — {after_count} active expect( / .should( preserved",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
