#!/usr/bin/env bash
set -euo pipefail

# Pinned musl cross-toolchain archives (trust-on-first-use, hashes verified
# 2026-11-25 against https://musl.ljw.red/). Release builds must verify the
# archive before extraction; a mismatch aborts the build. To refresh, download
# the archive, review it, then update the hash and the date above deliberately.
readonly AARCH64_MUSL_CROSS_SHA256="c909817856d6ceda86aa510894fa3527eac7989f0ef6e87b5721c58737a06c38"
readonly ARMV7L_MUSL_CROSS_SHA256="f49f1a15ec62364ef5e4edb4e3990c0e1d2d1a54c90153b8f3869dad63328a10"

target_goos="${TARGET_GOOS:?TARGET_GOOS is required}"
target_platform="${TARGET_PLATFORM:?TARGET_PLATFORM is required}"
archive_extension="${ARCHIVE_EXTENSION:?ARCHIVE_EXTENSION is required}"

case "${target_goos}:${target_platform}:${archive_extension}" in
  linux:amd64:tar.gz|linux:arm64:tar.gz|linux:armv7l:tar.gz|windows:amd64:zip)
    ;;
  *)
    printf 'Unsupported build target: %s-%s (%s)\n' \
      "$target_goos" "$target_platform" "$archive_extension" >&2
    exit 2
    ;;
esac

archive="${target_goos}-${target_platform}.${archive_extension}"

mkdir -p release
cp -ar resources docs conf release/
mkdir -p release/data release/runtime

if [[ "$target_goos" == windows ]]; then
  sudo apt-get install gcc-mingw-w64-x86-64 zip -y
  GOOS="$target_goos" GOARCH="$target_platform" \
    CC=x86_64-w64-mingw32-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain.exe ./cmd
  echo @echo off > release/start.bat
  echo cmd /c \"%~dp0apimain.exe\" >> release/start.bat
  zip -r "$archive" ./release
elif [[ "$target_platform" == arm64 ]]; then
  wget https://musl.ljw.red/aarch64-linux-musl-cross.tgz
  printf '%s  %s\n' "$AARCH64_MUSL_CROSS_SHA256" aarch64-linux-musl-cross.tgz | sha256sum --strict --check -
  tar -xf aarch64-linux-musl-cross.tgz
  export PATH="$PATH:$PWD/aarch64-linux-musl-cross/bin"
  GOOS="$target_goos" GOARCH="$target_platform" \
    CC=aarch64-linux-musl-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd
  tar -czf "$archive" ./release
elif [[ "$target_platform" == armv7l ]]; then
  wget https://musl.ljw.red/armv7l-linux-musleabihf-cross.tgz
  printf '%s  %s\n' "$ARMV7L_MUSL_CROSS_SHA256" armv7l-linux-musleabihf-cross.tgz | sha256sum --strict --check -
  tar -xf armv7l-linux-musleabihf-cross.tgz
  export PATH="$PATH:$PWD/armv7l-linux-musleabihf-cross/bin"
  GOOS="$target_goos" GOARCH=arm GOARM=7 \
    CC=armv7l-linux-musleabihf-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd
  tar -czf "$archive" ./release
else
  sudo apt-get install musl musl-dev musl-tools -y
  GOOS="$target_goos" GOARCH="$target_platform" \
    CC=musl-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd
  tar -czf "$archive" ./release
fi
