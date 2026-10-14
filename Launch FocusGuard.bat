@echo off
cd /d "%~dp0"
if exist "%~dp0release-build\win-unpacked\FocusGuard.exe" (
    start "" "%~dp0release-build\win-unpacked\FocusGuard.exe"
) else (
    start "" "%~dp0release\win-unpacked\FocusGuard.exe"
)
