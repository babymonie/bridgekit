@echo off
cd /d "%~dp0"
node tools\start-patcher.cjs
if errorlevel 1 pause
