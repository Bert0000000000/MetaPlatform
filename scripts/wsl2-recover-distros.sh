#!/usr/bin/env bash
# =============================================================================
# wsl2-recover-distros.sh
#
# Manually recover the docker-desktop / docker-desktop-data WSL2 distros
# AFTER Docker Desktop was uninstalled but the .vhdx data files in
# D:\Docker\DockerDesktopWSL\ were preserved.
#
# Three recovery methods are offered, pick the one that matches your situation.
# Run on Windows from PowerShell (admin recommended for wsl --import).
#
# USAGE:
#   bash scripts/wsl2-recover-distros.sh status        # show current WSL2 state
#   bash scripts/wsl2-recover-distros.sh method-a      # GUI: just reinstall DD
#   bash scripts/wsl2-recover-distros.sh method-b      # manual wsl --import
#   bash scripts/wsl2-recover-distros.sh help          # show help
#
# BACKGROUND:
#   Docker Desktop creates 2 WSL2 distros:
#     - docker-desktop        : Linux kernel + dockerd + Docker Desktop tools
#     - docker-desktop-data   : persistent image / volume / container data
#   When you uninstall Docker Desktop, the WSL2 distro *registrations* are
#   wiped (they live in %AppData%\Local\Docker\) but the .vhdx *files* survive
#   on disk. To make Docker Desktop reuse the .vhdx, point it at the path
#   during/after reinstall.
#
#   IMPORTANT: .wslconfig `dataDirectory` does NOT control docker-desktop /
#   docker-desktop-data — it only governs newly-installed Linux distros.
# =============================================================================
set -euo pipefail

VHDX_DISK_DIR="D:\\Docker\\DockerDesktopWSL\\disk"
VHDX_DATA="docker_data.vhdx"
VHDX_MAIN="D:\\Docker\\DockerDesktopWSL\\main\\ext4.vhdx"
DATA_VHDX_PATH="D:\\Docker\\DockerDesktopWSL\\disk\\docker_data.vhdx"
MAIN_VHDX_PATH="D:\\Docker\\DockerDesktopWSL\\main\\ext4.vhdx"
TEMP_DIR="$HOME/wsl2-recover-tmp"
mkdir -p "$TEMP_DIR"

CMD="${1:-help}"

# ---- help ----
help() {
    sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
    echo ""
    echo "Methods:"
    echo "  method-a  Reinstall Docker Desktop + point it at D:\\Docker\\DockerDesktopWSL\\disk\\"
    echo "            (RECOMMENDED for Docker Desktop 4.47+)"
    echo "  method-b  Manual wsl --import of the existing .vhdx (without Docker Desktop)"
    echo "            (use if you only need docker CLI, not the GUI)"
    echo "  status    Show current WSL2 distro list and .vhdx file existence"
    echo "  help      Show this message"
}

# ---- status ----
status() {
    echo "=== WSL2 distros ==="
    wsl -l -v 2>&1 || echo "(wsl not found — install WSL first)"
    echo ""
    echo "=== Existing .vhdx files ==="
    for f in "$DATA_VHDX_PATH" "$MAIN_VHDX_PATH"; do
        if [ -e "$f" ]; then
            sz=$(stat -c '%s' "$f" 2>/dev/null || stat -f '%z' "$f" 2>/dev/null || echo "?")
            echo "  PRESENT: $f ($sz bytes)"
        else
            echo "  MISSING: $f"
        fi
    done
    echo ""
    echo "=== Docker CLI ==="
    command -v docker && docker --version || echo "  (docker CLI not on PATH)"
}

# ---- method-a: GUI (simplest) ----
method_a() {
    cat <<'EOF'
==============================================================================
Method A: Reinstall Docker Desktop + point it at D:\Docker\DockerDesktopWSL\
==============================================================================

PROS:  Simplest. GUI-driven. Works on Docker Desktop 4.47+.
CONS:  Requires Docker Desktop reinstall (~3-5 min download + install).
       Disk image location is set INSIDE the running Docker Desktop
       Settings panel AFTER it first starts (it always writes to
       %AppData%\Local\Docker\wsl\disk\ first, then migrates on Apply).

STEP 1. Download Docker Desktop 4.47+ from
        https://www.docker.com/products/docker-desktop/
        (Windows installer .exe, ~800 MB)

STEP 2. Run installer, choose:
        [x] Use WSL 2 instead of Hyper-V
        [ ] Allow Windows Containers
        [x] Add shortcut to desktop

STEP 3. After install, **DO NOT click Start** yet. Instead:
        a) Quit any auto-start attempt
        b) Move the freshly-created empty .vhdx OUT of the way so
           Docker Desktop will recreate the registration around the
           existing D:\Docker\DockerDesktopWSL\disk\ path. Concretely:
              Remove-Item "$env:USERPROFILE\AppData\Local\Docker" -Recurse -Force
              Remove-Item "$env:USERPROFILE\AppData\Local\DockerDesktop" -Recurse -Force

STEP 4. Launch Docker Desktop. First launch will recreate
        docker-desktop + docker-desktop-data distros using default path
        (%AppData%\Local\Docker\wsl\disk\). Container data is now empty
        (the 1.6 GB of images/volumes is in D:\Docker\DockerDesktopWSL\disk\
        but NOT yet wired in).

STEP 5. Open Settings → Resources → Advanced
        - Disk image location:  Browse to  D:\Docker\DockerDesktopWSL\disk\
        - WSL integration: enabled
        - Memory: 6 GB (leave 1 GB for Windows)
        - CPUs: 16
        - Swap: 2 GB
        - Disk image size: 60 GB

STEP 6. Click "Apply & Restart". Docker Desktop will:
        - Shut down the default distros
        - Copy / link the existing D:\Docker\DockerDesktopWSL\disk\docker_data.vhdx
        - Restart daemon using that vhdx
        - Your old images, volumes, and containers are restored

STEP 7. Verify in PowerShell:
        wsl -l -v
        # Expect docker-desktop + docker-desktop-data both Running
        docker info | Select-String "Server Version|Storage Driver|Docker Root"

DONE. Now you can:
        cd D:\Hermes\Workspace\10_Projects\2026-07-02-MetaPlatform
        bash scripts/local-restart-from-clean.sh
        bash scripts/local-verify.sh --llmgw

EOF
}

# ---- method-b: manual wsl --import (CLI only, no DD) ----
method_b() {
    cat <<'EOF'
==============================================================================
Method B: Manual `wsl --import` of existing .vhdx (no Docker Desktop)
==============================================================================

PROS:  No Docker Desktop reinstall. Pure WSL2 + dockerd-in-distro.
CONS:  Loses the Docker Desktop GUI / Settings / update channel.
       You have to manage dockerd yourself (systemd / wsl.conf).
       Slightly slower cold start.

STEP 1. Open PowerShell AS ADMIN.

STEP 2. Register the existing .vhdx files as WSL2 distros:
        wsl --import docker-desktop-data "$TEMP_DIR\docker-desktop-data" "$DATA_VHDX_PATH" --version 2
        wsl --import docker-desktop "$TEMP_DIR\docker-desktop" "$MAIN_VHDX_PATH" --version 2

STEP 3. Verify:
        wsl -l -v
        # Should show:
        #   NAME                   STATE    VERSION
        #   docker-desktop-data    Stopped  2
        #   docker-desktop         Stopped  2

STEP 4. Start the distros:
        wsl -d docker-desktop-data -- /bin/true     # mount
        wsl -d docker-desktop -- /bin/true

STEP 5. To get a working docker CLI on Windows without Docker Desktop,
        install Docker CLI standalone:
        # download from https://github.com/docker/cli/releases
        # extract docker.exe to a folder on PATH (e.g. C:\Tools\docker\)
        # and set DOCKER_HOST=tcp://localhost:2375
        # (only works if dockerd in WSL2 exposes the port — it doesn't by
        # default in the docker-desktop distro, so this method is incomplete)

STEP 6. (Optional) Mount the distros for inspection:
        wsl -d docker-desktop-data -- df -h /var/lib/docker
        wsl -d docker-desktop-data -- ls /var/lib/docker/volumes

CLEANUP when done with method B:
        wsl --unregister docker-desktop
        wsl --unregister docker-desktop-data

RECOMMENDATION: use METHOD A unless you have a specific reason to avoid
Docker Desktop.
EOF
}

case "$CMD" in
    help)        help ;;
    status)      status ;;
    method-a)    method_a ;;
    method-b)    method_b ;;
    *)
        echo "Unknown command: $CMD" >&2
        help
        exit 1
        ;;
esac