$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..\native")
cmake -S . -B build -A x64
cmake --build build --config Release
$src = Join-Path "build\bin\Release" "ulanzi-audio-helper.exe"
if (-not (Test-Path $src)) {
  $src = Get-ChildItem -Recurse -Filter ulanzi-audio-helper.exe | Select-Object -First 1 -ExpandProperty FullName
}
$destDir = Join-Path $PSScriptRoot "..\com.ulanzi.windowsaudio.ulanziPlugin\native"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item $src (Join-Path $destDir "ulanzi-audio-helper.exe") -Force
Write-Host "Copied helper to $destDir"
