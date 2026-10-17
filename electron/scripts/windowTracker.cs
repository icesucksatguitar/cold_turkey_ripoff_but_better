using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Automation;

class WindowTracker {
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    static readonly Regex PwRegex = new Regex(
        @"(physics\s*wallah|physicswallah|\bpw\.live\b|\bstudy\.pw\b|\bpw\s*-\s*|\bpw\s+live\b|competition\s*wallah|jee\s*wallah|neet\s*wallah|ncert\s*wallah|alakh\s*pandey|defense\s*wallah|commerce\s*wallah|cuet\s*wallah|upsc\s*wallah|gate\s*wallah|\bpw\s*skills\b)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled
    );

    static readonly Regex AiRegex = new Regex(
        @"(chatgpt|chat\.openai\.com|claude(\.ai|\s+-\s+anthropic)?|gemini(\.google\.com)?|google\s+gemini|aistudio\.google)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled
    );

    static string EscapeJson(string s) {
        if (string.IsNullOrEmpty(s)) return "";
        return s.Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "")
                .Replace("\n", " ")
                .Replace("\t", " ");
    }

    static string GetBrowserUrl(IntPtr hwnd, string procLower) {
        if (procLower != "chrome" && procLower != "msedge" && procLower != "brave" && procLower != "opera" && procLower != "firefox") {
            return "";
        }

        try {
            AutomationElement root = AutomationElement.FromHandle(hwnd);
            if (root == null) return "";

            // In Chromium browsers and Firefox, the address bar is an Edit control
            Condition editCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
            AutomationElement editElement = root.FindFirst(TreeScope.Descendants, editCond);
            if (editElement != null) {
                object vp;
                if (editElement.TryGetCurrentPattern(ValuePattern.Pattern, out vp)) {
                    string val = ((ValuePattern)vp).Current.Value;
                    if (!string.IsNullOrEmpty(val)) {
                        return val;
                    }
                }
            }
        } catch {
            // Automation error or access denied
        }
        return "";
    }

    static string SampleWindow() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) {
            return "{\"pid\":0,\"process\":\"unknown\",\"title\":\"\",\"url\":\"\",\"isPw\":false,\"isAi\":false,\"isSelf\":false,\"isDesktop\":true}";
        }

        StringBuilder sb = new StringBuilder(1024);
        GetWindowText(hwnd, sb, 1024);
        string title = sb.ToString();

        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        string procName = "unknown";
        try {
            procName = Process.GetProcessById((int)pid).ProcessName;
        } catch {}

        string procLower = procName.ToLower();

        // Check if self
        bool isSelf = procLower == "focusguard" || procLower == "electron";

        // Try getting browser URL if browser
        string url = "";
        try {
            url = GetBrowserUrl(hwnd, procLower);
        } catch {}

        string combined = title + " " + url;

        // Check PW
        bool isPw = false;
        if (procLower.Contains("physicswallah") || procLower == "pw") {
            isPw = true;
        } else if (PwRegex.IsMatch(combined)) {
            isPw = true;
        } else if (url.IndexOf("pw.live", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   url.IndexOf("physicswallah", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   url.IndexOf("pwskills.com", StringComparison.OrdinalIgnoreCase) >= 0) {
            isPw = true;
        }

        // Check AI
        bool isAi = false;
        if (!isPw) {
            if (procLower.Contains("chatgpt") || procLower.Contains("claude")) {
                isAi = true;
            } else if (AiRegex.IsMatch(combined)) {
                isAi = true;
            } else if (url.IndexOf("chatgpt.com", StringComparison.OrdinalIgnoreCase) >= 0 ||
                       url.IndexOf("chat.openai.com", StringComparison.OrdinalIgnoreCase) >= 0 ||
                       url.IndexOf("claude.ai", StringComparison.OrdinalIgnoreCase) >= 0 ||
                       url.IndexOf("gemini.google.com", StringComparison.OrdinalIgnoreCase) >= 0 ||
                       url.IndexOf("aistudio.google.com", StringComparison.OrdinalIgnoreCase) >= 0) {
                isAi = true;
            }
        }

        bool isDesktop = string.IsNullOrEmpty(title) && (procLower == "explorer" || procLower == "unknown");

        return string.Format(
            "{{\"pid\":{0},\"process\":\"{1}\",\"title\":\"{2}\",\"url\":\"{3}\",\"isPw\":{4},\"isAi\":{5},\"isSelf\":{6},\"isDesktop\":{7}}}",
            pid,
            EscapeJson(procName),
            EscapeJson(title),
            EscapeJson(url),
            isPw ? "true" : "false",
            isAi ? "true" : "false",
            isSelf ? "true" : "false",
            isDesktop ? "true" : "false"
        );
    }

    static void Main(string[] args) {
        Console.OutputEncoding = Encoding.UTF8;

        if (args.Length > 0 && args[0] == "--stream") {
            int intervalMs = 900;
            if (args.Length > 1) {
                int.TryParse(args[1], out intervalMs);
                if (intervalMs < 300) intervalMs = 300;
            }

            while (true) {
                try {
                    string json = SampleWindow();
                    Console.WriteLine(json);
                } catch {}
                Thread.Sleep(intervalMs);
            }
        } else {
            string json = SampleWindow();
            Console.WriteLine(json);
        }
    }
}
