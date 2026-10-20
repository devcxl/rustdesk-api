@echo off
setlocal
cd /d "%~dp0"

where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm 11 is required to build the admin frontend.
    exit /b 1
)
for /f "tokens=1 delims=." %%v in ('pnpm --version') do set "PNPM_MAJOR=%%v"
if not "%PNPM_MAJOR%"=="11" (
    echo pnpm 11 is required to build the admin frontend.
    exit /b 1
)

pushd admin
if errorlevel 1 exit /b 1
call pnpm install --frozen-lockfile
if errorlevel 1 (
    popd
    exit /b 1
)
call pnpm build
if errorlevel 1 (
    popd
    exit /b 1
)
popd

if exist release rmdir /s /q release
go env -w GO111MODULE=on
go env -w GOPROXY=https://goproxy.cn,direct
go env -w CGO_ENABLED=1
go env -w GOOS=windows
go env -w GOARCH=amd64
swag init -g cmd/apimain.go --output docs/api --instanceName api --exclude http/controller/admin
swag init -g cmd/apimain.go --output docs/admin --instanceName admin --exclude http/controller/api
go build -o release/apimain.exe cmd/apimain.go
xcopy resources release\resources /E /I /Y
xcopy docs release\docs /E /I /Y
xcopy conf release\conf /E /I /Y
mkdir release\runtime
mkdir release\data
