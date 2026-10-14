# Build a Local Windows Productivity Blocker

Act as a senior Windows desktop engineer, systems programmer, and UI/UX designer. Build a complete, working Windows application inspired by Cold Turkey Blocker. The app should help users stay focused by blocking distracting websites and desktop applications.

Do not just create a UI mockup. Build the actual application, including the blocking engine, desktop interface, persistence, scheduling, and Windows integration.

## 1. Core objective

Create a native-feeling Windows desktop app that runs locally on my PC. It must work without requiring a cloud service, account, subscription, or internet connection for its core blocking features.

The application should be lightweight, reliable, easy to use, and difficult to bypass accidentally.

Choose an appropriate architecture based on Windows capabilities. Before implementing, inspect the environment and explain your architecture and trade-offs. Then proceed with implementation rather than stopping after a plan.

## 2. Technology stack

Choose a suitable Windows desktop stack. Prefer:

- Tauri with React, TypeScript, and Vite for the desktop UI.
- Rust for the blocking engine and Windows system integration.
- SQLite or a local structured configuration store for persistent settings.
- Windows APIs for startup behavior, process detection, and other system integration where appropriate.

If a different architecture is materially more reliable for Windows website and application blocking, explain why before adopting it.

All blocking decisions and schedules must be processed locally. Do not send browsing history, application usage, block lists, or personal information to external servers.

## 3. Website blocking

Implement real website blocking, not just a browser extension or a list of disabled buttons.

Requirements:

- Add websites and domains to a block list.
- Support domain entries such as `youtube.com`, including relevant subdomains.
- Support wildcards or domain-pattern matching where appropriate.
- Allow users to add, remove, import, and export block lists.
- Support temporary focus sessions and scheduled blocking.
- Provide a clear blocked-page experience where technically feasible.
- Handle common bypasses, including alternate subdomains, HTTP versus HTTPS, and common browser resolution behavior.
- Explain how the system handles DNS-over-HTTPS, VPNs, proxies, alternate browsers, IPv4/IPv6, and administrator privileges.
- Never claim that a method is impossible to bypass if it is not.

Evaluate Windows Firewall, the Windows hosts file, DNS filtering, or a local filtering service. Select the appropriate method based on reliability, permissions, and maintainability.

If a method requires administrator privileges, request elevation explicitly and explain what changes will be made. Make all system changes reversible.

Do not silently overwrite existing hosts-file entries or firewall rules. Preserve unrelated settings, track every rule created by this app, and provide a reliable restoration mechanism.

## 4. Application blocking

Implement an actual Windows process-blocking feature.

Requirements:

- Let users add desktop applications to a block list.
- Allow selection of installed applications and executable paths.
- Detect running blocked applications.
- Prevent or interrupt their use during an active block according to the chosen implementation.
- Handle repeated relaunch attempts.
- Avoid blocking unrelated processes with similar names.
- Display the application name, executable path, current status, and reason for blocking.
- Provide a way to remove applications from the block list.

Investigate the most appropriate Windows-supported implementation. Consider process monitoring and termination for a basic implementation, while explaining its limitations. Do not pretend that terminating a process guarantees that it cannot be relaunched.

Do not disable security software, damage the operating system, or interfere with unrelated system processes.

## 5. Focus sessions and schedules

Build a scheduling engine with:

- Start and end times.
- Days of the week.
- One-time and recurring schedules.
- Configurable focus durations and breaks.
- Presets such as Study, Deep Work, and Sleep.
- A countdown timer and visible active-session status.
- Automatic activation and deactivation.
- Correct behavior after sleep, hibernation, reboot, or missed scheduled start times.
- Time-zone and daylight-saving handling.

Persist schedules locally and ensure the blocking engine does not depend on the UI window remaining open.

## 6. Strict focus mode

Provide a strict mode that makes accidental disabling harder.

Requirements:

- Users can configure a session duration before activating strict mode.
- Prevent ordinary UI controls from casually disabling an active strict session.
- Explain honestly which bypasses remain possible for a normal Windows user.
- Never lock users out of Windows or prevent access to security settings.
- Do not implement destructive persistence, stealth, credential collection, or mechanisms that interfere with uninstalling the application.

Do not claim administrator-proof or tamper-proof protection unless the implementation actually provides it. If strong enforcement requires a Windows service, elevated privileges, Group Policy, or another mechanism, document the requirements and limitations.

Include a deliberate recovery procedure for crashes, configuration errors, and accidental misconfiguration.

## 7. User interface

Build a polished desktop application with a modern, minimal design.

Use a dark theme by default, with restrained colors, clear typography, subtle animations, and good spacing. Avoid a generic admin dashboard aesthetic.

Include these screens:

1. Dashboard: current focus status, countdown, blocked-item count, and quick actions.
2. Website blocker: add and manage domains.
3. Application blocker: select and manage executable files.
4. Schedules: create and edit recurring schedules.
5. Focus session: configure duration and strictness.
6. Activity: locally stored records of block events and completed sessions.
7. Settings: startup behavior, notifications, theme, data management, and recovery.

Make the interface responsive to different desktop window sizes. Use accessible controls, keyboard navigation, useful empty states, and clear error messages.

Do not add fake statistics or nonfunctional buttons.

## 8. Windows integration

Implement and test, where appropriate:

- Windows startup integration with explicit user consent.
- Background blocking that continues when the UI window is closed.
- A system tray icon and menu.
- Notifications for session start, session end, and blocked applications.
- A proper installer and uninstaller.
- Safe application shutdown and recovery after crashes.
- Clear permission prompts and diagnostic logging.

Do not use hidden startup mechanisms or conceal the app from the user.

## 9. Data and security

Store configuration and logs locally.

Requirements:

- Validate all inputs and executable paths.
- Use safe process execution and avoid shell-injection vulnerabilities.
- Keep privileges as limited as possible.
- Protect configuration changes against corruption.
- Back up settings before modifying Windows configuration.
- Provide export, import, reset, and uninstall-cleanup functionality.
- Ensure uninstalling removes only resources created by this application.
- Do not collect analytics or transmit data externally.

## 10. Project organization and engineering

Organize the code into clear modules for:

- Website blocking.
- Application blocking.
- Scheduling.
- Strict-mode state.
- Windows integration.
- Persistence.
- Frontend UI.
- Diagnostics and recovery.

Keep privileged system operations out of the frontend. Use a small, well-defined interface between the UI and the Rust backend.

Write maintainable code, meaningful error handling, and tests for critical functionality.

Create a README that explains:

- Architecture and design decisions.
- Prerequisites and development setup.
- How to run the application.
- How website and application blocking work.
- Permissions and limitations.
- How to test each feature.
- How to build the Windows installer.
- How to restore modified system settings and recover from failures.

## 11. Required implementation workflow

Follow this sequence:

1. Inspect the current directory, installed tools, and operating system.
2. Present a concise architecture proposal and identify Windows-specific limitations.
3. Create the project structure and install dependencies.
4. Implement the UI and the actual local blocking engine.
5. Integrate the UI with the backend.
6. Add persistence, scheduling, strict mode, recovery, and Windows integration.
7. Run the available tests, linting, and build checks.
8. Fix errors rather than leaving them unresolved.
9. Test the blocking mechanisms using safe, reversible test cases.
10. Build the application and document how to launch and install it.

Work incrementally. After each major component, run the relevant checks. Do not replace real functionality with mock data just to make the UI look complete.

If a system-level feature cannot be implemented or tested in the current environment, state exactly what is missing and provide the implementation or test procedure needed on Windows.

Do not overwrite unrelated files. Inspect before editing, preserve existing work, and ask before making destructive system changes.

## Definition of done

The result should be a functioning Windows desktop application, not merely a prototype.

At minimum, it must have a working interface, persistent website and application block lists, a functioning scheduling engine, real local blocking mechanisms, safe system integration, documented limitations, automated tests, and a reproducible Windows build process.

Begin by inspecting the project directory and proposing the architecture. Then build the application.

## Recommended implementation order

Website blocking and application blocking are separate engineering problems. A hosts-file-based website blocker can be relatively simple to implement, but it has limitations. Reliably preventing applications from reopening themselves is more complicated and may require elevated Windows privileges or a service.

Build and test these separately rather than creating a convincing interface that does not actually enforce anything.

**First milestone:** get domain blocking, executable monitoring, a countdown timer, and persistent schedules working locally. Then add strict mode and more robust Windows enforcement.
