param([string]$Python='python',[string]$Zig=$env:ZIG_EXE,[string]$OutputRoot,[string]$WorkRoot,[string]$BuildPython,[string]$DepthModelRoot=$env:PH_DEPTH_MODEL_ROOT,[string]$StrokeModelRoot=$env:PH_STROKE_MODEL_ROOT)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(!$OutputRoot){$OutputRoot=Join-Path $projectRoot 'dist'}
if(!$WorkRoot){$WorkRoot=Join-Path $projectRoot 'standalone/build-work'}
$OutputRoot=[IO.Path]::GetFullPath($OutputRoot)
$WorkRoot=[IO.Path]::GetFullPath($WorkRoot)
[IO.Directory]::CreateDirectory($OutputRoot)|Out-Null
[IO.Directory]::CreateDirectory($WorkRoot)|Out-Null
$priorCommandShell=$env:ComSpec
$priorStageRoot=$env:PH_STAGE_ROOT
$priorBridgeExe=$env:PH_BRIDGE_EXE
$priorDepthModelRoot=$env:PH_DEPTH_MODEL_ROOT
$priorStrokeModelRoot=$env:PH_STROKE_MODEL_ROOT
$env:PH_STROKE_MODEL_ROOT=$StrokeModelRoot
$env:PH_DEPTH_MODEL_ROOT=$DepthModelRoot
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
    if(!$BuildPython){
        $environment=Join-Path $WorkRoot 'build-env'
        $BuildPython=Join-Path $environment 'Scripts/python.exe'
        if(!(Test-Path -LiteralPath $BuildPython)){
            & $Python -m venv $environment
            if($LASTEXITCODE){throw 'venv creation failed'}
        }
    }
    $buildPython=[IO.Path]::GetFullPath($BuildPython)
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
    $specRoot=Join-Path $WorkRoot 'spec'
    [IO.Directory]::CreateDirectory($specRoot)|Out-Null
    & $buildPython -m PyInstaller --noconfirm --onefile --windowed --name EufyPhotoCraftBridge --paths standalone --hidden-import PIL.Image --collect-all onnxruntime --distpath $OutputRoot --workpath (Join-Path $WorkRoot 'pyinstaller') --specpath $specRoot bridge.py
    if($LASTEXITCODE){throw 'Bridge build failed'}
    $stageRoot=Join-Path $OutputRoot 'release-payload-0.8.7'
    $env:PH_STAGE_ROOT=$stageRoot
    $env:PH_BRIDGE_EXE=Join-Path $OutputRoot 'EufyPhotoCraftBridge.exe'
    & node scripts/stage.cjs
    if($LASTEXITCODE){throw 'Payload staging failed'}
    $package=Join-Path $OutputRoot 'ZZXLAB-AnkerMake-PhotoHub-0.8.7-Branding1-Win10-Win11-x64-Setup.exe'
    & "$PSScriptRoot/../installer/Build-Setup.ps1" -PayloadRoot $stageRoot -Manifest "$projectRoot/manifest.json" -Output $package -BuildRoot (Join-Path $WorkRoot 'setup')
    & "$PSScriptRoot/../installer/Test-Package.ps1" -Package $package -PayloadRoot $stageRoot
    $hash=(Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLower()
    [IO.File]::WriteAllText((Join-Path $OutputRoot 'SHA256SUMS.txt'),$hash+'  '+[IO.Path]::GetFileName($package)+"`n",(New-Object Text.UTF8Encoding($false)))
} finally { $env:ComSpec=$priorCommandShell; $env:PH_STAGE_ROOT=$priorStageRoot; $env:PH_BRIDGE_EXE=$priorBridgeExe; $env:PH_DEPTH_MODEL_ROOT=$priorDepthModelRoot; $env:PH_STROKE_MODEL_ROOT=$priorStrokeModelRoot; Pop-Location }
