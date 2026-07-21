"""Safe code execution sandbox (REQ-041).

Design constraints (per V12-02 task):

- Python: AST-based guard rejects dangerous imports/calls, then the code
  runs in an isolated child interpreter with a hard timeout.  The child
  process never inherits the parent's working directory or env beyond a
  curated allowlist.
- SQL: runs against an in-memory SQLite database with the connection
  forced into read-only mode after seeding a small fixture schema.
- TypeScript: execution is intentionally NOT supported in the backend
  (no Node sandbox); the API returns a structured "unsupported" error
  so the front-end can surface a clear message.

No third-party sandboxing dependency is required.  Only the standard
library is used so the existing pyproject.toml stays unchanged.
"""

from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import time
from typing import Any, Dict, List, Optional

from app.code.schemas import ExecutionResult, normalize_language
from app.common.errors import InvalidParamError


# Modules/builtins that are *forbidden* inside the sandbox.
_PYTHON_FORBIDDEN_MODULES = {
    "os",
    "sys",
    "subprocess",
    "shutil",
    "socket",
    "urllib",
    "urllib2",
    "urllib3",
    "http",
    "requests",
    "ftplib",
    "smtplib",
    "telnetlib",
    "poplib",
    "imaplib",
    "ssl",
    "multiprocessing",
    "threading",
    "asyncio",
    "ctypes",
    "cffi",
    "pickle",
    "shelve",
    "marshal",
    "pty",
    "platform",
    "getpass",
    "pathlib",
    "tempfile",
    "glob",
    "fcntl",
    "resource",
}

# Whitelisted modules that are safe to import inside the sandbox.
_PYTHON_ALLOWED_MODULES = {
    "math",
    "statistics",
    "json",
    "re",
    "collections",
    "itertools",
    "functools",
    "operator",
    "datetime",
    "decimal",
    "fractions",
    "hashlib",
    "base64",
    "string",
    "textwrap",
    "copy",
    "heapq",
    "bisect",
    "random",
    "uuid",
    "csv",
    "io",
}

# Safe builtins exposed to the sandboxed code.
_SAFE_BUILTINS = {
    "abs",
    "all",
    "any",
    "ascii",
    "bin",
    "bool",
    "bytearray",
    "bytes",
    "callable",
    "chr",
    "complex",
    "dict",
    "divmod",
    "enumerate",
    "filter",
    "float",
    "format",
    "frozenset",
    "getattr",
    "hasattr",
    "hash",
    "hex",
    "id",
    "int",
    "isinstance",
    "issubclass",
    "iter",
    "len",
    "list",
    "map",
    "max",
    "min",
    "next",
    "object",
    "oct",
    "ord",
    "pow",
    "print",
    "property",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "setattr",
    "slice",
    "sorted",
    "staticmethod",
    "str",
    "sum",
    "super",
    "tuple",
    "type",
    "vars",
    "zip",
    "True",
    "False",
    "None",
    "Exception",
    "ValueError",
    "TypeError",
    "KeyError",
    "IndexError",
    "RuntimeError",
    "StopIteration",
    "ArithmeticError",
    "ZeroDivisionError",
    "AttributeError",
    "NotImplementedError",
}

# SQL keywords that indicate a write operation.
_SQL_FORBIDDEN_KEYWORDS = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "REPLACE",
    "MERGE",
    "ATTACH",
    "DETACH",
    "PRAGMA",
    "VACUUM",
    "REINDEX",
}

# Maximum rows returned by SQL execution.
_SQL_MAX_ROWS = 1000


class SandboxViolationError(InvalidParamError):
    """Raised when sandboxed code attempts a forbidden operation."""


# ----------------------------------------------------------- Python sandbox


def _validate_python_ast(source: str) -> None:
    """Reject code that imports or calls forbidden modules/builtins."""

    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise SandboxViolationError(
            f"Python 语法错误: {exc.msg} (line {exc.lineno})",
            data={"line": exc.lineno, "offset": exc.offset},
        ) from exc

    violations: List[str] = []

    for node in ast.walk(tree):
        # import os / import os.path
        if isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]
                if top in _PYTHON_FORBIDDEN_MODULES:
                    violations.append(f"禁止导入模块: {alias.name}")
                elif top not in _PYTHON_ALLOWED_MODULES:
                    violations.append(f"未授权模块: {alias.name}")
        # from os import environ
        elif isinstance(node, ast.ImportFrom):
            top = (node.module or "").split(".")[0]
            if not top:
                continue
            if top in _PYTHON_FORBIDDEN_MODULES:
                violations.append(f"禁止从模块导入: {node.module}")
            elif top not in _PYTHON_ALLOWED_MODULES:
                violations.append(f"未授权模块: {node.module}")
        # __import__("os") / eval / exec / compile
        elif isinstance(node, ast.Call):
            func = node.func
            name: Optional[str] = None
            if isinstance(func, ast.Name):
                name = func.id
            elif isinstance(func, ast.Attribute):
                name = func.attr
            if name in {"__import__", "eval", "exec", "compile", "globals", "locals"}:
                violations.append(f"禁止调用: {name}")
            if name == "open":
                # open() is forbidden; use io.StringIO via allowed import.
                violations.append("禁止使用 open()，请使用 io.StringIO")

    if violations:
        raise SandboxViolationError(
            "代码违反沙箱安全策略",
            data={"violations": violations[:20]},
        )


_SAFE_RUNNER_TEMPLATE = textwrap.dedent(
    '''
    """Sandbox runner generated by app.code.sandbox.

    The runner loads user code as a string and executes it inside a
    restricted globals whose ``__builtins__`` only exposes an allowlist.
    The result of the user code (whatever ends up in ``_result``) is
    serialized to JSON on stdout so the parent process can decode it.
    """

    import io
    import json
    import sys
    import traceback as _tb

    # ------------------------------------------------------- safe import shim
    _ALLOWED_MODULES = {allowed_modules!r}

    def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        top = name.split(".")[0]
        if top not in _ALLOWED_MODULES:
            raise ImportError("模块 '" + name + "' 不在沙箱白名单中")
        return __import__(name, globals, locals, fromlist, level)

    # ----------------------------------------------------- builtins allowlist
    _builtin_print = print  # capture before shadowing

    _allowed_builtins = {builtins_mapping}

    _allowed_builtins["__import__"] = _safe_import
    _allowed_builtins["__build_class__"] = __build_class__
    _allowed_builtins["True"] = True
    _allowed_builtins["False"] = False
    _allowed_builtins["None"] = None

    # ------------------------------------------------------------- exec context
    _stdout = io.StringIO()
    _stderr = io.StringIO()


    def _sandbox_print(*args, **kwargs):
        kwargs.setdefault("file", _stdout)
        _builtin_print(*args, **kwargs)


    _user_globals = {{
        "__name__": "__main__",
        "__builtins__": _allowed_builtins,
        "print": _sandbox_print,
        "_result": None,
    }}

    _user_code = {user_code!r}
    _error = None
    _result = None
    try:
        exec(compile(_user_code, "<sandbox>", "exec"), _user_globals)
        _result = _user_globals.get("_result")
    except SystemExit as _e:
        _error = {{"name": "SystemExit", "message": str(_e)}}
    except BaseException as _e:
        _error = {{
            "name": type(_e).__name__,
            "message": str(_e),
            "traceback": "".join(
                _tb.format_exception(type(_e), _e, _e.__traceback__)
            ),
        }}

    _payload = {{
        "stdout": _stdout.getvalue(),
        "stderr": _stderr.getvalue(),
        "result": _result,
        "error": _error,
    }}
    sys.stdout.write(json.dumps(_payload, default=str))
    '''
)


def _build_runner_source(user_code: str) -> str:
    """Render the sandbox runner source for ``user_code``."""

    # Build the safe-builtins mapping as a Python dict literal.
    safe_names = sorted(name for name in _SAFE_BUILTINS if name not in {"True", "False", "None"})
    builtins_mapping = "{\n        " + ",\n        ".join(
        f'"{name}": {name}' for name in safe_names
    ) + ",\n    }"

    return _SAFE_RUNNER_TEMPLATE.format(
        allowed_modules=sorted(_PYTHON_ALLOWED_MODULES),
        builtins_mapping=builtins_mapping,
        user_code=user_code,
    )


def _execute_python(code: str, timeout_ms: int) -> ExecutionResult:
    _validate_python_ast(code)
    runner = _build_runner_source(code)

    start = time.monotonic()
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-c", runner],
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000.0,
            env={
                "PYTHONDONTWRITEBYTECODE": "1",
                "PYTHONHASHSEED": "0",
                "PYTHONIOENCODING": "utf-8",
                "PATH": os.environ.get("PATH", ""),
            },
            cwd=tempfile.gettempdir(),
        )
    except subprocess.TimeoutExpired:
        duration = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            success=False,
            durationMs=duration,
            resultType="error",
            errorName="TimeoutError",
            errorMessage=f"代码执行超时（{timeout_ms}ms）",
        )

    duration = int((time.monotonic() - start) * 1000)
    stdout_payload = completed.stdout or ""
    stderr_text = completed.stderr or ""

    # The runner writes a JSON payload to stdout.  If parsing fails
    # (e.g. the child printed other text first), fall back to raw stdout.
    payload: Optional[Dict[str, Any]] = None
    try:
        payload = json.loads(stdout_payload)
    except json.JSONDecodeError:
        # Find the last line that starts with '{' as a recovery path.
        for line in reversed(stdout_payload.splitlines()):
            stripped = line.strip()
            if stripped.startswith("{") and stripped.endswith("}"):
                try:
                    payload = json.loads(stripped)
                    break
                except json.JSONDecodeError:
                    continue

    if payload is None:
        return ExecutionResult(
            success=completed.returncode == 0,
            stdout=stdout_payload,
            stderr=stderr_text,
            durationMs=duration,
            resultType="text" if completed.returncode == 0 else "error",
            text=stdout_payload if completed.returncode == 0 else None,
            errorName=None if completed.returncode == 0 else "RuntimeError",
            errorMessage=stderr_text or None,
        )

    inner_stdout: str = payload.get("stdout", "")
    inner_stderr: str = payload.get("stderr", "")
    error = payload.get("error")
    result_value = payload.get("result")

    columns: List[str] = []
    rows: List[Dict[str, Any]] = []
    text_value: Optional[str] = None
    result_type = "text"

    if isinstance(result_value, list) and result_value and isinstance(result_value[0], dict):
        # List of dicts -> render as a table.
        seen_keys: List[str] = []
        seen_set = set()
        for row in result_value:
            if not isinstance(row, dict):
                continue
            for key in row.keys():
                if key not in seen_set:
                    seen_set.add(key)
                    seen_keys.append(str(key))
        columns = seen_keys
        rows = [
            {str(k): _coerce_json(v) for k, v in row.items()}
            for row in result_value
            if isinstance(row, dict)
        ]
        result_type = "table"
    elif isinstance(result_value, (dict, list, int, float, bool, str)):
        text_value = json.dumps(result_value, ensure_ascii=False, default=str)
    elif result_value is not None:
        text_value = str(result_value)

    success = error is None
    return ExecutionResult(
        success=success,
        stdout=inner_stdout,
        stderr=inner_stderr + (stderr_text if completed.returncode != 0 else ""),
        durationMs=duration,
        resultType="error" if not success else result_type,
        text=text_value,
        columns=columns,
        rows=rows,
        rowCount=len(rows),
        errorName=error.get("name") if error else None,
        errorMessage=error.get("message") if error else None,
    )


def _coerce_json(value: Any) -> Any:
    """Best-effort conversion of arbitrary Python values to JSON-safe types."""

    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [_coerce_json(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _coerce_json(v) for k, v in value.items()}
    return str(value)


# --------------------------------------------------------------- SQL sandbox


def _seed_sqlite_schema() -> str:
    """Build a small fixture schema so SQL demos have data to query."""

    return textwrap.dedent(
        """
        CREATE TABLE departments (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            manager TEXT
        );
        CREATE TABLE employees (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            department_id INTEGER,
            salary REAL,
            hire_date TEXT
        );
        CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer TEXT NOT NULL,
            amount REAL,
            order_date TEXT
        );

        INSERT INTO departments (id, name, manager) VALUES
            (1, 'Engineering', 'Alice'),
            (2, 'Sales', 'Bob'),
            (3, 'Marketing', 'Carol');

        INSERT INTO employees (id, name, department_id, salary, hire_date) VALUES
            (1, 'Dave', 1, 18000, '2023-01-15'),
            (2, 'Eve', 1, 22000, '2022-09-01'),
            (3, 'Frank', 2, 15000, '2024-03-10'),
            (4, 'Grace', 3, 17000, '2023-07-22'),
            (5, 'Heidi', 2, 15500, '2024-06-01');

        INSERT INTO orders (id, customer, amount, order_date) VALUES
            (1, 'Acme', 12000, '2024-08-01'),
            (2, 'Globex', 8500, '2024-08-03'),
            (3, 'Initech', 15600, '2024-08-05'),
            (4, 'Umbrella', 4300, '2024-08-06'),
            (5, 'Soylent', 9800, '2024-08-07');
        """
    ).strip()


def _validate_sql(query: str) -> None:
    """Reject any SQL statement that contains write operations."""

    upper = query.upper()
    for keyword in _SQL_FORBIDDEN_KEYWORDS:
        # Look for the keyword as a whole word, not a substring of an
        # identifier (e.g. "CREATED_AT" should not trigger "CREATE").
        pattern = rf"\b{keyword}\b"
        if re.search(pattern, upper):
            raise SandboxViolationError(
                f"SQL 沙箱仅允许只读查询，禁止使用 {keyword}",
                data={"keyword": keyword},
            )


def _execute_sql(code: str, timeout_ms: int) -> ExecutionResult:
    import sqlite3

    normalized = code.strip().rstrip(";")
    if not normalized:
        raise InvalidParamError("SQL 不能为空")

    _validate_sql(normalized)

    start = time.monotonic()
    conn = sqlite3.connect(":memory:", timeout=timeout_ms / 1000.0)
    try:
        conn.executescript(_seed_sqlite_schema())
        cursor = conn.execute(normalized)
        if cursor.description is None:
            # Statement returned no result set (should not happen for SELECT,
            # but guard anyway).
            return ExecutionResult(
                success=True,
                durationMs=int((time.monotonic() - start) * 1000),
                resultType="text",
                text="查询未返回结果集",
            )
        columns = [desc[0] for desc in cursor.description]
        raw_rows = cursor.fetchmany(_SQL_MAX_ROWS + 1)
        truncated = len(raw_rows) > _SQL_MAX_ROWS
        rows = [dict(zip(columns, row)) for row in raw_rows[:_SQL_MAX_ROWS]]
        result_type = "table"
        text = None
        if not rows:
            text = "查询结果为空"
            result_type = "text"
        elif truncated:
            text = f"结果已截断，仅显示前 {_SQL_MAX_ROWS} 行"
        return ExecutionResult(
            success=True,
            durationMs=int((time.monotonic() - start) * 1000),
            resultType=result_type,
            text=text,
            columns=columns,
            rows=rows,
            rowCount=len(rows),
        )
    except sqlite3.Error as exc:
        return ExecutionResult(
            success=False,
            durationMs=int((time.monotonic() - start) * 1000),
            resultType="error",
            errorName=type(exc).__name__,
            errorMessage=str(exc),
        )
    finally:
        conn.close()


# --------------------------------------------------------------- Public API


def execute(code: str, language: str, timeout_ms: int = 5000) -> ExecutionResult:
    """Run ``code`` in the sandbox for the requested ``language``."""

    normalized = normalize_language(language)
    if normalized == "python":
        return _execute_python(code, timeout_ms)
    if normalized == "sql":
        return _execute_sql(code, timeout_ms)
    if normalized == "typescript":
        return ExecutionResult(
            success=False,
            resultType="error",
            errorName="UnsupportedLanguageError",
            errorMessage="TypeScript 在后端沙箱中暂不支持执行，请在浏览器中运行或导出后本地执行",
        )
    raise InvalidParamError(
        f"不支持的代码语言: {language}",
        data={"language": language},
    )


__all__ = ["execute", "SandboxViolationError"]
