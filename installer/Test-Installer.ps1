$ErrorActionPreference = 'Stop'
$fixture = Join-Path $PSScriptRoot ('test-' + [Guid]::NewGuid().ToString('N'))
$dist = Join-Path $fixture 'host/resources/web/dist'
$payload = Join-Path $fixture 'payload'
$manifest = Join-Path $fixture 'manifest.json'
$script = Join-Path $PSScriptRoot 'Manage-Plugin.ps1'
[IO.Directory]::CreateDirectory($dist) | Out-Null
[IO.Directory]::CreateDirectory($payload) | Out-Null
$utf8 = New-Object Text.UTF8Encoding($false)
$index = Join-Path $dist 'index.html'
$main = Join-Path $dist 'main.local.js'
[IO.File]::WriteAllText($index,'<html><script src="./main.local.js"></script></html>',$utf8)
[IO.File]::WriteAllText($main,'const limit=300000;',$utf8)
[IO.File]::WriteAllText((Join-Path $payload 'adapter.js'),'console.log("plugin");',$utf8)
$indexHash=(Get-FileHash $index).Hash
$mainHash=(Get-FileHash $main).Hash
$spec=@{files=@(@{path='resources/web/dist/main.local.js';sha256=$mainHash;patches=@(@{old='limit=300000';new='limit=Infinity';count=1})})}
$spec | ConvertTo-Json -Depth 8 | Set-Content $manifest -Encoding UTF8
function Run([string]$Action,[bool]$Dry=$false,[bool]$Fail=$false) {
    $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$script,'-Action',$Action,'-HostRoot',(Join-Path $fixture 'host'),'-PayloadRoot',$payload,'-Manifest',$manifest)
    if($Dry){$arguments+='-DryRun'}
    $oldPreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    & powershell.exe @arguments 2>&1 | Out-String | Write-Host
    $ErrorActionPreference=$oldPreference
    if (($LASTEXITCODE -eq 0) -eq $Fail) {throw "Unexpected result: $Action dry=$Dry expectedFail=$Fail exit=$LASTEXITCODE"}
}
Run Install $true
if((Get-FileHash $index).Hash -ne $indexHash -or (Test-Path (Join-Path $fixture 'host/.photocraft-plugin-backup'))){throw 'Dry run mutated host'}
Run Install
if(!(Get-Content $index -Raw).Contains('adapter.js')){throw 'Injection missing'}
if(!(Get-Content $main -Raw).Contains('Infinity')){throw 'Patch missing'}
Run Install $true
Run Install
$installed=[IO.File]::ReadAllBytes($main)
[IO.File]::AppendAllText($main,'// drift')
Run Uninstall $false $true
[IO.File]::WriteAllBytes($main,$installed)
Run Uninstall $true
Run Uninstall
if((Get-FileHash $index).Hash -ne $indexHash -or (Get-FileHash $main).Hash -ne $mainHash){throw 'Original bytes not restored'}
if(Test-Path (Join-Path $dist 'eufymake-photocraft/adapter.js')){throw 'Payload remains'}
$spec.files[0].sha256='0'*64
$spec | ConvertTo-Json -Depth 8 | Set-Content $manifest -Encoding UTF8
Run Install $false $true
$escape=Join-Path $fixture 'escape.js'
[IO.File]::WriteAllText($escape,'const limit=300000;',$utf8)
$escapeHash=(Get-FileHash $escape).Hash
$spec.files[0].path='../escape.js';$spec.files[0].sha256=$escapeHash
$spec|ConvertTo-Json -Depth 8|Set-Content $manifest -Encoding UTF8
Run Install $true $true
if((Get-FileHash $escape).Hash -ne $escapeHash){throw 'Path escape changed an external file'}
Write-Host "PASS: dry run, install, same-version repair, drift refusal, uninstall, SHA and path guard. Fixture retained: $fixture"
