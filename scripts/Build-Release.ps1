param([string]$Python='python',[string]$Zig=$env:ZIG_EXE)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$priorCommandShell=$env:ComSpec
# Use a valid command interpreter for npm child processes, without changing the
# machine's environment. Restore the caller's value after this build.
if(!$env:ComSpec -or !(Test-Path -LiteralPath $env:ComSpec -PathType Leaf)){
    $env:ComSpec=Join-Path $env:WINDIR 'System32/cmd.exe'
}
$env:ComSpec=[IO.Path]::GetFullPath($env:ComSpec)
Push-Location $projectRoot
try {
    if(!$Zig){$Zig=(Get-Command zig -ErrorAction Stop).Source}
    if(!(Test-Path -LiteralPath $Zig)){throw 'Set ZIG_EXE to Zig 0.17.0 x64 zig.exe.'}
    & $Python -c "import sys,struct; assert sys.version_info[:2]==(3,12) and struct.calcsize('P')==8, 'Python 3.12 x64 is required'"
    if($LASTEXITCODE){throw 'Python version check failed'}
    if(!(Test-Path -LiteralPath 'standalone/build-env/Scripts/python.exe')){
        & $Python -m venv standalone/build-env
        if($LASTEXITCODE){throw 'venv creation failed'}
    }
    $buildPython=Join-Path $projectRoot 'standalone/build-env/Scripts/python.exe'
    & $buildPython -m pip install -r requirements-build.txt
    if($LASTEXITCODE){throw 'Python dependency installation failed'}
    $nodeExe=(Get-Command node -ErrorAction Stop).Source
    $npmCli=Join-Path ([IO.Path]::GetDirectoryName((Get-Command npm.cmd -ErrorAction Stop).Source)) 'node_modules/npm/bin/npm-cli.js'
    if(!(Test-Path -LiteralPath $npmCli)){throw 'Cannot locate npm-cli.js beside npm.cmd. Use the standard Node.js Windows distribution.'}
    & $nodeExe $npmCli ci
    if($LASTEXITCODE){throw 'npm ci failed'}
    & $nodeExe $npmCli --prefix psd-src ci
    if($LASTEXITCODE){throw 'PSD dependency installation failed'}
    & $nodeExe raster-src/build.cjs
    if($LASTEXITCODE){throw 'Raster build failed'}
    & $nodeExe psd-src/build.cjs
    if($LASTEXITCODE){throw 'PSD build failed'}
    & "$PSScriptRoot/../native/build.ps1" -Zig $Zig
    & $buildPython -m PyInstaller --noconfirm --onefile --windowed --name EufyPhotoCraftBridge --paths standalone --hidden-import PIL.Image --distpath dist --workpath standalone/build-work --specpath standalone bridge.py
    if($LASTEXITCODE){throw 'Bridge build failed'}
    & node scripts/stage.cjs
    if($LASTEXITCODE){throw 'Payload staging failed'}
    $package=Join-Path $projectRoot 'dist/PhotoHub-AnkerMake-Plugin-0.6.1-Public-Beta-Win10-Win11-x64.exe'
    & "$PSScriptRoot/../installer/Build-Setup.ps1" -PayloadRoot "$projectRoot/dist/release-payload-0.6.1" -Manifest "$projectRoot/manifest.json" -Output $package
    & "$PSScriptRoot/../installer/Test-Package.ps1" -Package $package -PayloadRoot "$projectRoot/dist/release-payload-0.6.1"
    $hash=(Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLower()
    [IO.File]::WriteAllText((Join-Path $projectRoot 'dist/SHA256SUMS.txt'),$hash+'  '+[IO.Path]::GetFileName($package)+"`n",(New-Object Text.UTF8Encoding($false)))
} finally { $env:ComSpec=$priorCommandShell; Pop-Location }
