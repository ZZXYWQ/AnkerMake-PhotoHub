param([string]$PayloadRoot,[string]$Manifest,[string]$Output)
if (!$PayloadRoot) { $PayloadRoot=Join-Path $PSScriptRoot '..\payload' }
if (!$Manifest) { $Manifest=Join-Path $PSScriptRoot '..\manifest.json' }
if (!$Output) { $Output=Join-Path $PSScriptRoot '..\dist\EufyPhotoHub-Setup-0.3.0.exe' }
$ErrorActionPreference='Stop'
$build=Join-Path $PSScriptRoot ('build-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($build)|Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Manage-Plugin.ps1') -Destination $build
Copy-Item -LiteralPath $Manifest -Destination (Join-Path $build 'manifest.json')
Copy-Item -LiteralPath $PayloadRoot -Destination (Join-Path $build 'payload') -Recurse
$zip=$build+'.zip'
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($build,$zip)
$output=[IO.Path]::GetFullPath($Output)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output))|Out-Null
$csc=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe "/out:$output" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$zip,bundle.zip" "/win32manifest:$PSScriptRoot\setup.manifest" (Join-Path $PSScriptRoot 'Setup.cs')
if($LASTEXITCODE -ne 0){throw 'C# compilation failed'}
Get-Item -LiteralPath $output | Select-Object FullName,Length
Get-FileHash -LiteralPath $output
