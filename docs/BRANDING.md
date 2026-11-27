# ZZXLAB 品牌资源

Branding1 使用用户提供的黄色手写字、蓝色错位阴影参考重绘，保留单行签名字标。参考源文件由用户保留，不作为软件功能测试素材。

本次使用内置图像生成工具，提示要求为：按用户参考重绘 ZZXLAB，黄色手写笔画、蓝色向右上偏移副本、透明背景、完整单行字标；不使用原来的 ZZX/LAB 两行系统字体图标。

- installer/branding/ZZXLAB-wordmark.png：生成字标源图。
- ZZXLAB.png：512 像素透明应用图标。
- ZZXLAB.ico：16、20、24、32、40、48、64、128、256 像素图标。
- ZZXLAB.svg：引用 PNG 的 SVG 包装，不是手工矢量化路径。
- wizard.bmp / wizard-small.bmp：安装向导品牌资源。

`scripts/build-brand-assets.py` 仅按源图比例导出图标与向导布局，不用系统字体重画字标。手写六字符在 16 像素时可读性有限，保留完整品牌形式。

插件功能版本 0.8.7，Branding1 安装器文件版本 0.8.7.1，所有版本均为公开测试版。
