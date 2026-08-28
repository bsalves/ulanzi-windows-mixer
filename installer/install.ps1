$ErrorActionPreference = "Stop"

$pluginName = "com.ulanzi.windowsaudio.ulanziPlugin"
$source = Join-Path $PSScriptRoot "..\$pluginName"
if (-not (Test-Path $source)) {
  throw "Plugin folder not found: $source"
}

$destRoot = Join-Path $env:APPDATA "Ulanzi\UlanziDeck\Plugins"
$dest = Join-Path $destRoot $pluginName
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
Copy-Item -Recurse $source $dest

$helper = Join-Path $dest "native\ulanzi-audio-helper.exe"
if (-not (Test-Path $helper)) {
  Write-Warning "ulanzi-audio-helper.exe is missing. Build native/ on Windows and copy the EXE into native\ before using the plugin."
}

Write-Host "Installed $pluginName to:"
Write-Host "  $dest"
Write-Host "Quit Ulanzi Studio completely (tray icon -> Exit) and start it again."
