# 从源码构建 Windows 安装包

版本：**AnkerMake PhotoHub 0.8.7 公开测试版**，安装器文件版本 0.8.7.0。

构建工具：Windows x64、PowerShell、Node.js 20+、Python 3.12 x64、Zig 0.17.0 和 Inno Setup 6.7.4。安装用户无需这些开发工具。

先按 scripts/export-depth-model.py 和 scripts/export-stroke-model.py 从官方权重导出模型；来源、许可证、版本及导出 SHA256 见 manifest.json 的 bundledAiDepth 与 bundledAiStrokes。模型目录各自须包含 ONNX、JSON、LICENSE.txt 和 README.md。构建只接受匹配哈希，运行时不下载模型。

```powershell
$env:ZIG_EXE = 'D:/tools/zig/zig.exe'
$env:INNO_ISCC = 'D:/tools/InnoSetup/ISCC.exe'
$env:PH_DEPTH_MODEL_ROOT = 'D:/PhotoHub-build/models/depth'
$env:PH_STROKE_MODEL_ROOT = 'D:/PhotoHub-build/models/strokes'
.\scripts\Build-Release.ps1 -WorkRoot D:/PhotoHub-build/work -OutputRoot D:/PhotoHub-build/output
```

脚本创建隔离 Python 环境，安装 requirements-build.txt，执行 npm 锁文件安装、网页和原生 DLL 构建、PyInstaller 打包与 Inno Setup 安装器构建。最终输出 ZZXLAB-AnkerMake-PhotoHub-0.8.7-Public-Beta-Win10-Win11-x64-Setup.exe 及 SHA256。默认不会安装、启动宿主或打印。

installer/Test-Package.ps1 检查包结构及模型哈希；installer/Test-WizardInstaller.ps1 通过真实 EXE 在隔离夹具中验证安装、文件一致性、快捷方式、卸载注册及原版恢复。需在未安装正式产品时运行隔离测试，避免影响同一 AppId 的卸载注册。

构建产物不保证字节复现（时间戳、打包器和工具版本会影响文件），但源码、依赖版本、载荷与 SHA256 可核对。

不要将原版 DLL、ICC、账号配置、用户设计或原图复制进公开源码。当前适配宿主为 5.1.3、编辑器 1.25.04；Windows 10/11 x64 系统支持范围不代表所有编辑器版本兼容。修改版本字符串不能替代实际适配验证。
