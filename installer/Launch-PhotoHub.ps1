$ErrorActionPreference='Stop'
try{
 $record=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'installation.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $launcher=Join-Path ([string]$record.supportRoot) 'Start-PhotoHub.ps1'
 if(!(Test-Path -LiteralPath $launcher)){throw '插件启动入口缺失，请重新运行安装包修复。'}
 & $launcher
}catch{
 Add-Type -AssemblyName System.Windows.Forms
 [Windows.Forms.MessageBox]::Show($_.Exception.Message,'ZZXlab · AnkerMake PhotoHub')|Out-Null
}
