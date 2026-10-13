# Issue #142: Unicode Excel upload filenames

Scope: `ontCreateModelingSource` accepts browser UTF-8 filenames and the MIME
encoded-word filename emitted by PowerShell/.NET multipart uploads. Preserve the
decoded business filename in the persisted source. Authentication, tenant scope,
admin mutation requirements, 12 MiB input limit and real workbook validation
remain enforced. No model publication, synchronization or schema migration.

## Investigation

- Start from remote main `39907a729f90b6816d9d327427193ac3a25547f3` in the
  managed `issue-142-excel-filename` worktree. Existing WIP and other issue owners
  remain untouched.
- PowerShell `MultipartFormDataContent.Add` emits an RFC 2047 UTF-8 base64
  `filename` and an extended `filename*`. Locked python-multipart 0.0.32 ignores
  extended multipart parameters. Starlette exposes the encoded-word as
  `UploadFile.filename`; the current `.endswith('.xlsx')` check rejects it.
- Plain `filename` remains authoritative. An extended filename must not override
  a conflicting plain name. Unsupported/malformed encodings must return a useful
  422 without persisting a source; invalid workbook content must still fail.

## Ordered implementation and evidence

1. Describe the filename behavior in the canonical upload contract and regenerate
   the bundled contract without changing the operation, responses or body shape.
2. Add actual multipart HTTP regressions before implementation: browser UTF-8,
   English/spaces, .NET base64 and quoted-printable, invalid encoding/extension,
   invalid content, admin denial and anonymous denial. Verify the encoded-word
   cases fail against the current endpoint.
3. Decode only complete MIME encoded-word filenames once before extension
   validation and source creation. Do not fall back to a different filename or
   extension on errors.
4. Add real PostgreSQL persistence/readback regression and real-login browser
   upload using the same workbook under Chinese, English and spaced names.
   Require every collected browser case to execute with zero skips.
5. Add a deployment probe for the original .NET wire format, persisted name,
   sheet/row counts and Chinese values. Use only synthetic issue142 sources.
6. Run locked local target tests and contract lint, independent source review,
   then PR required CI on the final head. Merge later main changes without
   overwriting concurrent work, and rerun affected checks.
7. Merge only after current checks pass; verify remote main, exact-revision main
   CI, serialized Tencent deployment artifact and actual public acceptance.
   Keep #142 open until release acceptance is complete.

## Initial local baseline

Python 3.12.13; `uv sync --frozen --package mate-tech-ont
--no-install-workspace` plus frozen workspace dev export/install. Excel modeling
core baseline: 132 passed, 0 skipped. Local, PR/main CI, deployed acceptance and
the existing enterprise batch are separate evidence boundaries.
