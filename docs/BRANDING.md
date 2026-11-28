# ZZXlab 品牌资源

当前版本直接采用用户提供的原始 logo，字样为 **ZZXlab**：ZZX 大写，lab 小写，b 必须小写。保留原始黄色手写字与蓝色阴影，不重新生成字形。

- 原始文件：用户提供的 ZZXlab.png，1004×255 RGBA。
- 原图 SHA256：7641d4b0cdd826d52b53de110bdf48618632c21cd998ea8709211087a5d6c1c4。
- installer/branding/ZZXLAB-wordmark.png 与该原图逐字节一致；资源文件名保留历史兼容命名。
- scripts/build-brand-assets.py 只做尺寸适配及 PNG / ICO / BMP 封装，不重绘文字。
- Windows ICO 提供 16、20、24、32、40、48、64、128、256 像素尺寸。
- brand-icon.json 记录图标文件名与 SHA256。快捷方式、开始菜单、卸载入口使用带内容哈希的图标文件名，避免沿用旧路径的 Windows 图标缓存。
- GitHub README 使用同一份原始字标资源。安装向导、EXE、桌面快捷方式和卸载项均引用由原图封装的资源。

全部为测试版；品牌资源更新不改变原版主程序或打印流程。
