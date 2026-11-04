# AnkerMake PhotoHub 0.7.0 Public Beta. Resolve the current editor after every host update.
# All releases are test versions; bugs and delayed fixes are possible.
$ErrorActionPreference='Stop'
$nativeHost='__EPC_HOST__'
$profileRoot=Join-Path $env:APPDATA 'eufyMake Studio Profile/cache/offline/web_res'
function WriteLauncherEvent([string]$Stage,[Diagnostics.Stopwatch]$Clock) {
    try {
        $line=[DateTime]::UtcNow.ToString('o')+' pid='+$PID+' '+$Stage+' elapsedMs='+$Clock.ElapsedMilliseconds+"`r`n"
        [IO.File]::AppendAllText((Join-Path $PSScriptRoot 'launcher.log'),$line,(New-Object Text.UTF8Encoding($false)))
    } catch { }
}
function WriteLauncherDiagnostic([string]$Kind,[Exception]$Failure) {
    try {
        $message=$Failure.Message.Replace("`r",' ').Replace("`n",' ')
        $message=[regex]::Replace($message,'(?i)(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])','[redacted]')
        if($message.Length -gt 1600){$message=$message.Substring(0,1600)}
        $line=[DateTime]::UtcNow.ToString('o')+' '+$Kind+' '+$Failure.GetType().FullName+': '+$message+"`r`n"
        [IO.File]::AppendAllText((Join-Path $PSScriptRoot 'launcher.log'),$line,(New-Object Text.UTF8Encoding($false)))
    } catch { }
}
function ReadLauncherHash([string]$Path) {
    # Read exactly the same SHA256 bytes as the installer without loading a
    # PowerShell hashing module. Retry transient file IO only; never retry or
    # ignore a digest mismatch, nor weaken the installed-file ownership check.
    for($hashAttempt=0;$hashAttempt -lt 3;$hashAttempt++){
        $stream=$null;$sha=$null
        try {
            $stream=[IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
            $sha=[Security.Cryptography.SHA256]::Create()
            return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')
        } catch [IO.IOException] {
            if($hashAttempt -ge 2){throw}
            WriteLauncherDiagnostic 'hash-read-retry' $_.Exception
            Start-Sleep -Milliseconds 150
        } finally {
            if($sha){$sha.Dispose()}
            if($stream){$stream.Dispose()}
        }
    }
    throw 'PhotoHub launcher hash could not be read.'
}
function StartOriginal([string]$Reason) {
    Start-Process -FilePath $nativeHost -WorkingDirectory ([IO.Path]::GetDirectoryName($nativeHost)) -WindowStyle Normal -ArgumentList '--no-sw-renderer'
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($Reason+"`r`n已启动原版 AnkerMake；PhotoHub 没有加载，作品不会被修改。",'AnkerMake PhotoHub 公开测试版') | Out-Null
}
$launchClock=[Diagnostics.Stopwatch]::StartNew()
WriteLauncherEvent 'start' $launchClock
try {
    $marker=Join-Path $profileRoot 'current_version.txt'
    if(!(Test-Path -LiteralPath $marker)){throw '未找到当前编辑器版本，请先联网打开一次原版编辑器。'}
    $version=[IO.File]::ReadAllText($marker).Trim()
    if(![IO.Path]::IsPathRooted($version)){$version=Join-Path (Join-Path $profileRoot 'versions') $version}
    $version=[IO.Path]::GetFullPath($version)
    $versions=[IO.Path]::GetFullPath((Join-Path $profileRoot 'versions')).TrimEnd('\','/')+'\'
    if(!$version.StartsWith($versions,[StringComparison]::OrdinalIgnoreCase)){throw '当前编辑器路径异常，已停止加载 PhotoHub。'}
    $editor=Join-Path $version 'web'
    $plugin=Join-Path $editor 'eufymake-photocraft'
    $statePath=Join-Path $editor '.photocraft-plugin-backup/state.json'
    $launcher=Join-Path $plugin 'Start-EufyPhotoCraft.ps1'
    if(!(Test-Path -LiteralPath $statePath) -or !(Test-Path -LiteralPath $launcher)){throw '原版编辑器已更新，当前版本还没有安装兼容的 PhotoHub。请使用对应版本的插件安装包更新。'}
    $state=Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $entry=@($state.files | Where-Object {$_.path.Replace('\','/') -eq 'eufymake-photocraft/Start-EufyPhotoCraft.ps1'})
    if($entry.Count -ne 1 -or [string]$entry[0].installedHash -notmatch '^[0-9a-fA-F]{64}$'){throw 'PhotoHub 启动文件校验记录异常，请重新安装插件。'}
    $actualHash=ReadLauncherHash $launcher
    if(![string]::Equals($actualHash,[string]$entry[0].installedHash,[StringComparison]::OrdinalIgnoreCase)){throw 'PhotoHub 启动文件校验失败，请重新安装插件。'}
    WriteLauncherEvent 'validated' $launchClock
    & $launcher
    WriteLauncherEvent 'child-returned' $launchClock
} catch {
    WriteLauncherDiagnostic 'startup-fallback' $_.Exception
    StartOriginal $_.Exception.Message
}
