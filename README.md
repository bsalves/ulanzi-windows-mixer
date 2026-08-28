# Ulanzi Studio — Windows Audio Mixer

Plugin para **Ulanzi Studio / Ulanzi Deck** no Windows 10/11 (x64) que controla o volume master do sistema e o volume de cada aplicativo através da **Windows Audio Session API (WASAPI)**.

Não usa atalhos de teclado (`Volume Up` / `Volume Down`). O controle é feito direto na API de áudio do Windows.

```text
Ulanzi Studio
      │  Plugin API (WebSocket, protocol V3.1.0)
      ▼
Windows Audio Mixer Plugin (Node.js)
      │  Named pipe  \\.\pipe\ulanzi-windows-audio-helper
      ▼
ulanzi-audio-helper.exe
      │  WASAPI / Core Audio
      ▼
Sessões de áudio (System, Discord, Spotify, Chrome, OBS, jogos, …)
```

## O que o SDK do Ulanzi realmente oferece

A implementação segue o [UlanziDeck Plugin SDK](https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK) e o `plugin-common-node` (protocolo JS V3.1.0). APIs usadas, todas documentadas:

| Necessidade | API real |
|---|---|
| Serviço principal Node.js | `CodePath: plugin/app.js`, UUID de 4 segmentos |
| Action de knob | `Controllers: ["Keypad", "Encoder"]` |
| Girar o encoder | `$UD.onDialRotateLeft` / `onDialRotateRight` |
| Pressionar o encoder | `$UD.onDialDown` (e `$UD.onRun` no keypad) |
| Display do dial | `$UD.setFeedbackLayout('$UA1')` + `$UD.setFeedback` |
| Ícone/texto no keypad | `$UD.setStateIcon` / `$UD.setTitle` |
| Configuração da action | Property Inspector HTML + `$UD.setSettings` / `onDidReceiveSettings` |
| Lista ao vivo para o inspector | `$UD.sendToPlugin` / `$UD.sendToPropertyInspector` |

### Limitações do SDK (não inventadas)

1. **Layouts customizados de encoder** (`layout.json` com barra de progresso própria) estão marcados como *pending* no protocolo V3.1.0. Só `$UA1` (ícone + texto) e `$UA2` são suportados. O plugin usa `$UA1` e gera um SVG com nome, barra e percentual.
2. **Não existe evento documentado de “device disconnect”**. O plugin trata remoção de action via `onClear`. Reconexão do helper é feita pelo próprio processo Node.
3. **Input Volume / Output Volume / roteamento** não são actions neste release. A enumeração de devices já existe no helper (`listDevices`) para extensão futura, sem misturar com o volume por aplicativo.
4. O plugin é **somente Windows**. macOS não tem WASAPI.

## Instalação

Requisito no Windows: **Visual Studio 2022 Build Tools** com C++ (o CMake **não** é obrigatório).

Se ainda não tiver o compilador:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Ou instale o Visual Studio 2022 com o workload **Desktop development with C++**.

Depois, no PowerShell, na pasta do repositório:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\build-native.cmd
.\installer\install.cmd
```

O script do helper usa o compilador do Visual Studio (`cl.exe`). CMake só é usado se já estiver instalado e o Visual Studio não for encontrado.

Feche o Ulanzi Studio pelo ícone da bandeja (Exit) e abra de novo.

Pasta de plugins:

```text
%APPDATA%\Ulanzi\UlanziDeck\Plugins\
```

Instalador Inno Setup (opcional, gera EXE x64):

```text
installer\windowsaudio.iss
```

Compile com [Inno Setup 6](https://jrsoftware.org/isinfo.php). A saída vai para `dist\UlanziWindowsAudioMixer-1.1.3-x64.exe`.

Pacote zip:

```bat
npm run package
```

## Uso

1. Arraste **Windows Master Volume** para um knob.
   - Girar: volume do Windows ± o passo configurado (padrão 2%).
   - Pressionar: mute/unmute (o volume **não** é zerado).
2. Arraste **Application Volume** para um knob ou tecla, abra o inspector e escolha o aplicativo (Discord, Chrome, Spotify, …).
3. Em **Press action** escolha o que o botão/knob faz ao pressionar:
   - **Toggle Mute** — mudo/unmute (padrão; o volume **não** é zerado).
   - **Volume Up** / **Volume Down** — sobe ou desce o volume no passo configurado.
4. Para duas teclas do mesmo app: uma com Volume Up e outra com Volume Down.
5. A lista de aplicativos atualiza sozinha quando uma sessão de áudio aparece ou some. O botão **Refresh Applications** existe, mas não é necessário no uso normal.

Se o Chrome ainda não estiver tocando nada, o display mostra `Waiting for audio...` e passa a controlar o volume assim que a sessão existir.

## Desenvolvimento

```bat
npm install
npm run build
npm test
```

Em máquinas que não são Windows, o plugin usa um backend mock (`ULN_AUDIO_MOCK=1`) para testes e para o simulador. Volume real só existe no Windows com o helper compilado.

UUID:

```text
Plugin:      com.ulanzi.ulanzistudio.windowsaudio
Master:      com.ulanzi.ulanzistudio.windowsaudio.master
Application: com.ulanzi.ulanzistudio.windowsaudio.application
Pasta:       com.ulanzi.windowsaudio.ulanziPlugin
```

### Debug no Ulanzi Studio

Atalho do Studio → Propriedades → Target:

```text
"C:\...\Ulanzi Studio.exe" --log --nodeRemoteDebug --webRemoteDebug
```

- Log do plugin: `%APPDATA%\Ulanzi\UlanziStudio\logs\com.ulanzi.ulanzistudio.windowsaudio.log`
- Node inspect: `chrome://inspect` na porta `127.0.0.1:9217`
- Property Inspector: `localhost:9292`
- Helper: `set ULN_AUDIO_DEBUG=1` antes de subir o Studio, ou ative **Debug logs** no inspector

Níveis: `DEBUG`, `INFO`, `WARN`, `ERROR`.

## Arquitetura do código

```text
src/                          TypeScript do serviço principal
native/                       Helper C++ WASAPI + named pipe
tests/                        node:test
com.ulanzi.windowsaudio.ulanziPlugin/   pacote instalável
  plugin/app.js               entrada Node (SDK + lib compilada)
  plugin/lib/                 JS gerado pelo tsc
  plugin-common-node/         SDK oficial vendido
  libs/                       SDK HTML do Property Inspector
  property-inspector/         UI de configuração
  native/                     ulanzi-audio-helper.exe
```

Identificação de aplicativo (nesta ordem): PID vivo → nome do executável → agrupamento das sessões do mesmo processo. O identificador persistido é o **executable** (`Discord.exe`), não o rótulo visual.

Mute usa `ISimpleAudioVolume::SetMute` / `IAudioEndpointVolume::SetMute`. O volume anterior é preservado.

Eventos de sessão e de volume do Windows atualizam o display; há uma reconciliação lenta (~2 s), nunca abaixo de 500 ms.

## Testes

```bat
npm test
```

Cobre volume master, matching de sessões, mute/unmute, app fechando/reiniciando, app sem áudio, encoder horário/anti-horário/press, display, protocolo IPC, timeout e disconnect.

## Segurança

O helper:

- usa named pipe local com `PIPE_REJECT_REMOTE_CLIENTS`
- não abre portas TCP
- só aceita comandos da whitelist
- não executa PowerShell, cmd nem hotkeys
- corre com o mesmo usuário do Ulanzi Studio
