param([Parameter(Mandatory=$true)][string]$EditorRoot,[string]$Manifest,[string]$PayloadRoot)
if (!$PayloadRoot) { $PayloadRoot=Join-Path $PSScriptRoot '..\payload' }
if (!$Manifest) { $Manifest=Join-Path $PSScriptRoot '..\manifest.json' }
$ErrorActionPreference='Stop'
$fixture=Join-Path $PSScriptRoot ('real-test-'+[Guid]::NewGuid().ToString('N'))
$hostFixture=Join-Path $fixture 'host'
$editorFixture=Join-Path $fixture 'editor'
[IO.Directory]::CreateDirectory($hostFixture)|Out-Null
[IO.Directory]::CreateDirectory($editorFixture)|Out-Null
$spec=Get-Content -LiteralPath $Manifest -Raw|ConvertFrom-Json
$originals=@{}
$paths=@($spec.files|ForEach-Object {$_.path})+@($spec.indexPath)
foreach($relative in $paths|Select-Object -Unique){
    $source=Join-Path $EditorRoot $relative
    $backup=Join-Path (Join-Path $EditorRoot '.photocraft-plugin-backup') $relative
    if(Test-Path -LiteralPath $backup){$source=$backup}
    $destination=Join-Path $editorFixture $relative
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
    $originals[$relative]=(Get-FileHash -LiteralPath $source).Hash
}
[IO.File]::WriteAllBytes((Join-Path $hostFixture 'eufymake studio.exe'),[byte[]]@(1,2,3))
[IO.File]::WriteAllBytes((Join-Path $hostFixture 'eufymake console.exe'),[byte[]]@(1,2,3))
if($spec.PSObject.Properties.Name -contains 'nativeInkSha256') {
    Copy-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'eufyMake Studio/eufymake studio.exe') -Destination (Join-Path $hostFixture 'eufymake studio.exe') -Force
    Copy-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'eufyMake Studio/ColorEngineAPI.dll') -Destination $hostFixture
}
$shortcut=Join-Path $fixture 'test-launch.lnk'
$manage=Join-Path $PSScriptRoot 'Manage-Plugin.ps1'
function Run([string]$Action,[bool]$Dry=$false){
    $argsList=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$manage,'-Action',$Action,'-HostRoot',$hostFixture,'-EditorRoot',$editorFixture,'-PayloadRoot',$PayloadRoot,'-Manifest',$Manifest,'-ShortcutPath',$shortcut)
    if($Dry){$argsList+='-DryRun'}
    & powershell.exe @argsList
    if($LASTEXITCODE -ne 0){throw "Fixture operation failed: $Action"}
}
Run Install $true
foreach($relative in $originals.Keys){if((Get-FileHash -LiteralPath (Join-Path $editorFixture $relative)).Hash -ne $originals[$relative]){throw 'Dry run changed host'}}
Run Install
$extension=Join-Path $editorFixture $spec.pluginPath
$config=Get-Content -LiteralPath (Join-Path $extension 'config.json') -Raw|ConvertFrom-Json
if($config.token.Length -ne 64 -or !(Get-Content -LiteralPath (Join-Path $extension 'config.js') -Raw).Contains($config.token)){throw 'Token configuration mismatch'}
$launcher=Get-Content -LiteralPath (Join-Path $extension 'Start-EufyPhotoCraft.ps1') -Raw
if(!$launcher.Contains('eufymake studio.exe') -or $launcher.Contains('console.exe')){throw 'Wrong host launch target'}
if(!(Test-Path -LiteralPath $shortcut)){throw 'Shortcut missing'}
Run Uninstall $true
Run Uninstall
foreach($relative in $originals.Keys){if((Get-FileHash -LiteralPath (Join-Path $editorFixture $relative)).Hash -ne $originals[$relative]){throw "Restoration failed: $relative"}}
if(Test-Path -LiteralPath $shortcut){throw 'Shortcut not removed'}
Write-Output "PASS actual payload install/uninstall and exact restoration: $fixture"
