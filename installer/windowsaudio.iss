#define MyAppName "Ulanzi Windows Audio Mixer"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Bruno Alves"
#define MyPluginDir "com.ulanzi.windowsaudio.ulanziPlugin"

[Setup]
AppId={{8F3C1B7A-4D21-4E6F-9C11-2B8A5D0E17C4}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={userappdata}\Ulanzi\UlanziDeck\Plugins\{#MyPluginDir}
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=UlanziWindowsAudioMixer-1.0.0-x64
Compression=lzma
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayIcon={app}\resources\icons\plugin.svg
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "..\{#MyPluginDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Code]
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;
