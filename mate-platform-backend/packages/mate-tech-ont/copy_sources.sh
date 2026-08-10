#!/usr/bin/env bash
# GOVERN-11: copy workspace sources into the image's site-packages as a
# fallback. Real runtime uses docker-compose bind-mount + PYTHONPATH,
# so this is only relevant for non-compose runs.
set -euo pipefail
SITE=/usr/local/lib/python3.12/site-packages
declare -A SRC_MAP=(
    [mate-tech-ont]=/tmp/build/packages/mate-tech-ont/src/mate_tech_ont
    [mate-kernel]=/tmp/build/packages/mate-kernel/src/mate_kernel
    [mate-common]=/tmp/build/packages/mate-common/src/mate_common
    [mate-platform]=/tmp/build/packages/mate-platform/src/mate_platform
)
for pkg in "${!SRC_MAP[@]}"; do
    SRC="${SRC_MAP[$pkg]}"
    if [ ! -d "${SRC}" ]; then
        echo "MISSING_SRC: ${SRC}" >&2
        exit 1
    fi
    cp -r "${SRC}" "${SITE}/"
    echo "copied ${pkg} -> ${SITE}/"
done
ls "${SITE}"/ | grep -E '^mate_' || true