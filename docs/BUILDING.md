# 从源码构建 Windows 安装包

版本：**AnkerMake PhotoHub 0.6.1 公开测试版**。

构建工具：Windows x64、PowerShell、Node.js 20+、Python 3.12 x64、Zig 0.17.0，以及 Windows 自带 .NET Framework 4.x C# 编译器。构建机器无需安装宿主；原版集成测试另需精确版本宿主。

```powershell
$env:ZIG_EXE = 'C:/tools/zig/zig.exe'
.\scripts\Build-Release.ps1
```

脚本创建隔离的 `standalone/build-env`，按 `requirements-build.txt` 安装 Python 依赖，并执行两个 npm 锁文件、网页构建、原生 DLL 构建、PyInstaller 打包和 C# 安装器构建。输出位于 `dist/`，默认不会安装、启动宿主或打印。

构建产物不保证字节复现（时间戳、打包器及工具版本可能影响文件），但源码、依赖版本、安装器载荷及各文件 SHA-256 都可核对。公开 Release 随附 `SHA256SUMS.txt`。

源码测试见 [TESTING.md](TESTING.md)。**不要将原版宿主 DLL、ICC 或私有设计复制进 Git；它们不是构建依赖。** 本版硬编码支持范围是宿主 5.0.4 / 编辑器 1.22.03；修改版本字符串不能替代真正的重新适配。
