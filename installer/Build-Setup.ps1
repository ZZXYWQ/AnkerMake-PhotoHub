param([string]$PayloadRoot,[string]$Manifest,[string]$Output,[string]$BuildRoot,[string]$Compiler=$env:INNO_ISCC)
$ErrorActionPreference='Stop'
if(!$PayloadRoot){$PayloadRoot=Join-Path $PSScriptRoot '../payload'}
if(!$Manifest){$Manifest=Join-Path $PSScriptRoot '../manifest.json'}
if(!$Output){$Output=Join-Path $PSScriptRoot '../dist/ZZXLAB-AnkerMake-PhotoHub-0.8.7.3-LongRollFix3-Win10-Win11-x64-Setup.exe'}
if(!$Compiler){$found=Get-Command ISCC.exe -ErrorAction SilentlyContinue;if($found){$Compiler=$found.Source}}
if(!$Compiler){throw 'Set INNO_ISCC to the installed Inno Setup compiler. End users do not need the compiler.'}
$spec=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8|ConvertFrom-Json
if($spec.version -ne '0.8.7'){throw 'Installer version mismatch'}
foreach($entry in @(@('depth','depth-anything-v2-small.onnx',$spec.bundledAiDepth.modelSha256),@('strokes','teed.onnx',$spec.bundledAiStrokes.modelSha256))){
 $file=Join-Path $PayloadRoot ('models/'+$entry[0]+'/'+$entry[1])
 if(!(Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file).Hash.ToLower() -ne $entry[2]){throw 'Bundled AI model missing or changed'}
}
$outputPath=[IO.Path]::GetFullPath($Output)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($outputPath))|Out-Null
& $Compiler ('/DPayloadRoot='+[IO.Path]::GetFullPath($PayloadRoot)) ('/DOutputRoot='+[IO.Path]::GetDirectoryName($outputPath)) ('/DOutputBaseName='+[IO.Path]::GetFileNameWithoutExtension($outputPath)) (Join-Path $PSScriptRoot 'PhotoHub.iss')
if($LASTEXITCODE){throw 'Inno Setup compilation failed'}
Get-Item -LiteralPath $outputPath|Select-Object FullName,Length
Get-FileHash -LiteralPath $outputPath
