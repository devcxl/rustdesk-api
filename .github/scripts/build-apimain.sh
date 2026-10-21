#!/usr/bin/env bash
set -euo pipefail

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
    go build -ldflags "-s -w" -o ./release/apimain.exe ./cmd/apimain.go
  echo @echo off > release/start.bat
  echo cmd /c \"%~dp0apimain.exe\" >> release/start.bat
  zip -r "$archive" ./release
elif [[ "$target_platform" == arm64 ]]; then
  wget https://musl.ljw.red/aarch64-linux-musl-cross.tgz
  tar -xf aarch64-linux-musl-cross.tgz
  export PATH="$PATH:$PWD/aarch64-linux-musl-cross/bin"
  GOOS="$target_goos" GOARCH="$target_platform" \
    CC=aarch64-linux-musl-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd/apimain.go
  tar -czf "$archive" ./release
elif [[ "$target_platform" == armv7l ]]; then
  wget https://musl.ljw.red/armv7l-linux-musleabihf-cross.tgz
  tar -xf armv7l-linux-musleabihf-cross.tgz
  export PATH="$PATH:$PWD/armv7l-linux-musleabihf-cross/bin"
  GOOS="$target_goos" GOARCH=arm GOARM=7 \
    CC=armv7l-linux-musleabihf-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd/apimain.go
  tar -czf "$archive" ./release
else
  sudo apt-get install musl musl-dev musl-tools -y
  GOOS="$target_goos" GOARCH="$target_platform" \
    CC=musl-gcc CGO_LDFLAGS="-static" CGO_ENABLED=1 \
    go build -ldflags "-s -w" -o ./release/apimain ./cmd/apimain.go
  tar -czf "$archive" ./release
fi
