# AnkerMake PhotoHub 插件 0.7.0 StartupFix1 公开测试版

此为**未单独发布的本地候选记录**，没有对应公开 Release 或可下载的安装包。启动路径问题随后由 StartupFix2 修复，请下载 [StartupFix2 公开测试版](https://github.com/ZZXYWQ/AnkerMake-PhotoHub/releases/tag/v0.7.0-startupfix2-public-beta)。以下仅保留候选版本的历史验证范围。

**所有公开版本均为测试版，可能存在较多 Bug；不保证及时更新或修复，没有固定更新计划。**

## 历史候选包信息（不提供下载）

候选包名为 `PhotoHub-AnkerMake-Plugin-0.7.0-StartupFix1-Win10-Win11-x64.exe`。功能版本为 0.7.0，安装器文件版本为 0.7.0.1；此候选包未公开发布，请勿按该名称寻找下载。当前安装与升级请使用上方 StartupFix2 链接及新手教程。

等已有打印结束，保存设计并完全退出 AnkerMake Studio，运行此 EXE 选择“安装 / 升级”，可直接覆盖已有 0.7.0。随后从原版或 PhotoHub 快捷方式启动。卸载也使用同一 EXE，保留设计。

仍只适配 **AnkerMake Studio 5.1.3 / 编辑器 1.23.02**。Windows 10/11 x64 家庭、专业、企业版共用此包，依赖已内置；尚未实测所有系统构建。0.6.x 不能用于该宿主环境。

详细步骤见 [新手安装与升级教程](https://github.com/ZZXYWQ/AnkerMake-PhotoHub/blob/main/docs/新手安装与升级教程.md)，包括原版 UV 软件及编辑器的下载、升级、版本检查、安装和卸载。

## 修复内容

- 重复点击启动图标时，恢复并激活已有的后台或最小化窗口，而不是直接退出。
- 冷启动及回退原版时明确要求正常显示窗口。
- 增加启动阶段和耗时日志，不记录账号和设计内容，保留启动文件哈希、回环连接检查及图形兼容参数。

## 验证范围

本机验证两个桌面快捷方式和两个任务栏快捷方式，冷启动约 8 秒，最小化后重复打开能恢复窗口，主程序保持单实例。Windows PowerShell 模拟测试覆盖首次启动、已有窗口恢复、哈希拒绝、短暂 IO 重试和异常脱敏，安装包 23 个载荷文件完整性校验通过。

本次只修改启动器及说明，未重新执行整套 RIP/打印数据生成测试。图片、PSD、轮廓和逐层 CMYK 的原验证范围见 [0.7.0 验证记录](https://github.com/ZZXYWQ/AnkerMake-PhotoHub/blob/main/docs/VERIFICATION-0.7.0.md)。**没有实际打印。**

退出后的偶发残留进程原因尚未定位，本次不声称彻底解决所有启动故障；本次也不涉及地区检测或网络分流。

**感谢 RYAN 提出的宝贵意见。** 欢迎通过 Issues 提供复现步骤和脱敏日志，请勿上传账号令牌或私有设计。
