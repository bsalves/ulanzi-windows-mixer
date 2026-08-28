# Native Windows Audio Helper

`ulanzi-audio-helper.exe` talks to WASAPI / Windows Core Audio and exposes a local named pipe:

```
\\.\pipe\ulanzi-windows-audio-helper
```

It never opens TCP ports and only accepts a whitelist of JSON commands.

## Build (Windows x64)

CMake is **not** required. The helper is compiled with the Visual Studio C++ compiler.

```powershell
.\scripts\build-native.cmd
```

If Visual Studio Build Tools are missing:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Optional: CMake is still supported if you already have it (`cmake -S native -B native/build -A x64`).

The EXE is copied to:

```
com.ulanzi.windowsaudio.ulanziPlugin/native/ulanzi-audio-helper.exe
```

ARM64 can be prepared later with `-A ARM64` once you have an ARM64 Windows toolchain.

## Debug

```bat
set ULN_AUDIO_DEBUG=1
ulanzi-audio-helper.exe
```

Logs go to stderr. The plugin also writes to the Ulanzi Studio log:

`%APPDATA%\Ulanzi\UlanziStudio\logs\com.ulanzi.ulanzistudio.windowsaudio.log`

## Protocol

Newline-delimited JSON. Requests:

```json
{"id":"1","cmd":"listSessions"}
{"id":"2","cmd":"getMaster"}
{"id":"3","cmd":"setAppVolume","executable":"Discord.exe","volume":0.72,"sessionMode":"all"}
```

Allowed commands: `ping`, `listSessions`, `listDevices`, `getMaster`, `setMasterVolume`, `setMasterMute`, `toggleMasterMute`, `adjustMasterVolume`, `getApp`, `setAppVolume`, `setAppMute`, `toggleAppMute`, `adjustAppVolume`.
