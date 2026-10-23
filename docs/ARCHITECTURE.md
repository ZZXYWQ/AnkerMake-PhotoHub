# 架构

- `payload/`：原画布菜单、图片/轮廓工具、PNG 墨路策略及 PSD 运行时代码。
- `psd-src/`：本地 PSD Web Worker、工艺合成和精确版本适配。
- `raster-src/`：图片像素工具及原版撤销/替换接入。
- `bridge.py`、`cdp_loader.py`：本机认证桥接与限定编辑器地址的脚本加载。
- `ink_control.py`：受版本限制的原生组件加载和控制；状态通过共享内存交换。
- `native/`：基于 MinHook 的指定原生分色 ABI 适配。用户位序为 C=1/M=2/Y=4/K=8；最终原生平面顺序为 K/C/M/Y/W1/W2。
- `installer/`：带检查、备份和回滚的单 EXE 安装器。

图层的 `photoHubInkMask` 随项目序列化。打印生成阶段把裁切/缩放后的允许通道策略编码为 PNG 私有 `phCm` 块（PHL1 格式）。卷材打包旋转图像时同步旋转策略。原生侧绑定实际彩色源图，在分色结束后清除未允许的两位喷点，保持其他通道、文件头和允许喷点。

当前源码保留历史内部路径/标识 `eufymake-photocraft`、`EufyPhotoCraftBridge` 及原宿主路径，供旧安装升级和恢复使用。它们不是公开产品名。`standalone/photocraft_control.py` 是历史独立程序接口的兼容代码，当前发布包不包含独立 PhotoCraft 程序，也不需要该程序来使用画布工具。
