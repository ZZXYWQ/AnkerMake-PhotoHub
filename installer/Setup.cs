/* AnkerMake PhotoHub 0.6.1 Public Beta. Host 5.0.4 / editor 1.22.03 only. Older PhotoHub releases must not be used for layer-local CMYK jobs. */
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Forms;

class Setup : Form {
    TextBox host = new TextBox { Left=20, Top=52, Width=480 };
    TextBox log = new TextBox { Left=20, Top=140, Width=620, Height=280, Multiline=true, ReadOnly=true, ScrollBars=ScrollBars.Vertical };
    string bundle;
    string editorRoot;
    string lastOutput="";
    string logPath=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EufyPhotoCraftBridge","setup.log");
    Setup(string root) {
        bundle=root; Text="AnkerMake PhotoHub 0.6.1 公开测试版 · 安装、升级与卸载"; Width=680; Height=480;
        string marker=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),@"eufyMake Studio Profile\cache\offline\web_res\current_version.txt");
        if(File.Exists(marker)) {
            string cacheRoot=Path.GetDirectoryName(marker);
            string versionRoot=File.ReadAllText(marker).Trim();
            if(!Path.IsPathRooted(versionRoot)) versionRoot=Path.Combine(cacheRoot,"versions",versionRoot);
            versionRoot=Path.GetFullPath(versionRoot);
            if(!versionRoot.StartsWith(Path.GetFullPath(Path.Combine(cacheRoot,"versions"))+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))
                throw new Exception("编辑器版本路径异常，已停止操作。");
            editorRoot=Path.Combine(versionRoot,"web");
            log.Text="当前编辑器："+editorRoot+Environment.NewLine;
        }
        Controls.Add(new Label { Left=20, Top=20, Width=610, Text="选择 AnkerMake Studio 安装目录（包含 resources 文件夹）" });
        Controls.Add(host); Controls.Add(log);
        Controls.Add(new Label { Left=20, Top=425, Width=620, Height=22, Text="所有版本均为测试版，可能存在较多 Bug；不保证及时更新或修复。" });
        Button browse=new Button { Left=515, Top=50, Width=125, Text="浏览…" };
        browse.Click += delegate { using(var d=new FolderBrowserDialog()){ if(d.ShowDialog()==DialogResult.OK) host.Text=d.SelectedPath; }};
        Controls.Add(browse);
        int x=20;
        foreach(string action in new[]{"Install","Uninstall","Status"}) {
            var button=new Button { Left=x, Top=95, Width=140, Text=(action=="Install"?"安装 / 升级":action=="Uninstall"?"卸载":"查看状态") }; string captured=action;
            button.Click += delegate { Execute(captured); }; Controls.Add(button); x+=155;
        }
        foreach(var path in new[]{ Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"eufyMake Studio"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"eufyMake Studio"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"AnkerMake Studio") })
            if(Directory.Exists(Path.Combine(path,"resources"))) { host.Text=path; break; }
    }
    string Quote(string text) { return "\""+text.Replace("\"","")+"\""; }
    int Run(string action, bool dry, string selectedHost) {
        string selectedEditor=editorRoot;
        if(action=="Uninstall" && selectedEditor!=null && !File.Exists(Path.Combine(selectedEditor,@".photocraft-plugin-backup\state.json"))) {
            string versions=Path.GetDirectoryName(Path.GetDirectoryName(selectedEditor));
            foreach(string version in Directory.GetDirectories(versions)) {
                string candidate=Path.Combine(version,"web");
                if(File.Exists(Path.Combine(candidate,@".photocraft-plugin-backup\state.json"))) {
                    if(selectedEditor!=editorRoot) throw new Exception("发现多个旧版扩展，请用 Manage-Plugin.ps1 指定 EditorRoot 卸载。");
                    selectedEditor=candidate;
                }
            }
        }
        string powershell=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),@"WindowsPowerShell\v1.0\powershell.exe");
        if(!File.Exists(powershell)) throw new Exception("未找到 Windows PowerShell 5.1，请修复 Windows 系统组件后再安装。");
        var pi=new ProcessStartInfo(powershell, "-NoProfile -ExecutionPolicy Bypass -File "+Quote(Path.Combine(bundle,"Manage-Plugin.ps1"))+" -Action "+action+" -HostRoot "+Quote(selectedHost)+(selectedEditor==null?"":" -EditorRoot "+Quote(selectedEditor))+" -PayloadRoot "+Quote(Path.Combine(bundle,"payload"))+" -Manifest "+Quote(Path.Combine(bundle,"manifest.json"))+(dry?" -DryRun":""));
        pi.UseShellExecute=false; pi.CreateNoWindow=true; pi.RedirectStandardOutput=true; pi.RedirectStandardError=true;
        using(var p=Process.Start(pi)) {
            var output=p.StandardOutput.ReadToEndAsync(); var error=p.StandardError.ReadToEndAsync();
            p.WaitForExit(); lastOutput=output.Result+error.Result;
            Directory.CreateDirectory(Path.GetDirectoryName(logPath));
            File.AppendAllText(logPath,DateTime.Now.ToString("s")+" "+action+(dry?" CHECK":" APPLY")+Environment.NewLine+lastOutput+Environment.NewLine);
            Invoke((Action)(()=>log.AppendText(lastOutput+Environment.NewLine))); return p.ExitCode;
        }
    }
    void ShowFailure() {
        string message=lastOutput.Contains("Close eufyMake")
            ? "Anker Make Studio / eufyMake 仍在运行。请保存项目并完全退出原软件，再点击安装。无需重新下载安装包。"
            : lastOutput.Contains("Existing backup/install state")
            ? "检测到不完整安装记录，请保留诊断日志以恢复。"
            : lastOutput.Contains("downgrades are refused")
            ? "已安装更新版本，安装器不支持降级。同版本可以直接修复安装。"
            : lastOutput.Contains("UnauthorizedAccess") || lastOutput.Contains("AccessDenied") || lastOutput.Contains("拒绝访问")
            ? "安装目录没有写入权限。请保留日志；如需管理员权限，请由同一 Windows 用户提升权限运行，勿切换到其他用户，以免安装到错误的用户配置。"
            : lastOutput.Contains("Unsupported/changed host file") || lastOutput.Contains("Patch count")
            ? "当前 eufyMake 编辑器版本与此安装包不匹配，已停止安装。需要适配该版本后再安装。"
            : lastOutput.Contains("Unsupported native")
            ? "当前 eufyMake 主程序版本尚未适配。安装器未修改文件，请保留诊断日志。"
            : lastOutput.Contains("File changed") || lastOutput.Contains("Native application changed")
            ? "检测到安装后原软件文件发生变化。为保留现有文件，操作已停止，请提供诊断日志以适配。"
            : "操作未完成，请查看窗口中的详细错误。";
        MessageBox.Show(message+Environment.NewLine+"诊断日志："+logPath,Text,MessageBoxButtons.OK,MessageBoxIcon.Warning);
    }
    async void Execute(string action) {
        try {
            if(!Directory.Exists(Path.Combine(host.Text,"resources"))) throw new Exception("未找到 eufyMake，请先安装原软件，或通过浏览选择它的安装目录。");
            if(action=="Install" && (editorRoot==null || !File.Exists(Path.Combine(editorRoot,"index.html")))) throw new Exception("尚未找到当前用户的 eufyMake 编辑器缓存。请先正常启动 eufyMake、联网打开一个设计，保存并退出后再安装。请使用与 eufyMake 相同的 Windows 用户运行安装包。");
            Enabled=false; Cursor=Cursors.WaitCursor;
            string selectedHost=host.Text;
            log.AppendText("正在检查和处理文件，请稍候…"+Environment.NewLine);
            if(action!="Status" && await Task.Run(()=>Run(action,true,selectedHost))!=0) { ShowFailure(); return; }
            int result=await Task.Run(()=>Run(action,false,selectedHost));
            if(result!=0) ShowFailure();
            else if(action!="Status") MessageBox.Show(action=="Install"?"安装 / 升级完成。请通过桌面 eufyMake + PhotoHub 快捷方式启动。":"卸载完成，原程序与编辑器文件均已恢复，作品仍然保留。",Text);
        } catch(Exception e) { MessageBox.Show(e.Message,Text); }
        finally { Enabled=true; Cursor=Cursors.Default; }
    }
    [STAThread] static void Main() {
        Application.EnableVisualStyles();
        string root=Path.Combine(Path.GetTempPath(),"EufyPhotoCraftSetup-"+Guid.NewGuid().ToString("N"));
        try {
            if(Environment.OSVersion.Version.Major<10) throw new Exception("此安装包需要 Windows 10 或 Windows 11（x64）。");
            string architecture=Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432") ?? Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE") ?? "";
            if(!Environment.Is64BitOperatingSystem || !architecture.Equals("AMD64",StringComparison.OrdinalIgnoreCase)) throw new Exception("此安装包仅适配 x64 电脑。32 位 Windows 和 ARM64 尚未适配，未修改任何文件。");
            Directory.CreateDirectory(root);
            string zip=Path.Combine(root,"bundle.zip");
            using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("bundle.zip")) {
                if(stream==null) throw new Exception("安装包内容缺失。");
                using(var output=File.Create(zip)) stream.CopyTo(output);
            }
            ZipFile.ExtractToDirectory(zip,root);
            Application.Run(new Setup(root));
        } catch(Exception e) { MessageBox.Show(e.Message,"PhotoHub Setup"); }
        // Temporary package retained for diagnostics; no user documents are stored here.
    }
}
