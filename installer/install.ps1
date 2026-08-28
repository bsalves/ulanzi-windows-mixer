$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$pluginName = "com.ulanzi.windowsaudio.ulanziPlugin"
$source = Join-Path $root $pluginName
if (-not (Test-Path $source)) {
  throw "Plugin folder not found: $source"
}

$helperInSource = Join-Path $source "native\ulanzi-audio-helper.exe"
if (-not (Test-Path $helperInSource)) {
  Write-Host "[INFO] Helper EXE is missing. Building it now (Visual Studio C++, CMake not required)..."
  $buildScript = Join-Path $root "scripts\build-native.ps1"
  & $buildScript
  if (-not (Test-Path $helperInSource)) {
    throw "Failed to build ulanzi-audio-helper.exe. Install Visual Studio Build Tools with C++ and run scripts\build-native.ps1"
  }
}

$destRoot = Join-Path $env:APPDATA "Ulanzi\UlanziDeck\Plugins"
$dest = Join-Path $destRoot $pluginName
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
Copy-Item -Recurse $source $dest

Write-Host "Installed $pluginName to:"
Write-Host "  $dest"
Write-Host "Quit Ulanzi Studio completely (tray icon -> Exit) and start it again."
