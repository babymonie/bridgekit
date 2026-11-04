@echo off
cd /d "%~dp0"
node tools\demo.cjs
if errorlevel 1 pause
