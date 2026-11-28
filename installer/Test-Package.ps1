param([Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$PayloadRoot)
$ErrorActionPreference='Stop'
$file=Get-Item -LiteralPath $Package
if($file.VersionInfo.FileVersion.Trim() -ne '0.8.7.2'){throw 'Unexpected setup version'}
$bytes=[IO.File]::ReadAllBytes($file.FullName)
if($bytes[0] -ne 77 -or $bytes[1] -ne 90 -or ![Text.Encoding]::ASCII.GetString($bytes).Contains('Inno Setup Setup Data')){throw 'Not a complete Inno Setup executable'}
$spec=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
foreach($entry in @(@('depth','depth-anything-v2-small.onnx',$spec.bundledAiDepth.modelSha256),@('strokes','teed.onnx',$spec.bundledAiStrokes.modelSha256))){
 $path=Join-Path $PayloadRoot ('models/'+$entry[0]+'/'+$entry[1])
 if((Get-FileHash -LiteralPath $path).Hash.ToLower() -ne $entry[2]){throw 'Source AI model hash mismatch'}
}
Write-Output 'PASS single Inno Setup EXE: version 0.8.7, embedded setup data and verified model source hashes. Run the wizard test for installed payload verification.'
