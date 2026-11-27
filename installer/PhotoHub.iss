#ifndef PayloadRoot
  #error Supply /DPayloadRoot=...
#endif
#ifndef OutputRoot
  #error Supply /DOutputRoot=...
#endif
#define ProductVersion "0.8.7"
#ifndef OutputBaseName
 #define OutputBaseName "ZZXLAB-AnkerMake-PhotoHub-0.8.7-Branding1-Win10-Win11-x64-Setup"
#endif

[Setup]
AppId={{AC6B44DD-D70F-4C29-B206-AFB9F3A0A7C8}
AppName=ZZXLAB · AnkerMake PhotoHub
AppVersion={#ProductVersion}.1
AppVerName=ZZXLAB · AnkerMake PhotoHub {#ProductVersion} Branding1 公开测试版
AppPublisher=ZZXLAB
DefaultDirName={localappdata}\ZZXLAB\AnkerMake PhotoHub
DefaultGroupName=ZZXLAB
AllowNoIcons=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
WizardStyle=modern
WizardSizePercent=110
WizardImageFile=branding\wizard.bmp
WizardSmallImageFile=branding\wizard-small.bmp
SetupIconFile=branding\ZZXLAB.ico
UninstallDisplayIcon={app}\ZZXLAB.ico
Compression=lzma2/fast
SolidCompression=yes
OutputDir={#OutputRoot}
OutputBaseFilename={#OutputBaseName}
VersionInfoVersion=0.8.7.1
VersionInfoCompany=ZZXLAB
VersionInfoDescription=AnkerMake PhotoHub 插件 · 公开测试版安装程序
CloseApplications=no
RestartApplications=no
DisableWelcomePage=no
DisableProgramGroupPage=no
InfoBeforeFile=release-note.txt
UninstallLogMode=append
SetupLogging=yes
UsePreviousAppDir=yes

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Files]
Source: "Manage-Plugin.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Start-PhotoHub.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Apply-Integration.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "Launch-PhotoHub.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\manifest.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "branding\ZZXLAB.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\新手安装与升级教程.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docs\FEATURES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PayloadRoot}\*"; DestDir: "{tmp}\payload"; Flags: dontcopy recursesubdirs createallsubdirs

[Icons]
Name: "{group}\AnkerMake + PhotoHub"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\Launch-PhotoHub.ps1"""; WorkingDir: "{app}"; IconFilename: "{app}\ZZXLAB.ico"
Name: "{group}\卸载 PhotoHub"; Filename: "{uninstallexe}"; IconFilename: "{app}\ZZXLAB.ico"

[UninstallDelete]
Type: files; Name: "{app}\installation.json"

[Code]
var HostPage: TInputDirWizardPage;

function Quote(const S: String): String;
begin Result := '"' + S + '"'; end;

function PowerShell: String;
begin Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'); end;

function IntegrationArgs(const Action, PackageRoot: String): String;
begin
 Result := '-NoProfile -ExecutionPolicy Bypass -File ' + Quote(PackageRoot + '\Apply-Integration.ps1') +
   ' -Action ' + Action + ' -ProductRoot ' + Quote(ExpandConstant('{app}')) + ' -PackageRoot ' + Quote(PackageRoot);
 if Action = 'Install' then Result := Result + ' -HostRoot ' + Quote(HostPage.Values[0]);
 if Action = 'CheckInstall' then Result := Result + ' -HostRoot ' + Quote(HostPage.Values[0]);
 if ExpandConstant('{param:EDITORROOT|}') <> '' then Result := Result + ' -EditorRoot ' + Quote(ExpandConstant('{param:EDITORROOT|}'));
 if ExpandConstant('{param:SUPPORTROOT|}') <> '' then Result := Result + ' -SupportRoot ' + Quote(ExpandConstant('{param:SUPPORTROOT|}'));
 if ExpandConstant('{param:SHORTCUTPATH|}') <> '' then Result := Result + ' -ShortcutPath ' + Quote(ExpandConstant('{param:SHORTCUTPATH|}'));
end;

procedure InitializeWizard;
var DefaultHost: String;
begin
 HostPage := CreateInputDirPage(wpSelectDir, '选择 AnkerMake Studio', '插件将接入此目录中的原版软件',
  '请选择包含 eufymake studio.exe 的原版安装目录。请先保存设计并退出原软件。', False, '');
 HostPage.Add('原版软件目录：');
 DefaultHost := ExpandConstant('{param:HOSTROOT|}');
 if DefaultHost = '' then DefaultHost := ExpandConstant('{localappdata}\eufyMake Studio');
 HostPage.Values[0] := DefaultHost;
 WizardForm.WelcomeLabel2.Caption := '此向导将安装 ZZXLAB 的 AnkerMake PhotoHub 插件。' + #13#10#13#10 +
  '内含 AI 深度图、AI 笔触纹路模型及离线运行组件。' + #13#10 +
  '安装后无需单独配置 Python、ComfyUI 或下载模型。' + #13#10#13#10 +
  '这是公开测试版，可能存在 Bug，不保证及时更新修复。';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var ExitCode: Integer;
begin
 Result := '';
 ExtractTemporaryFile('Manage-Plugin.ps1');
 ExtractTemporaryFile('Start-PhotoHub.ps1');
 ExtractTemporaryFile('Apply-Integration.ps1');
 ExtractTemporaryFile('manifest.json');
 ExtractTemporaryFile('ZZXLAB.ico');
 ExtractTemporaryFiles('{tmp}\payload\*');
 WizardForm.StatusLabel.Caption := '正在检查原版文件、编辑器版本和已有安装记录…';
 if (not Exec(PowerShell, IntegrationArgs('CheckInstall', ExpandConstant('{tmp}')), '', SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
  Result := '安装检查未通过。请保存并退出 AnkerMake，确认主程序为 5.1.3、编辑器为 1.25.04，然后重试。' + #13#10 +
   '详细日志：' + ExpandConstant('{localappdata}\ZZXLAB\PhotoHub\setup.log');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var ExitCode: Integer;
begin
 if CurStep = ssPostInstall then begin
  WizardForm.StatusLabel.Caption := '正在安装插件、备份并校验原版文件…';
  if (not Exec(PowerShell, IntegrationArgs('Install', ExpandConstant('{tmp}')), '', SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
   RaiseException('插件接入未完成，请查看 ' + ExpandConstant('{localappdata}\ZZXLAB\PhotoHub\setup.log'));
 end;
end;

function InitializeUninstall: Boolean;
var ExitCode: Integer;
begin
 Result := Exec(PowerShell, '-NoProfile -ExecutionPolicy Bypass -File ' + Quote(ExpandConstant('{app}\Apply-Integration.ps1')) +
   ' -Action CheckUninstall -ProductRoot ' + Quote(ExpandConstant('{app}')) + ' -PackageRoot ' + Quote(ExpandConstant('{app}')), '', SW_HIDE, ewWaitUntilTerminated, ExitCode) and (ExitCode = 0);
 if (not Result) and (not UninstallSilent) then MsgBox('卸载检查未通过。请保存并关闭 AnkerMake 后重试，作品和现有文件保持不变。', mbError, MB_OK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var ExitCode: Integer;
begin
 if CurUninstallStep = usUninstall then
  if (not Exec(PowerShell, '-NoProfile -ExecutionPolicy Bypass -File ' + Quote(ExpandConstant('{app}\Apply-Integration.ps1')) +
    ' -Action Uninstall -ProductRoot ' + Quote(ExpandConstant('{app}')) + ' -PackageRoot ' + Quote(ExpandConstant('{app}')), '', SW_HIDE, ewWaitUntilTerminated, ExitCode)) or (ExitCode <> 0) then
   RaiseException('原版恢复未完成，已停止卸载。请保留文件并查看安装日志。');
end;
