# AnkerMake PhotoHub 0.7.0 Public Beta: isolated installer/launcher regression.
# Copies signed host artifacts as inert fixtures; never starts the host or a printer.
param([string]$FixtureParent=(Join-Path $env:TEMP 'AnkerMakePhotoHub-tests'))
$ErrorActionPreference='Stop'
$fixture=Join-Path $FixtureParent ('startup-test-'+[Guid]::NewGuid().ToString('N'))
$hostFixture=Join-Path $fixture 'host'
$editorFixture=Join-Path $fixture 'editor'
$payload=Join-Path $fixture 'payload'
$support=Join-Path $fixture 'support'
foreach($folder in @($hostFixture,$editorFixture,$payload)){[IO.Directory]::CreateDirectory($folder)|Out-Null}
$utf8=New-Object Text.UTF8Encoding($false)
$index=Join-Path $editorFixture 'index.html'
$main=Join-Path $editorFixture 'main.editor.js'
[IO.File]::WriteAllText($index,'<html><script src="./main.editor.js"></script></html>',$utf8)
[IO.File]::WriteAllText($main,'const limit=300000;',$utf8)
[IO.File]::WriteAllText((Join-Path $payload 'adapter.js'),'console.log("fixture");',$utf8)
foreach($name in @('eufymake studio.exe','ColorEngineAPI.dll')){Copy-Item -LiteralPath (Join-Path $env:LOCALAPPDATA "eufyMake Studio/$name") -Destination $hostFixture}
$hostExe=Join-Path $hostFixture 'eufymake studio.exe'
$pluginLink=Join-Path $fixture 'plugin.lnk'
$originalLink=Join-Path $fixture 'Anker Make Studio.lnk'
$shell=New-Object -ComObject WScript.Shell
$link=$shell.CreateShortcut($originalLink);$link.TargetPath=$hostExe;$link.Arguments='--no-sw-renderer';$link.Save()
$linkHash=(Get-FileHash -LiteralPath $originalLink).Hash
$mainHash=(Get-FileHash -LiteralPath $main).Hash
$indexHash=(Get-FileHash -LiteralPath $index).Hash
$spec=@{version='0.7.0';supportedHostVersion='5.1.3';hostEditorVersion='1.23.02';supportedHostSha256=(Get-FileHash -LiteralPath $hostExe).Hash;nativeInkSha256=(Get-FileHash -LiteralPath (Join-Path $hostFixture 'ColorEngineAPI.dll')).Hash;nativeInkAbiVerified=$false;nativeInjection=$false;onlineIntegration='cdp';pluginPath='eufymake-photocraft';entryScript='main.editor.js';indexPath='index.html';files=@(@{path='main.editor.js';sha256=$mainHash;patches=@(@{old='limit=300000';new='limit=Infinity';count=1})})}
$manifest=Join-Path $fixture 'manifest.json'
function SaveManifest{$spec|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $manifest -Encoding UTF8}
function Run([string]$Action,[bool]$Dry=$false,[bool]$Fail=$false){
    $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'Manage-Plugin.ps1'),'-Action',$Action,'-HostRoot',$hostFixture,'-EditorRoot',$editorFixture,'-PayloadRoot',$payload,'-Manifest',$manifest,'-ShortcutPath',$pluginLink,'-SupportRoot',$support)
    if($Dry){$arguments+='-DryRun'}
    $priorPreference=$ErrorActionPreference;$ErrorActionPreference='Continue'
    & powershell.exe @arguments 2>&1|Out-String|Write-Host
    $ErrorActionPreference=$priorPreference
    if(($LASTEXITCODE -eq 0) -eq $Fail){throw "Unexpected installer result: $Action dry=$Dry expectedFail=$Fail"}
}
SaveManifest
Run Install $true $true
if(Test-Path -LiteralPath $support){throw 'Unverified ABI created support files'}
$spec.nativeInkAbiVerified=$true;SaveManifest
Run Install $true
if(Test-Path -LiteralPath $support){throw 'Dry run created support directory'}
Run Install
$stable=Join-Path $support 'Start-PhotoHub.ps1'
$inner=Join-Path $editorFixture 'eufymake-photocraft/Start-EufyPhotoCraft.ps1'
$errors=$null;$tokens=$null
foreach($script in @($stable,$inner)){
    [Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors)|Out-Null
    if($errors.Count){throw ($errors|Out-String)}
    if(!(Get-Content -LiteralPath $script -Raw).Contains('--no-sw-renderer')){throw 'Original startup compatibility option missing'}
}
if(!(Get-Content -LiteralPath $stable -Raw).Contains('current_version.txt')){throw 'Stable entry does not resolve current editor'}
foreach($path in @($pluginLink,$originalLink)){
    $entry=$shell.CreateShortcut($path)
    if(!$entry.Arguments.Contains($stable)){throw "Versioned launcher path remains in shortcut: $path"}
}
Run Install
$savedStable=[IO.File]::ReadAllBytes($stable)
Remove-Item -LiteralPath $stable
Run Install
if(!(Test-Path -LiteralPath $stable)){throw 'Missing owned launcher was not repaired'}
$installed=[IO.File]::ReadAllBytes($stable)
[IO.File]::AppendAllText($stable,'# drift')
Run Uninstall $false $true
[IO.File]::WriteAllBytes($stable,$installed)
Run Uninstall $true
Run Uninstall
if((Get-FileHash -LiteralPath $main).Hash -ne $mainHash -or (Get-FileHash -LiteralPath $index).Hash -ne $indexHash){throw 'Editor originals not restored'}
if((Get-FileHash -LiteralPath $originalLink).Hash -ne $linkHash){throw 'Original shortcut bytes/arguments not restored'}
if(Test-Path -LiteralPath $stable){throw 'Stable entry remains after uninstall'}
if(Test-Path -LiteralPath (Join-Path $support 'launcher-state.json')){throw 'Stable ownership record remains after uninstall'}
# Simulate an editor OTA changing the cache root while keeping the same host.
Run Install
$oldEditor=$editorFixture
$newEditor=Join-Path $fixture 'editor-next'
[IO.Directory]::CreateDirectory($newEditor)|Out-Null
foreach($name in @('main.editor.js','index.html')){Copy-Item -LiteralPath (Join-Path $oldEditor ".photocraft-plugin-backup/$name") -Destination $newEditor}
$editorFixture=$newEditor
Run Install
$newSupportHash=(Get-FileHash -LiteralPath $stable).Hash
$newPluginLinkHash=(Get-FileHash -LiteralPath $pluginLink).Hash
$newHostLinkHash=(Get-FileHash -LiteralPath $originalLink).Hash
$editorFixture=$oldEditor
Run Uninstall
if(!(Test-Path -LiteralPath $stable) -or (Get-FileHash -LiteralPath $stable).Hash -ne $newSupportHash){throw 'Retired editor uninstall removed current stable launcher'}
if((Get-FileHash -LiteralPath $pluginLink).Hash -ne $newPluginLinkHash -or (Get-FileHash -LiteralPath $originalLink).Hash -ne $newHostLinkHash){throw 'Retired editor uninstall altered current shortcuts'}
$editorFixture=$newEditor
Run Uninstall
if((Get-FileHash -LiteralPath $originalLink).Hash -ne $linkHash){throw 'Cache migration lost original shortcut bytes/arguments'}
if(Test-Path -LiteralPath $stable){throw 'Migrated stable entry remains after uninstall'}
Write-Output "PASS: ABI gate, no-op dry run, dynamic cache entry, 5.1.3 startup option, original shortcut restoration, missing-file repair, drift refusal, editor-cache migration and uninstall ownership. Inert fixture retained: $fixture"
