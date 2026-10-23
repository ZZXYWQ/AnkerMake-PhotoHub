param([switch]$TestHost,[string]$Zig=$env:ZIG_EXE)
$ErrorActionPreference='Stop'
if(!$Zig){$Zig=(Get-Command zig -ErrorAction Stop).Source}
$out=Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force $out | Out-Null
$sources=@('PhotoHubInk.c','vendor/minhook-1.3.4/src/buffer.c','vendor/minhook-1.3.4/src/hook.c','vendor/minhook-1.3.4/src/trampoline.c','vendor/minhook-1.3.4/src/hde/hde64.c') | ForEach-Object { Join-Path $PSScriptRoot $_ }
$flags=@();$name='PhotoHubInk.dll'
if($TestHost){$flags=@('-DPH_TEST_HOST');$name='PhotoHubInk-test.dll'}
& $Zig cc -target x86_64-windows-gnu -O2 -shared @flags @sources -lbcrypt -o (Join-Path $out $name)
if($LASTEXITCODE -ne 0){throw 'Native ink module build failed'}
Get-FileHash (Join-Path $out $name)
