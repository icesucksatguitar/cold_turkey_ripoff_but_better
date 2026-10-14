using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Collections.Generic;

class Program {
    [DllImport("psapi.dll")]
    static extern int EmptyWorkingSet(IntPtr hProcess);

    [DllImport("kernel32.dll")]
    static extern bool SetProcessWorkingSetSize(IntPtr proc, int min, int max);

    static void Main(string[] args) {
        if (args.Length == 0 || args[0] == "--trim") {
            TrimAll(args);
            return;
        }

        if (args[0] == "--check" && args.Length > 1) {
            var targets = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 1; i < args.Length; i++) {
                string name = args[i].Trim();
                if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) {
                    name = name.Substring(0, name.Length - 4);
                }
                if (!string.IsNullOrEmpty(name)) {
                    targets.Add(name);
                }
            }

            foreach (var p in Process.GetProcesses()) {
                try {
                    if (targets.Contains(p.ProcessName)) {
                        Console.WriteLine(p.Id + "," + p.ProcessName + ".exe");
                    }
                } catch {}
            }
            return;
        }

        if (args[0] == "--kill" && args.Length > 1) {
            for (int i = 1; i < args.Length; i++) {
                string name = args[i].Trim();
                if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) {
                    name = name.Substring(0, name.Length - 4);
                }
                try {
                    foreach (var p in Process.GetProcessesByName(name)) {
                        try { p.Kill(); } catch {}
                    }
                } catch {}
            }
            return;
        }

        TrimAll(args);
    }

    static void TrimAll(string[] args) {
        try {
            var current = Process.GetCurrentProcess();
            Trim(current);
            foreach (var p in Process.GetProcessesByName("FocusGuard")) {
                if (p.Id != current.Id) Trim(p);
            }
            foreach (var p in Process.GetProcessesByName("electron")) {
                if (p.Id != current.Id) Trim(p);
            }
        } catch {}

        for (int i = 0; i < args.Length; i++) {
            int pid;
            if (int.TryParse(args[i], out pid)) {
                try {
                    var proc = Process.GetProcessById(pid);
                    Trim(proc);
                } catch {}
            }
        }
    }

    static void Trim(Process proc) {
        try {
            EmptyWorkingSet(proc.Handle);
            SetProcessWorkingSetSize(proc.Handle, -1, -1);
        } catch {}
    }
}
