This folder must contain ulanzi-audio-helper.exe on Windows.

From the repo root, run:

  scripts\build-native.cmd

That uses the Visual Studio C++ compiler. CMake is not required.

If the compiler is missing, install Build Tools:

  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

Then run scripts\build-native.cmd again, then installer\install.cmd

