@echo off
title Percetakan Gilar Media — Upload Otomatis ke GitHub & Cloud Hosting

cd /d "%~dp0"
cls
echo ========================================================
echo   PERCETAKAN GILAR MEDIA — UPLOAD KE GITHUB & CLOUD
echo   Deploy Otomatis ke Render.com (Online 24 Jam Non-Stop)
echo ========================================================
echo.

:: Cek Git
where git >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "PATH=C:\Program Files\Git\cmd;%PATH%"
    ) else (
        echo [ERROR] Git belum terdeteksi. Silakan tunggu instalasi selesai atau instal Git.
        pause
        exit /b 1
    )
)

:: Inisialisasi Git jika belum ada
if not exist ".git" (
    echo [1/4] Menginisialisasi repositori Git lokal...
    git init
    git branch -M main
) else (
    echo [1/4] Repositori Git lokal sudah aktif.
)

:: Periksa remote origin
git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo --------------------------------------------------------
    echo   PERHATIAN: Link GitHub belum terhubung!
    echo   1. Buat repository baru di https://github.com/new
    echo      (Beri nama: percetakan-gilar-media)
    echo   2. Salin URL HTTPS repository tersebut.
    echo --------------------------------------------------------
    echo.
    set /p REPO_URL="Masukkan URL Repository GitHub Anda: "
    if not "%REPO_URL%"=="" (
        git remote add origin %REPO_URL%
    ) else (
        echo [BATAL] URL tidak dimasukkan.
        pause
        exit /b 1
    )
)

echo.
echo [2/4] Mengumpulkan semua file pembaruan website...
git add .

echo.
echo [3/4] Membuat catatan pembaruan (commit)...
set COMMIT_MSG=Pembaruan Percetakan Gilar Media %date% %time%
git commit -m "%COMMIT_MSG%"

echo.
echo [4/4] Mengirim (push) ke GitHub & memicu auto-deploy Render...
git push -u origin main

echo.
echo ========================================================
echo   SELESAI! Website Anda sedang di-deploy secara otomatis
echo   ke cloud Render.com dan siap dibuka 24 jam dari kampus!
echo ========================================================
echo.
pause

