param([Parameter(Mandatory=$true)][string]$Package,[Parameter(Mandatory=$true)][string]$PayloadRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
$assembly=[Reflection.Assembly]::LoadFile([IO.Path]::GetFullPath($Package))
$resource=$assembly.GetManifestResourceStream('bundle.zip')
if(!$resource){throw 'Setup resource bundle missing'}
$memory=New-Object IO.MemoryStream
$resource.CopyTo($memory);$resource.Dispose();$memory.Position=0
$zip=New-Object IO.Compression.ZipArchive($memory,[IO.Compression.ZipArchiveMode]::Read)
try{
 $reader=New-Object IO.StreamReader($zip.GetEntry('manifest.json').Open())
 try{$manifest=$reader.ReadToEnd()|ConvertFrom-Json}finally{$reader.Dispose()}
 if($manifest.version -ne '0.6.1'){throw 'Wrong setup version'}
 $base=[IO.Path]::GetFullPath($PayloadRoot).TrimEnd('\','/')+'\';$checked=0
 foreach($file in Get-ChildItem -LiteralPath $PayloadRoot -Recurse -File){
  $relative=$file.FullName.Substring($base.Length).Replace('\','/')
  $entry=$zip.Entries|Where-Object {$_.FullName.Replace('\','/') -eq ('payload/'+$relative)}|Select-Object -First 1;if(!$entry){throw "Missing packaged payload: $relative"}
  $sha=[Security.Cryptography.SHA256]::Create();$stream=$entry.Open()
  try{$actual=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}finally{$stream.Dispose();$sha.Dispose()}
  if($actual -ne (Get-FileHash -LiteralPath $file.FullName).Hash){throw "Packaged payload mismatch: $relative"};$checked++
 }
 $entry=$zip.Entries|Where-Object {$_.FullName.Replace('\','/') -eq 'payload/native/PhotoHubInk.dll'}|Select-Object -First 1;$stream=$entry.Open();$bytes=New-Object IO.MemoryStream;$stream.CopyTo($bytes);$stream.Dispose()
 if([Text.Encoding]::ASCII.GetString($bytes.ToArray()).Contains('PhotoHubTestPolicy')){throw 'Test-only native entry point in release'}
 $bytes.Dispose()
 Write-Output "PASS single EXE resource bundle: version $($manifest.version), $checked payload files byte-exact, production native DLL, complete payload"
}finally{$zip.Dispose();$memory.Dispose()}
