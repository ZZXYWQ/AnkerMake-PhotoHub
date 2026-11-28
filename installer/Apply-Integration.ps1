param(
 [ValidateSet('CheckInstall','Install','CheckUninstall','Uninstall')][string]$Action,
 [Parameter(Mandatory=$true)][string]$ProductRoot,
 [string]$PackageRoot,
 [string]$HostRoot,
 [string]$EditorRoot,
 [string]$SupportRoot,
 [string]$DataRoot,
 [string]$ShortcutPath
)
$ErrorActionPreference='Stop'
if(!$PackageRoot){$PackageRoot=$PSScriptRoot}
$logRoot=Join-Path $env:LOCALAPPDATA 'ZZXLAB/PhotoHub'
[IO.Directory]::CreateDirectory($logRoot)|Out-Null
$logPath=Join-Path $logRoot 'setup.log'
try{
 $record=Join-Path $ProductRoot 'installation.json'
 $installed=$null
 if(Test-Path -LiteralPath $record){$installed=Get-Content -LiteralPath $record -Raw -Encoding UTF8|ConvertFrom-Json}
 if(!$ShortcutPath -and $installed -and ($installed.PSObject.Properties.Name -contains 'shortcutPath')){$ShortcutPath=[string]$installed.shortcutPath}
 if(!$HostRoot -and $installed){$HostRoot=[string]$installed.hostRoot}
 if(!$HostRoot){
  foreach($candidate in @((Join-Path $env:LOCALAPPDATA 'eufyMake Studio'),(Join-Path $env:ProgramFiles 'eufyMake Studio'),(Join-Path $env:ProgramFiles 'AnkerMake Studio'))){
   if(Test-Path -LiteralPath (Join-Path $candidate 'eufymake studio.exe')){$HostRoot=$candidate;break}
  }
 }
 if(!$HostRoot){throw '未找到 AnkerMake Studio。请先安装原软件，或在安装向导中指定目录。'}
 if(!$EditorRoot -and $Action -match 'Uninstall' -and $installed){$EditorRoot=[string]$installed.editorRoot}
 if(!$EditorRoot){
  $cache=Join-Path $env:APPDATA 'eufyMake Studio Profile/cache/offline/web_res'
  $marker=Join-Path $cache 'current_version.txt'
  if(!(Test-Path -LiteralPath $marker)){throw '请先用原软件联网打开一个设计，保存退出后再安装。'}
  $version=(Get-Content -LiteralPath $marker -Raw -Encoding UTF8).Trim()
  $versions=[IO.Path]::GetFullPath((Join-Path $cache 'versions')).TrimEnd('\')+'\'
  $resolved=if([IO.Path]::IsPathRooted($version)){[IO.Path]::GetFullPath($version)}else{[IO.Path]::GetFullPath((Join-Path $versions $version))}
  if(!$resolved.StartsWith($versions,[StringComparison]::OrdinalIgnoreCase)){throw '编辑器版本路径异常。'}
  $EditorRoot=Join-Path $resolved 'web'
 }
 $manage=Join-Path $PackageRoot 'Manage-Plugin.ps1'
 $operation=if($Action -match 'Uninstall'){'Uninstall'}else{'Install'}
 $arguments=@{Action=$operation;HostRoot=$HostRoot;EditorRoot=$EditorRoot;PayloadRoot=(Join-Path $PackageRoot 'payload');Manifest=(Join-Path $PackageRoot 'manifest.json')}
 if($SupportRoot){$arguments.SupportRoot=$SupportRoot}
 if($DataRoot -and $operation -eq 'Install'){$arguments.DataRoot=$DataRoot}
 if($ShortcutPath){$arguments.ShortcutPath=$ShortcutPath}
 $icon=Join-Path $ProductRoot 'ZZXLAB.ico'
 if(!(Test-Path -LiteralPath $icon)){$icon=Join-Path $PackageRoot 'ZZXLAB.ico'}
 $brandPath=Join-Path $PackageRoot 'brand-icon.json'
 if(!(Test-Path -LiteralPath $brandPath)){$brandPath=Join-Path $PackageRoot 'branding/brand-icon.json'}
 if(Test-Path -LiteralPath $brandPath){
  $brand=Get-Content -LiteralPath $brandPath -Raw -Encoding UTF8|ConvertFrom-Json
  if([string]$brand.file -notmatch '^ZZXlab-[0-9a-f]{12}\.ico$' -or [string]$brand.sha256 -notmatch '^[0-9a-f]{64}$'){throw '插件图标清单无效。'}
  $icon=Join-Path $ProductRoot ([string]$brand.file)
  if(!(Test-Path -LiteralPath $icon)){$icon=Join-Path ([IO.Path]::GetDirectoryName($brandPath)) ([string]$brand.file)}
  if(!(Test-Path -LiteralPath $icon)){throw '插件图标文件缺失。'}
  $iconStream=$null;$iconSha=$null
  try{$iconStream=[IO.File]::OpenRead($icon);$iconSha=[Security.Cryptography.SHA256]::Create();$iconDigest=[BitConverter]::ToString($iconSha.ComputeHash($iconStream)).Replace('-','').ToLowerInvariant()}
  finally{if($iconSha){$iconSha.Dispose()};if($iconStream){$iconStream.Dispose()}}
  if($iconDigest -ne [string]$brand.sha256){throw '插件图标校验失败。'}
 }
 if($operation -eq 'Install' -and (Test-Path -LiteralPath $icon)){$arguments.IconPath=$icon}
 if($Action.StartsWith('Check')){$arguments.DryRun=$true}
 # Use a child process: the transaction script exits explicitly after each action.
 $powershell=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe'
 $scriptArguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$manage)
 foreach($key in $arguments.Keys){$scriptArguments+='-'+$key;if($arguments[$key] -isnot [bool]){$scriptArguments+=[string]$arguments[$key]}}
 $processInfo=New-Object Diagnostics.ProcessStartInfo
 $processInfo.FileName=$powershell
 $processInfo.Arguments=($scriptArguments|ForEach-Object {'"'+$_.Replace('"','')+'"'}) -join ' '
 $processInfo.UseShellExecute=$false;$processInfo.CreateNoWindow=$true;$processInfo.RedirectStandardOutput=$true;$processInfo.RedirectStandardError=$true
 $process=[Diagnostics.Process]::Start($processInfo)
 $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync();$process.WaitForExit()
 $code=$process.ExitCode;$output=$stdout.Result+$stderr.Result;$process.Dispose()
 Write-Output $output
 Add-Content -LiteralPath $logPath -Value ([DateTime]::Now.ToString('s')+' '+$Action+"`r`n"+$output) -Encoding UTF8
 if($code -ne 0){throw '集成操作未完成。请先保存并关闭 AnkerMake，再重试。详细原因见安装日志。'}
 if($Action -eq 'Install'){
  $state=Get-Content -LiteralPath (Join-Path $EditorRoot '.photocraft-plugin-backup/state.json') -Raw -Encoding UTF8|ConvertFrom-Json
  [IO.Directory]::CreateDirectory($ProductRoot)|Out-Null
  $saved=[ordered]@{version='0.8.7';hostRoot=$HostRoot;editorRoot=$EditorRoot;supportRoot=[string]$state.supportRoot;installedAt=[DateTime]::UtcNow.ToString('o')}
  if($ShortcutPath){$saved.shortcutPath=$ShortcutPath}
  [IO.File]::WriteAllText($record,($saved|ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
 }
 exit 0
}catch{
 $message=$_.Exception.Message+"`r`n"+$_.ScriptStackTrace
 Add-Content -LiteralPath $logPath -Value ('ERROR '+$message) -Encoding UTF8
 Write-Error ($message+' 日志：'+$logPath) -ErrorAction Continue
 exit 1
}
