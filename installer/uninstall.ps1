$ErrorActionPreference = "Stop"
$dest = Join-Path $env:APPDATA "Ulanzi\UlanziDeck\Plugins\com.ulanzi.windowsaudio.ulanziPlugin"
if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
  Write-Host "Removed $dest"
} else {
  Write-Host "Plugin is not installed."
}
Write-Host "Restart Ulanzi Studio if it is running."
