param(
    [ValidateSet('Install','Uninstall','Status')][string]$Action = 'Status',
    [Parameter(Mandatory=$true)][string]$HostRoot,
    [string]$EditorRoot,
    [string]$PayloadRoot,
    [string]$Manifest,
    [string]$ShortcutPath,
    [switch]$DryRun
)
if (!$PayloadRoot) { $PayloadRoot=Join-Path $PSScriptRoot '..\payload' }
if (!$Manifest) { $Manifest=Join-Path $PSScriptRoot '..\manifest.json' }
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$HostRoot = [IO.Path]::GetFullPath($HostRoot).TrimEnd('\','/')
$ProcessRoot = $HostRoot
if ($EditorRoot) { $HostRoot = [IO.Path]::GetFullPath($EditorRoot).TrimEnd('\','/') }
$backupRoot = Join-Path $HostRoot '.photocraft-plugin-backup'
$statePath = Join-Path $backupRoot 'state.json'
$pluginRelative = 'resources/web/dist/eufymake-photocraft'
$utf8 = New-Object Text.UTF8Encoding($false,$true)
function SafePath([string]$Root,[string]$Relative) {
    if ([IO.Path]::IsPathRooted($Relative)) { throw "Absolute path forbidden: $Relative" }
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
    $result = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    if (!$result.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes root: $Relative" }
    $cursor=$result
    while($cursor -and $cursor.Length -ge $base.TrimEnd('\','/').Length){
        if(Test-Path -LiteralPath $cursor){
            if(((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw "Reparse points are not allowed in managed target paths: $Relative"}
        }
        $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    return $result
}
function Hash([string]$Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
function ByteHash([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','') } finally { $sha.Dispose() }
}
function WriteBytes([string]$Path,[byte[]]$Bytes) {
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Path)) | Out-Null
    $temporary=$Path+'.epc-write-'+[Guid]::NewGuid().ToString('N')
    try {
        [IO.File]::WriteAllBytes($temporary,$Bytes)
        if ([IO.File]::Exists($Path)) { [IO.File]::Replace($temporary,$Path,[NullString]::Value) }
        else { [IO.File]::Move($temporary,$Path) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}
function CheckStopped {
    $running = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
        if ($_.ProcessName -notmatch '(?i)eufy|anker.?make') { return $false }
        $processPath = $null
        try { $processPath = $_.Path } catch {}
        return (!$processPath -or $processPath.StartsWith($ProcessRoot + '\',[StringComparison]::OrdinalIgnoreCase))
    })
    if ($running.Count) { throw 'Close eufyMake / AnkerMake before installing or uninstalling.' }
    $editors = @(Get-Process -Name 'PhotoCraft' -ErrorAction SilentlyContinue | Where-Object {
        $editorPath = $null
        try { $editorPath = $_.Path } catch {}
        return (!$editorPath -or $editorPath.StartsWith($HostRoot + '\',[StringComparison]::OrdinalIgnoreCase))
    })
    if ($editors.Count) { throw 'Save your work and close this plugin PhotoHub editor before installing or uninstalling. It will not be force-closed.' }
}

# Both editor files and the native bootstrap participate in one verified transaction.
$nativeRoot = Join-Path $ProcessRoot '.epc-native-backup'
$nativeStatePath = Join-Path $nativeRoot 'state.json'
$nativeOriginalPath = Join-Path $nativeRoot 'eufymake studio.exe.original'
$nativeExe = Join-Path $ProcessRoot 'eufymake studio.exe'
$nativeOriginalHash = 'AB65F2F978018460B24D9D6397C91BE073E95822E0497094B5AB02A495D10C97'
$oldState = $null
if (Test-Path -LiteralPath $statePath) { $oldState = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json }
if ($Action -eq 'Status') {
    if ($oldState) { $oldState | ConvertTo-Json -Depth 10 } else { Write-Output 'Not installed.' }
    exit 0
}
CheckStopped
$oldByPath = @{}
$retiredShortcut=$null
$retiredShortcutBytes=$null
if ($oldState) {
    foreach ($item in $oldState.files) {
        $target = SafePath $HostRoot $item.path
        if (!(Test-Path -LiteralPath $target) -or (Hash $target) -ne $item.installedHash) { throw "File changed since installation; refusing overwrite: $($item.path)" }
        if ($item.originalHash) {
            $saved = SafePath $backupRoot $item.path
            if (!(Test-Path -LiteralPath $saved) -or (Hash $saved) -ne $item.originalHash) { throw "Backup verification failed: $($item.path)" }
        }
        $oldByPath[[string]$item.path] = $item
    }
    if (($oldState.PSObject.Properties.Name -contains 'shortcut') -and $oldState.shortcut) {
        $expectedShortcut=if($ShortcutPath){[IO.Path]::GetFullPath($ShortcutPath)}else{Join-Path ([Environment]::GetFolderPath('Desktop')) 'eufyMake + PhotoCraft.lnk'}
        $newBrandShortcut=Join-Path ([Environment]::GetFolderPath('Desktop')) 'eufyMake + PhotoHub.lnk'
        if([IO.Path]::GetFullPath([string]$oldState.shortcut.path) -ne $expectedShortcut -and ($ShortcutPath -or [IO.Path]::GetFullPath([string]$oldState.shortcut.path) -ne $newBrandShortcut)){throw 'Unexpected shortcut location in installation state; specify its original ShortcutPath explicitly.'}
        if ((Test-Path -LiteralPath $oldState.shortcut.path) -and (Hash $oldState.shortcut.path) -ne $oldState.shortcut.hash) { throw 'Desktop shortcut changed; refusing overwrite.' }
    }
}
function OriginalBytes([string]$Relative) {
    if ($oldByPath.ContainsKey($Relative)) {
        $old = $oldByPath[$Relative]
        if ($old.originalHash) { return ,([IO.File]::ReadAllBytes((SafePath $backupRoot $Relative))) }
        return $null
    }
    $target = SafePath $HostRoot $Relative
    if (Test-Path -LiteralPath $target) { return ,([IO.File]::ReadAllBytes($target)) }
    return $null
}
$changes = New-Object Collections.Generic.List[object]
$seen = @{}
function Plan([string]$Relative,[AllowNull()][byte[]]$Bytes) {
    $target = SafePath $HostRoot $Relative
    if ($seen.ContainsKey($target)) { throw "Duplicate patch target: $Relative" }
    $seen[$target]=$true
    $prior=$null
    if (Test-Path -LiteralPath $target) { $prior=[IO.File]::ReadAllBytes($target) }
    $original=OriginalBytes $Relative
    $changes.Add([pscustomobject]@{path=$Relative;target=$target;bytes=$Bytes;prior=$prior;original=$original;originalHash=$(if($null -ne $original){ByteHash $original}else{$null});installedHash=$(if($null -ne $Bytes){ByteHash $Bytes}else{$null})})
}
$nativeChange=$null
$nativePriorState=$null
if (Test-Path -LiteralPath $nativeStatePath) { $nativePriorState=[IO.File]::ReadAllBytes($nativeStatePath) }
function PlanNative([bool]$Install,[string]$Token) {
    $nativePrior=[IO.File]::ReadAllBytes($nativeExe)
    $nativeOriginal=$nativePrior
    if ($nativePriorState) {
        $existing=$utf8.GetString($nativePriorState) | ConvertFrom-Json
        if ((ByteHash $nativePrior) -ne $existing.installedSha256) { throw 'Native application changed since extension installation; refusing overwrite.' }
        $nativeOriginal=[IO.File]::ReadAllBytes($nativeOriginalPath)
    }
    if ((ByteHash $nativeOriginal) -ne $nativeOriginalHash) { throw 'Unsupported native eufyMake version. No files changed.' }
    $nativeBytes=$nativeOriginal.Clone()
    if ($Install) {
        $template=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'native-bootstrap.js'))
        if ([regex]::Matches($template,'__EPC_TOKEN__').Count -ne 1) { throw 'Invalid native bootstrap template.' }
        $code=$template.Replace('__EPC_TOKEN__',$Token).TrimEnd("`r","`n")
        if ($code.Length -gt 1549 -or $code -match '[^\x00-\x7f]') { throw 'Native bootstrap does not fit reserved range.' }
        $bytes=[Text.Encoding]::ASCII.GetBytes($code.PadRight(1549,' '))
        if ($nativeOriginal[29693072+1549] -ne 0) { throw 'Native bootstrap terminator mismatch.' }
        [Array]::Copy($bytes,0,$nativeBytes,29693072,1549)
    }
    return [pscustomobject]@{target=$nativeExe;prior=$nativePrior;original=$nativeOriginal;bytes=$nativeBytes;installedSha256=(ByteHash $nativeBytes)}
}
$requestedShortcut=$ShortcutPath
$shortcutPath=$null
$shortcutPrior=$null
$hostExecutable=@()
if ($Action -eq 'Uninstall') {
    if (!$oldState) { throw 'No installation state found; no files changed.' }
    foreach ($item in $oldState.files) { Plan $item.path (OriginalBytes $item.path) }
    if (($oldState.PSObject.Properties.Name -contains 'native') -and $oldState.native) {
        if (!$nativePriorState) { throw 'Native installation backup metadata missing.' }
        $nativeChange=PlanNative $false ''
    }
    if (($oldState.PSObject.Properties.Name -contains 'shortcut') -and $oldState.shortcut) { $shortcutPath=[string]$oldState.shortcut.path }
} else {
    if (!(Test-Path -LiteralPath (Join-Path $PayloadRoot 'adapter.js'))) { throw 'Payload adapter.js is missing.' }
    $manifestData=Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifestData.PSObject.Properties.Name -contains 'nativeInkSha256') {
        $ripPath=Join-Path $ProcessRoot 'ColorEngineAPI.dll'
        if (!(Test-Path -LiteralPath $ripPath) -or (Hash $ripPath) -ne $manifestData.nativeInkSha256) {
            throw 'Unsupported ColorEngineAPI.dll for physical CMYK control. No files changed. This package requires eufyMake Studio 5.0.4.'
        }
    }
    $pluginVersion='0.1.0'
    if ($manifestData.PSObject.Properties.Name -contains 'version') { $pluginVersion=[string]$manifestData.version }
    if ($oldState) {
        $oldVersion='0.1.0'
        if ($oldState.PSObject.Properties.Name -contains 'pluginVersion') { $oldVersion=[string]$oldState.pluginVersion }
        if ([version]$pluginVersion -lt [version]$oldVersion) { throw 'Installed extension is newer; downgrades are refused.' }
        if ([version]$pluginVersion -eq [version]$oldVersion) { Write-Output "Validated repair/reinstall of version $pluginVersion; all installed hashes match." }
        else { Write-Output "Validated upgrade from $oldVersion to $pluginVersion." }
    } elseif (Test-Path -LiteralPath $backupRoot) { throw 'Existing backup/install state found without valid metadata; investigate before reinstalling.' }
    if ($manifestData.PSObject.Properties.Name -contains 'pluginPath') { $pluginRelative=[string]$manifestData.pluginPath }
    foreach ($item in $manifestData.files) {
        $bytes=OriginalBytes $item.path
        if ($null -eq $bytes -or (ByteHash $bytes) -ne $item.sha256) { throw "Unsupported/changed host file: $($item.path). No files changed." }
        $text=$utf8.GetString($bytes)
        foreach ($patch in $item.patches) {
            if (!$patch.old -or $patch.count -lt 1) { throw 'Invalid patch specification.' }
            $count=[regex]::Matches($text,[regex]::Escape($patch.old)).Count
            if ($count -ne $patch.count) { throw "Patch count mismatch in $($item.path): expected $($patch.count), got $count" }
            $text=$text.Replace([string]$patch.old,[string]$patch.new)
        }
        Plan $item.path ($utf8.GetBytes($text))
    }
    $indexRelative='resources/web/dist/index.html'
    if ($manifestData.PSObject.Properties.Name -contains 'indexPath') { $indexRelative=[string]$manifestData.indexPath }
    $index=$utf8.GetString((OriginalBytes $indexRelative))
    $entryScript='main.local.js'
    if ($manifestData.PSObject.Properties.Name -contains 'entryScript') { $entryScript=[string]$manifestData.entryScript }
    $pattern='<script\b[^>]*\bsrc\s*=\s*["''][^"'']*\b'+[regex]::Escape($entryScript)+'(?:\?[^"'']*)?["''][^>]*>\s*</script\s*>'
    $matches=[regex]::Matches($index,$pattern,[Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($matches.Count -ne 1 -or $index.Contains('eufymake-photocraft/adapter.js')) { throw 'Unsupported index.html or plugin already injected.' }
    $injection='<script src="./eufymake-photocraft/config.js"></script><script src="./eufymake-photocraft/adapter.js"></script>'
    $index=$index.Insert($matches[0].Index+$matches[0].Length,"`r`n"+$injection)
    Plan $indexRelative ($utf8.GetBytes($index))
    $payloadBase=[IO.Path]::GetFullPath($PayloadRoot).TrimEnd('\','/')
    foreach ($file in Get-ChildItem -LiteralPath $payloadBase -File -Recurse) {
        if (($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Payload links are forbidden.' }
        $relative=$file.FullName.Substring($payloadBase.Length+1)
        $destination="$pluginRelative/$relative"
        if ((Test-Path -LiteralPath (SafePath $HostRoot $destination)) -and !$oldByPath.ContainsKey($destination)) { throw "Payload destination already exists and is not owned: $destination" }
        Plan $destination ([IO.File]::ReadAllBytes($file.FullName))
    }
    $tokenBytes=New-Object byte[] 32
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($tokenBytes) } finally { $rng.Dispose() }
    $token=[BitConverter]::ToString($tokenBytes).Replace('-','').ToLowerInvariant()
    $configuration=@{token=$token;port=19847;hostExecutable=(Join-Path $ProcessRoot 'eufymake studio.exe')}|ConvertTo-Json -Compress
    Plan "$pluginRelative/config.json" ($utf8.GetBytes($configuration))
    Plan "$pluginRelative/config.js" ($utf8.GetBytes("window.__EPC_CONFIG=$configuration;"))
    if (($manifestData.PSObject.Properties.Name -contains 'nativeInjection') -and $manifestData.nativeInjection) { throw 'Native disk injection is unsupported. Use the signed original application with loopback CDP integration.' }
    $useCdp=($manifestData.PSObject.Properties.Name -contains 'onlineIntegration') -and $manifestData.onlineIntegration -eq 'cdp'
    if ($useCdp -and (Hash $nativeExe) -ne $nativeOriginalHash) { throw 'Unsupported native eufyMake version or modified executable. No files changed.' }
    $hostExecutable=@(Get-ChildItem -LiteralPath $ProcessRoot -File -Filter 'eufymake studio.exe')
    if ($hostExecutable.Count -eq 1) {
        $escapedHost=$hostExecutable[0].FullName.Replace("'","''")
        $launcher=@'
$ErrorActionPreference='Stop'
trap { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($_.Exception.Message,'eufyMake extension'); exit 1 }
Start-Process -FilePath (Join-Path $PSScriptRoot 'bridge.exe') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
$bridgeConfig=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
$ready=$false
for($attempt=0;$attempt -lt 40;$attempt++){
    try{Invoke-RestMethod -Uri ('http://127.0.0.1:'+$bridgeConfig.port+'/health') -Headers @{'X-EPC-Token'=$bridgeConfig.token} -TimeoutSec 1 | Out-Null;$ready=$true;break}catch{Start-Sleep -Milliseconds 500}
}
if(!$ready){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show('PhotoHub local component did not start. Please run the extension installer again.');exit 1}
'@
        if($useCdp){
            $cdpPrelude=@'
$ErrorActionPreference='Stop'
trap { Add-Type -AssemblyName System.Windows.Forms; [Windows.Forms.MessageBox]::Show($_.Exception.Message,'eufyMake extension'); exit 1 }
function GetDebugListeners {
    return @([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object {$_.Port -eq 19849})
}
$listeners=GetDebugListeners
$alreadyRunning=$false
$ownedHost=@(Get-Process -Name 'eufymake studio' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '__EPC_HOST__' })
if($listeners.Count){
 if(@($listeners|Where-Object{![Net.IPAddress]::IsLoopback($_.Address)}).Count -or !$ownedHost.Count){throw 'PhotoHub 本地连接端口被其他程序占用。'}
 try{$targets=Invoke-RestMethod -Uri 'http://127.0.0.1:19849/json/list' -TimeoutSec 2;if($null -eq $targets){throw 'No targets'}}catch{throw 'PhotoHub 本地连接尚未就绪，请稍后重试。'}
 $alreadyRunning=$true
}elseif($ownedHost.Count){throw 'eufyMake 已通过不带 PhotoHub 的入口打开。请先保存设计并退出，再点击此图标；不会自动关闭或丢弃你的设计。'}
'@
            $cdpPrelude=$cdpPrelude.Replace('__EPC_HOST__',$escapedHost)
            $launcher=$cdpPrelude+"`r`n"+$launcher+"`r`nif(`$alreadyRunning){exit 0}`r`n"
            $launcher+="`r`n"+"`$hostProcess=Start-Process -FilePath '$escapedHost' -WorkingDirectory '$($ProcessRoot.Replace("'","''"))' -ArgumentList '--remote-debugging-port=19849','--remote-debugging-address=127.0.0.1' -PassThru"+"`r`n"+@'
for($attempt=0;$attempt -lt 40;$attempt++){
    $listeners=GetDebugListeners
    if($listeners.Count){break}
    Start-Sleep -Milliseconds 500
}
if(@($listeners|Where-Object{![Net.IPAddress]::IsLoopback($_.Address)}).Count){
    $hostProcess.CloseMainWindow()|Out-Null
    throw 'The host debugging endpoint was not restricted to loopback; extension launch stopped.'
}
if(!$listeners.Count){throw 'The eufyMake editor connection did not start. Save and close eufyMake, then retry the extension shortcut.'}
'@
        }else{$launcher+="`r`nStart-Process -FilePath '$escapedHost'"}
        Plan "$pluginRelative/Start-EufyPhotoCraft.ps1" ([byte[]](0xEF,0xBB,0xBF)+$utf8.GetBytes($launcher))
        if ($requestedShortcut) { $shortcutPath=[IO.Path]::GetFullPath($requestedShortcut) }
        elseif ($oldState -and ($oldState.PSObject.Properties.Name -contains 'shortcut') -and $oldState.shortcut) { $shortcutPath=[string]$oldState.shortcut.path }
        else { $shortcutPath=Join-Path ([Environment]::GetFolderPath('Desktop')) 'eufyMake + PhotoHub.lnk' }
        if([IO.Path]::GetFileName($shortcutPath) -eq 'eufyMake + PhotoCraft.lnk'){
            $retiredShortcut=$shortcutPath
            if(Test-Path -LiteralPath $retiredShortcut){$retiredShortcutBytes=[IO.File]::ReadAllBytes($retiredShortcut)}
            $shortcutPath=Join-Path ([IO.Path]::GetDirectoryName($shortcutPath)) 'eufyMake + PhotoHub.lnk'
        }
        if ((Test-Path -LiteralPath $shortcutPath) -and !($oldState -and ($oldState.PSObject.Properties.Name -contains 'shortcut') -and $oldState.shortcut -and $oldState.shortcut.path -eq $shortcutPath)) { throw 'Desktop plugin shortcut already exists; refusing overwrite.' }
    }
    # Retire only old owned payload files, retaining user-created documents and settings.
    foreach ($old in $oldByPath.Values) {
        if (!$seen.ContainsKey((SafePath $HostRoot $old.path))) { Plan $old.path (OriginalBytes $old.path) }
    }
}

$hostLinkChanges=@()
$hostLinkRecords=@()
if($oldState -and ($oldState.PSObject.Properties.Name -contains 'hostShortcuts')){
 foreach($link in $oldState.hostShortcuts){
  if(!(Test-Path -LiteralPath $link.path)){continue}
  if((Hash $link.path) -ne $link.installedHash){Write-Warning "保留用户修改过的快捷方式: $($link.path)";continue}
  $original=[Convert]::FromBase64String($link.original)
  $hostLinkChanges+=@{path=$link.path;prior=[IO.File]::ReadAllBytes($link.path);original=$original}
 }
}
if($Action -eq 'Install' -and $useCdp){
 $shell=New-Object -ComObject WScript.Shell
 $roots=@([IO.Path]::GetDirectoryName($shortcutPath),[Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'),[Environment]::GetFolderPath('StartMenu'),[Environment]::GetFolderPath('CommonStartMenu'),(Join-Path $env:APPDATA 'Microsoft/Internet Explorer/Quick Launch/User Pinned/TaskBar'))|Select-Object -Unique
 foreach($folder in $roots){
  if(!$folder -or !(Test-Path -LiteralPath $folder)){continue}
  foreach($item in Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue){
   if($item.FullName -eq $shortcutPath -or @($hostLinkChanges|Where-Object path -eq $item.FullName).Count){continue}
   $link=$shell.CreateShortcut($item.FullName)
   if($link.TargetPath -ne $nativeExe -or $link.Arguments){continue}
   $bytes=[IO.File]::ReadAllBytes($item.FullName)
   $hostLinkChanges+=@{path=$item.FullName;prior=$bytes;original=$bytes}
  }
 }
}

if ($shortcutPath -and (Test-Path -LiteralPath $shortcutPath)) { $shortcutPrior=[IO.File]::ReadAllBytes($shortcutPath) }
Write-Output "Validated $Action plan: $($changes.Count) editor files; native bootstrap: $($null -ne $nativeChange). User documents preserved."
foreach ($change in $changes) { Write-Output $change.path }
foreach($link in $hostLinkChanges){Write-Output ("Host shortcut: "+$link.path)}
if ($DryRun) { exit 0 }
# Stop only this extension's owned bridge after every plan and backup check succeeds.
$ownedBridge=@(Get-Process -Name 'bridge' -ErrorAction SilentlyContinue | Where-Object {
    $candidate=$null;try{$candidate=$_.Path}catch{}
    $candidate -and $candidate.StartsWith($HostRoot+'\',[StringComparison]::OrdinalIgnoreCase)
})
foreach($process in $ownedBridge){
    if($process.HasExited){continue}
    try{Stop-Process -Id $process.Id -ErrorAction Stop}catch{if(!$process.HasExited){throw}}
    if(!$process.WaitForExit(5000)){throw 'The extension service did not stop; no files changed.'}
}
$priorStateBytes=$null
if(Test-Path -LiteralPath $statePath){$priorStateBytes=[IO.File]::ReadAllBytes($statePath)}
try {
    if ($Action -eq 'Install') {
        [IO.Directory]::CreateDirectory($backupRoot)|Out-Null
        foreach($change in $changes){if($null -ne $change.original){WriteBytes (SafePath $backupRoot $change.path) $change.original}}
        if($nativeChange){
            WriteBytes $nativeOriginalPath $nativeChange.original
            $nativeState=@{originalSha256=$nativeOriginalHash;installedSha256=$nativeChange.installedSha256;offset=29693072;length=1549}
            WriteBytes $nativeStatePath ($utf8.GetBytes(($nativeState|ConvertTo-Json)))
        }
    }
    foreach($change in $changes){
        if($null -eq $change.bytes){if(Test-Path -LiteralPath $change.target){Remove-Item -LiteralPath $change.target}}
        else{WriteBytes $change.target $change.bytes}
    }
    if($nativeChange){WriteBytes $nativeExe $nativeChange.bytes;if((Hash $nativeExe) -ne $nativeChange.installedSha256){throw 'Native write verification failed.'}}
    foreach($change in $changes){if($null -ne $change.bytes -and (Hash $change.target) -ne $change.installedHash){throw "Write verification failed: $($change.path)"}}
    if($Action -eq 'Install'){
        $state=[ordered]@{version=2;pluginVersion=$pluginVersion;installedAt=[DateTime]::UtcNow.ToString('o');files=@($changes|Where-Object{$null -ne $_.bytes}|Select-Object path,originalHash,installedHash)}
        if($useCdp){$state.onlineIntegration='cdp'}
        if($nativeChange){$state.native=@{originalSha256=$nativeOriginalHash;installedSha256=$nativeChange.installedSha256}}
        if($shortcutPath){
            $shell=New-Object -ComObject WScript.Shell;$shortcut=$shell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
            $shortcut.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(SafePath $HostRoot "$pluginRelative/Start-EufyPhotoCraft.ps1")+'"'
            $shortcut.WorkingDirectory=SafePath $HostRoot $pluginRelative;$shortcut.IconLocation=$hostExecutable[0].FullName;$shortcut.Save()
            $state.shortcut=@{path=$shortcutPath;hash=(Hash $shortcutPath)}
        }
        foreach($entry in $hostLinkChanges){
            $link=$shell.CreateShortcut($entry.path)
            $link.TargetPath=$shortcut.TargetPath;$link.Arguments=$shortcut.Arguments
            $link.WorkingDirectory=$shortcut.WorkingDirectory;$link.IconLocation=$hostExecutable[0].FullName;$link.Save()
            $hostLinkRecords+=@{path=$entry.path;original=[Convert]::ToBase64String($entry.original);installedHash=(Hash $entry.path)}
        }
        if($hostLinkRecords.Count){$state.hostShortcuts=$hostLinkRecords}
        WriteBytes $statePath ($utf8.GetBytes(($state|ConvertTo-Json -Depth 10)))
        if($retiredShortcut -and (Test-Path -LiteralPath $retiredShortcut)){Remove-Item -LiteralPath $retiredShortcut}
    }else{
        foreach($entry in $hostLinkChanges){WriteBytes $entry.path $entry.original}
        if($shortcutPath -and (Test-Path -LiteralPath $shortcutPath)){Remove-Item -LiteralPath $shortcutPath}
        if($nativeChange -and (Test-Path -LiteralPath $nativeStatePath)){Remove-Item -LiteralPath $nativeStatePath}
        $archive=Join-Path $HostRoot ('.photocraft-plugin-backup-uninstalled-'+[Guid]::NewGuid().ToString('N'))
        # Both paths are explicit children of the verified editor root; retain backups.
        Move-Item -LiteralPath $backupRoot -Destination $archive
    }
}catch{
    $failure=$_
    foreach($entry in $hostLinkChanges){WriteBytes $entry.path $entry.prior}
    if($retiredShortcutBytes){WriteBytes $retiredShortcut $retiredShortcutBytes}
    foreach($change in $changes){
        if($null -ne $change.prior){
            if(!(Test-Path -LiteralPath $change.target) -or (Hash $change.target) -ne (ByteHash $change.prior)){WriteBytes $change.target $change.prior}
        }elseif(Test-Path -LiteralPath $change.target){Remove-Item -LiteralPath $change.target}
    }
    if($nativeChange -and (Hash $nativeExe) -ne (ByteHash $nativeChange.prior)){WriteBytes $nativeExe $nativeChange.prior}
    if($nativePriorState){WriteBytes $nativeStatePath $nativePriorState}elseif(Test-Path -LiteralPath $nativeStatePath){Remove-Item -LiteralPath $nativeStatePath}
    if($priorStateBytes){WriteBytes $statePath $priorStateBytes}elseif(Test-Path -LiteralPath $statePath){Remove-Item -LiteralPath $statePath}
    if($shortcutPrior){WriteBytes $shortcutPath $shortcutPrior}elseif($shortcutPath -and (Test-Path -LiteralPath $shortcutPath)){Remove-Item -LiteralPath $shortcutPath}
    if(!$priorStateBytes -and (Test-Path -LiteralPath $backupRoot)) {
        $failedArchive=Join-Path $HostRoot ('.photocraft-plugin-backup-failed-'+[Guid]::NewGuid().ToString('N'))
        Move-Item -LiteralPath $backupRoot -Destination $failedArchive
    }
    throw "Transaction rolled back: $failure. Backups retained for inspection."
}
Write-Output "$Action completed. Native and editor files verified."
