# 测试

## 可自动执行，无打印机

```sh
npm ci
npm test
python -m unittest discover -s tests -p test_cdp_loader.py
cc -O2 native/test_layer_policy.c -o layer-policy-test
./layer-policy-test
```

菜单浏览器测试：`npx playwright install chromium`，然后 `npm run test:browser`。Windows 中也可运行编译后的 `.exe`。

协议测试使用临时合成回环服务，墨路/轮廓单元测试使用合成像素。打包测试使用隔离目录及不存在的宿主路径，不连接用户设备。

## 0.6.1 实际 PSD 离线验证

已用四个实际 PSD 图层，经版本适配后的原版生成器、原版 tar 卷材旋转和本机原版分色 DLL，生成四份 6 平面、2 位 PRN。720×1440 DPI，每份 6052×22678 点。

对同次分色的原始 PRN 与 PhotoHub 私有筛选副本逐点比较。不同次原版分色可能有随机抖动，不能把跨次输出直接作为保留喷点相等的依据。检查未选通道为零、允许喷点相等、白墨/光油数据相等，以及每个彩色墨路均有非零输出。

结果汇总见 `verification-0.6.1.json`。私有 PSD、PNG、PRN、ICC、原版 DLL 和原始日志未公开。

`native/test_full_rip.c`、`verify_full_rip.c`、`test_native.c` 为人工集成测试辅助代码。它们需要操作者自备精确版本原版 DLL、ICC 和本地测试输入；不会从仓库取得这些专有文件。它们不应自动连接生产宿主或打印设备。原版任务参数、卷材分段缓存和图层策略必须来自相同输入；不能把合成回调测试宣称为完整真实分色测试。
