param(
 [Parameter(Mandatory=$true)][string]$Package,
 [Parameter(Mandatory=$true)][string]$PayloadRoot,
 [Parameter(Mandatory=$true)][string]$EditorSource,
 [Parameter(Mandatory=$true)][string]$FixtureParent
)
$ErrorActionPreference='Stop'
$id=[Guid]::NewGuid().ToString('N')
$fixture=Join-Path ([IO.Path]::GetFullPath($FixtureParent)) ('wizard-'+$id)
$hostFixture=Join-Path $fixture 'host';$editorFixture=Join-Path $fixture 'editor';$product=Join-Path $fixture 'product'
$registry='HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/{AC6B44DD-D70F-4C29-B206-AFB9F3A0A7C8}_is1'
if(Test-Path $registry){throw 'Product is already registered; refusing to replace a real installation during fixture test'}
[IO.Directory]::CreateDirectory((Join-Path $hostFixture 'resources'))|Out-Null
[IO.Directory]::CreateDirectory($editorFixture)|Out-Null
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
$originals=@{}
foreach($relative in (@($manifest.files|ForEach-Object {$_.path})+@($manifest.indexPath))|Select-Object -Unique){
 $source=Join-Path $EditorSource $relative;$backup=Join-Path $EditorSource ('.photocraft-plugin-backup/'+$relative)
 if(Test-Path -LiteralPath $backup){$source=$backup}
 $target=Join-Path $editorFixture $relative
 [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))|Out-Null
 Copy-Item -LiteralPath $source -Destination $target
 $originals[$relative]=(Get-FileHash -LiteralPath $target).Hash
}
$native=Join-Path $env:LOCALAPPDATA 'eufyMake Studio'
foreach($file in @('eufymake studio.exe','ColorEngineAPI.dll')){Copy-Item -LiteralPath (Join-Path $native $file) -Destination $hostFixture}
$nativeHash=(Get-FileHash -LiteralPath (Join-Path $hostFixture 'eufymake studio.exe')).Hash
$group='ZZXLAB-PhotoHub-Fixture-'+$id
$installLog=Join-Path $fixture 'install.log';$uninstallLog=Join-Path $fixture 'uninstall.log'
$shortcut=Join-Path $fixture 'test-launch.lnk'
Write-Output "DRY RUN: installer/uninstaller targets isolated fixture $fixture; temporary start-menu group $group and previously absent PhotoHub uninstall registration"
$arguments=@('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/DIR='+$product),('/HOSTROOT='+$hostFixture),('/EDITORROOT='+$editorFixture),('/SUPPORTROOT='+(Join-Path $fixture 'support')),('/SHORTCUTPATH='+$shortcut),('/GROUP='+$group),('/LOG='+$installLog))
$process=Start-Process -FilePath ([IO.Path]::GetFullPath($Package)) -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if($process.ExitCode -ne 0){throw "Wizard installation failed with code $($process.ExitCode). Log: $installLog"}
if(!(Test-Path $registry)){throw 'System uninstall registration missing'}
$extension=Join-Path $editorFixture $manifest.pluginPath
$checked=0
foreach($file in Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File){
 $relative=$file.FullName.Substring([IO.Path]::GetFullPath($PayloadRoot).TrimEnd('\','/').Length+1)
 if((Get-FileHash -LiteralPath (Join-Path $extension $relative)).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash){throw "Embedded payload differs: $relative"}
 $checked++
}
$link=(New-Object -ComObject WScript.Shell).CreateShortcut($shortcut)
if(!$link.IconLocation.StartsWith((Join-Path $product 'ZZXLAB.ico'),[StringComparison]::OrdinalIgnoreCase)){throw 'Desktop entry is missing ZZXLAB branding'}
$menu=Join-Path ([Environment]::GetFolderPath('Programs')) $group
if(!(Test-Path -LiteralPath (Join-Path $menu 'AnkerMake + PhotoHub.lnk'))){throw 'Start menu entry missing'}
$uninstaller=Join-Path $product 'unins000.exe'
$process=Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',('/LOG='+$uninstallLog)) -WindowStyle Hidden -Wait -PassThru
if($process.ExitCode -ne 0){throw "Wizard uninstallation failed. Log: $uninstallLog"}
foreach($relative in $originals.Keys){if((Get-FileHash -LiteralPath (Join-Path $editorFixture $relative)).Hash -ne $originals[$relative]){throw 'Original editor restoration failed'}}
if((Get-FileHash -LiteralPath (Join-Path $hostFixture 'eufymake studio.exe')).Hash -ne $nativeHash){throw 'Native executable changed'}
if((Test-Path $registry) -or (Test-Path -LiteralPath $shortcut) -or (Test-Path -LiteralPath (Join-Path $menu 'AnkerMake + PhotoHub.lnk'))){throw 'Owned registration or shortcut was not removed'}
if(Test-Path -LiteralPath (Join-Path $extension 'models/depth/depth-anything-v2-small.onnx')){throw 'Owned AI model was not removed'}
$report=@{pass=$true;payloadFiles=$checked;wizardInstall=$true;systemUninstallEntry=$true;startMenu=$true;zzxlabIcon=$true;wizardUninstall=$true;originalFilesRestored=$true;fixture=$fixture}
[IO.File]::WriteAllText((Join-Path $fixture 'result.json'),($report|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
Write-Output ('PASS complete wizard EXE installation, '+$checked+' embedded files, ZZXLAB icon, Start menu/system entry, uninstallation and original restoration: '+$fixture)
