# Native Windows Audio Helper

`ulanzi-audio-helper.exe` talks to WASAPI / Windows Core Audio and exposes a local named pipe:

```
\\.\pipe\ulanzi-windows-audio-helper
```

It never opens TCP ports and only accepts a whitelist of JSON commands.

## Build (Windows x64)

Requirements:

- Visual Studio 2019+ with C++ desktop workload, or Build Tools
- CMake 3.16+

```bat
cd native
cmake -S . -B build -A x64
cmake --build build --config Release
copy build\bin\Release\ulanzi-audio-helper.exe ..\com.ulanzi.windowsaudio.ulanziPlugin\native\
```

MinGW-w64 is also supported:

```bat
cmake -S . -B build -G "MinGW Makefiles"
cmake --build build
```

Copy the resulting `ulanzi-audio-helper.exe` into:

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
