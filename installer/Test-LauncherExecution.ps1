# AnkerMake PhotoHub 0.7.0 Public Beta. Execute caller -> child with all host,
# bridge, HTTP and port effects mocked. Never starts AnkerMake or a printer.
param([Parameter(Mandatory=$true)][string]$ChildLauncher,[string]$FixtureParent=(Join-Path $env:TEMP 'AnkerMakePhotoHub-tests'))
$ErrorActionPreference='Stop'
$fixture=Join-Path $FixtureParent ('launcher-execution-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($fixture)|Out-Null
$utf8=New-Object Text.UTF8Encoding($true)
$childSource=[IO.File]::ReadAllText($ChildLauncher)
$tokens=$null;$parseErrors=$null
$childAst=[Management.Automation.Language.Parser]::ParseInput($childSource,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw ($parseErrors|Out-String)}
$edits=@($childAst.FindAll({param($n) $n -is [Management.Automation.Language.TrapStatementAst]},$true)|ForEach-Object { @{start=$_.Extent.StartOffset;length=$_.Extent.EndOffset-$_.Extent.StartOffset;new='trap { throw $_ }'} })
$portFunction=$childAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'GetDebugListeners'},$true)
if(!$portFunction){throw 'Expected generated child launcher port function'}
$edits+=@{start=$portFunction.Extent.StartOffset;length=$portFunction.Extent.EndOffset-$portFunction.Extent.StartOffset;new='function GetDebugListeners { if($global:mockHostStarted -or $mode -eq "existing"){(New-Object Net.IPEndPoint([Net.IPAddress]::Loopback,19849))} }'}
$showFunction=$childAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'ShowHostWindow'},$true)
if(!$showFunction){throw 'Expected generated launcher window restoration helper'}
$edits+=@{start=$showFunction.Extent.StartOffset;length=$showFunction.Extent.EndOffset-$showFunction.Extent.StartOffset;new='function ShowHostWindow($Process) { $global:mockRestores++ }'}
$hostPath=[regex]::Match($childSource,"Path -eq '([^']+)'").Groups[1].Value
if(!$hostPath){throw 'Host path missing from child launcher'}
# Windows PowerShell 5 does not consistently expose Hashtable keys as sort
# properties. Sort explicit numeric offsets before replacing the source ranges.
foreach($edit in $edits|Sort-Object {[int]$_['start']} -Descending){$childSource=$childSource.Remove($edit.start,$edit.length).Insert($edit.start,$edit.new)}
$stableSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Start-PhotoHub.ps1')).Replace('__EPC_HOST__',(Join-Path $fixture 'host/eufymake studio.exe').Replace("'","''"))
$stableAst=[Management.Automation.Language.Parser]::ParseInput($stableSource,[ref]$tokens,[ref]$parseErrors)
$fallback=$stableAst.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'StartOriginal'},$true)
$stableSource=$stableSource.Remove($fallback.Extent.StartOffset,$fallback.Extent.EndOffset-$fallback.Extent.StartOffset).Insert($fallback.Extent.StartOffset,'function StartOriginal([string]$Reason) { $global:mockFallback=$true; throw "MOCK_FALLBACK" }')
foreach($mode in @('good','existing','wrong-hash','io-retry','child-error')){
    $case=Join-Path $fixture $mode
    $profile=Join-Path $case 'Roaming/eufyMake Studio Profile/cache/offline/web_res'
    $version=Join-Path $profile 'versions/1.23.02'
    $plugin=Join-Path $version 'web/eufymake-photocraft'
    $support=Join-Path $case 'Support'
    [IO.Directory]::CreateDirectory($plugin)|Out-Null
    [IO.Directory]::CreateDirectory($support)|Out-Null
    [IO.Directory]::CreateDirectory((Join-Path $version 'web/.photocraft-plugin-backup'))|Out-Null
    [IO.File]::WriteAllText((Join-Path $profile 'current_version.txt'),$version,$utf8)
    $child=Join-Path $plugin 'Start-EufyPhotoCraft.ps1'
    $caseChild=$childSource
    if($mode -eq 'child-error'){$caseChild="throw 'MOCK_CHILD_SECRET_"+('a'*64)+"'`r`n"+$caseChild}
    [IO.File]::WriteAllText($child,$caseChild,$utf8)
    [IO.File]::WriteAllText((Join-Path $plugin 'config.json'),('{"port":19847,"token":"'+('0'*64)+'"}'),$utf8)
    $hash=(Get-FileHash -LiteralPath $child -Algorithm SHA256).Hash
    if($mode -eq 'wrong-hash'){$hash='0'*64}
    $state=@{files=@(@{path='eufymake-photocraft/Start-EufyPhotoCraft.ps1';installedHash=$hash})}|ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText((Join-Path $version 'web/.photocraft-plugin-backup/state.json'),$state,$utf8)
    [IO.File]::WriteAllText((Join-Path $support 'Start-PhotoHub.ps1'),$stableSource,$utf8)
    $driver=@'
$ErrorActionPreference='Stop'
$mode='__MODE__'
$env:APPDATA=Join-Path $PSScriptRoot 'Roaming'
$global:mockHostStarted=$false;$global:mockFallback=$false;$global:mockRestores=0
$global:mockLaunches=New-Object Collections.Generic.List[object]
function Get-Process { param($Name,$ErrorAction) if($mode -eq 'existing'){[pscustomobject]@{Path='__HOST_PATH__'}}else{@()} }
function Start-Process { param($FilePath,$WorkingDirectory,$WindowStyle,$ArgumentList,[switch]$PassThru)
 $global:mockLaunches.Add([pscustomobject]@{FilePath=$FilePath;WorkingDirectory=$WorkingDirectory;Arguments=$ArgumentList;WindowStyle=$WindowStyle})
 if($FilePath -like '*eufymake studio.exe'){$global:mockHostStarted=$true;$p=[pscustomobject]@{Id=1234;HasExited=$false;MainWindowHandle=[IntPtr]1};$p|Add-Member ScriptMethod Refresh {};return $p}
}
function Invoke-RestMethod { param($Uri,$Headers,$TimeoutSec) @{ok=$true} }
$plugin=Join-Path $PSScriptRoot 'Roaming/eufyMake Studio Profile/cache/offline/web_res/versions/1.23.02/web/eufymake-photocraft'
if($mode -eq 'io-retry'){
 Add-Type -TypeDefinition 'using System; using System.IO; using System.Threading; public static class FixtureLock { public static void Hold(string file,string signal) { var t=new Thread(()=>{using(var f=File.Open(file,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){File.WriteAllText(signal,"ready");Thread.Sleep(230);}});t.IsBackground=true;t.Start(); } }'
 $signal=Join-Path $PSScriptRoot 'lock-ready'
 [FixtureLock]::Hold((Join-Path $plugin 'Start-EufyPhotoCraft.ps1'),$signal)
 for($i=0;$i -lt 200 -and !(Test-Path -LiteralPath $signal);$i++){Start-Sleep -Milliseconds 10}
 if(!(Test-Path -LiteralPath $signal)){throw 'Fixture file lock did not start'}
}
$failed=$false
try { & (Join-Path $PSScriptRoot 'Support/Start-PhotoHub.ps1') } catch {$failed=$true}
if($mode -in @('wrong-hash','child-error')){
 if(!$failed -or !$global:mockFallback -or $global:mockLaunches.Count -ne 0){throw 'Invalid launcher was not refused before host/bridge calls'}
 $log=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Support/launcher.log'))
 if(!$log.Contains('startup-fallback')){throw 'Fallback diagnostic missing'}
 if($mode -eq 'child-error' -and ($log.Contains(('a'*64)) -or !$log.Contains('[redacted]'))){throw 'Diagnostic secret redaction failed'}
}elseif($mode -eq 'existing'){
 if($failed -or $global:mockFallback -or $global:mockLaunches.Count -ne 1 -or $global:mockRestores -ne 1){throw 'Existing window was not restored without launching a second host'}
}else{
 if($failed -or $global:mockFallback -or $global:mockLaunches.Count -ne 2){throw 'Caller -> child did not reach mocked bridge and host'}
 if($global:mockLaunches[0].FilePath -ne (Join-Path $plugin 'bridge.exe') -or $global:mockLaunches[0].WorkingDirectory -ne $plugin){throw 'Child PSScriptRoot leaked from caller scope'}
 if('--remote-debugging-port=19849' -notin $global:mockLaunches[1].Arguments -or '--no-sw-renderer' -notin $global:mockLaunches[1].Arguments){throw 'Host compatibility/debug flags missing'}
 if($global:mockLaunches[1].WindowStyle -ne 'Normal' -or $global:mockRestores -ne 1){throw 'Cold host window was not explicitly shown'}
 if($mode -eq 'io-retry' -and !([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Support/launcher.log'))).Contains('hash-read-retry')){throw 'Transient IO retry was not exercised'}
}
Write-Output ('PASS launcher execution '+$mode)
'@
    [IO.File]::WriteAllText((Join-Path $case 'driver.ps1'),$driver.Replace('__MODE__',$mode).Replace('__HOST_PATH__',$hostPath.Replace("'","''")),$utf8)
    & (Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe') -NoProfile -ExecutionPolicy Bypass -File (Join-Path $case 'driver.ps1')
    if($LASTEXITCODE){throw "Windows PowerShell launcher regression failed: $mode"}
}
Write-Output "PASS: Windows PowerShell caller -> child execution, strict SHA mismatch rejection, transient IO retry, redacted exception logging. No real host or bridge was launched. Fixture: $fixture"
