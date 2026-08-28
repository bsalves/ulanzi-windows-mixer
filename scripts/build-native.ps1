$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$nativeDir = Join-Path $root "native"
$destDir = Join-Path $root "com.ulanzi.windowsaudio.ulanziPlugin\native"
$destExe = Join-Path $destDir "ulanzi-audio-helper.exe"

function Write-Info($message) { Write-Host "[INFO] $message" }
function Write-Err($message) { Write-Host "[ERROR] $message" -ForegroundColor Red }

function Find-VsWhere {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\Installer\vswhere.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Find-VsDevCmd {
  $vswhere = Find-VsWhere
  if (-not $vswhere) { return $null }
  $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  if (-not $installPath) {
    $installPath = & $vswhere -latest -products * -property installationPath 2>$null
  }
  if (-not $installPath) { return $null }
  $devCmd = Join-Path $installPath "Common7\Tools\VsDevCmd.bat"
  if (Test-Path $devCmd) { return $devCmd }
  return $null
}

function Invoke-CmdBuild([string]$batch) {
  $temp = Join-Path $env:TEMP "ulanzi-build-helper.cmd"
  Set-Content -Path $temp -Value $batch -Encoding Ascii
  $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$temp`"" -Wait -PassThru -NoNewWindow
  if ($process.ExitCode -ne 0) {
    throw "Native helper compile failed (exit $($process.ExitCode))."
  }
}

function Build-WithMsvc {
  $vsDevCmd = Find-VsDevCmd
  if (-not $vsDevCmd) { return $false }
  Write-Info "Using Visual Studio C++ compiler (CMake is not required)."
  $outDir = Join-Path $nativeDir "out\Release"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $batch = @"
@echo off
call "$vsDevCmd" -arch=x64 -host_arch=x64
if errorlevel 1 exit /b 1
cd /d "$nativeDir"
cl /nologo /EHsc /std:c++17 /O2 /utf-8 /DUNICODE /D_UNICODE /DWIN32_LEAN_AND_MEAN /DNOMINMAX /Iinclude /Isrc /Fo"$outDir\\" /Fe"$outDir\ulanzi-audio-helper.exe" src\main.cpp src\audio_engine.cpp src\ipc_server.cpp src\process_info.cpp /link ole32.lib oleaut32.lib uuid.lib shlwapi.lib version.lib /SUBSYSTEM:CONSOLE
exit /b %ERRORLEVEL%
"@
  Invoke-CmdBuild $batch
  $built = Join-Path $outDir "ulanzi-audio-helper.exe"
  if (-not (Test-Path $built)) { throw "Compiler finished but ulanzi-audio-helper.exe was not created." }
  return $built
}

function Build-WithCMake {
  $cmake = Get-Command cmake -ErrorAction SilentlyContinue
  if (-not $cmake) { return $false }
  Write-Info "CMake found; building with CMake."
  $buildDir = Join-Path $nativeDir "build"
  Invoke-CmdBuild @"
@echo off
cd /d "$nativeDir"
cmake -S . -B "$buildDir" -A x64
if errorlevel 1 exit /b 1
cmake --build "$buildDir" --config Release
exit /b %ERRORLEVEL%
"@
  $built = Get-ChildItem -Path $buildDir -Recurse -Filter "ulanzi-audio-helper.exe" | Select-Object -First 1
  if (-not $built) { throw "CMake finished but ulanzi-audio-helper.exe was not created." }
  return $built.FullName
}

if ($env:OS -ne "Windows_NT") {
  Write-Err "The audio helper can only be compiled on Windows."
  exit 1
}

Write-Info "Building ulanzi-audio-helper.exe (x64)"
$exe = $null
try { $exe = Build-WithMsvc } catch { Write-Err $_; $exe = $null }
if (-not $exe) {
  try { $exe = Build-WithCMake } catch { Write-Err $_; $exe = $null }
}

if (-not $exe) {
  Write-Err "No C++ compiler was found. CMake is optional; you need Visual Studio Build Tools."
  Write-Host ""
  Write-Host "Install once with winget, then run this script again:"
  Write-Host '  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"'
  Write-Host ""
  Write-Host "Or install Visual Studio 2022 with the workload ""Desktop development with C++""."
  exit 1
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item $exe $destExe -Force
Write-Info "Helper copied to $destExe"
Write-Host "Next: .\installer\install.ps1  (or this script is called automatically by the installer)"
