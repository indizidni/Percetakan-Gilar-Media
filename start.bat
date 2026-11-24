@echo off
title Percetakan Gilar Media - Web Percetakan (Toko Online, Kasir POS & Admin)

:: ========================================================
::  PERCETAKAN GILAR MEDIA — PORTABLE STARTUP SCRIPT
::  Bisa dijalankan di mana pun: Laptop, PC, Flashdisk,
::  Desktop, Downloads, Drive C:, D:, E:, dll.
:: ========================================================

:: 1. Pindah ke folder tempat start.bat berada (kompatibel lintas drive)
cd /d "%~dp0"

cls
echo ========================================================
echo        PERCETAKAN GILAR MEDIA — CETAK DIGITAL MODERN
echo     Sistem Terpadu: Toko Online + Kasir POS + Admin
echo ========================================================
echo.
echo [1/3] Memeriksa direktori kerja proyek...
echo       Lokasi: %~dp0
echo.

:: 2. Deteksi Node.js di sistem
echo [2/3] Memeriksa runtime Node.js...
set "NODE_CMD="

:: Cek apakah 'node' langsung ada di PATH
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
    goto :node_found
)

:: Cek lokasi instalasi standar Windows jika belum masuk ke PATH
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto :node_found
)

if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto :node_found
)

if exist "%LocalAppData%\Programs\node\node.exe" (
    set "NODE_CMD=%LocalAppData%\Programs\node\node.exe"
    set "PATH=%LocalAppData%\Programs\node;%PATH%"
    goto :node_found
)

if exist "%AppData%\nvm\current\node.exe" (
    set "NODE_CMD=%AppData%\nvm\current\node.exe"
    set "PATH=%AppData%\nvm\current;%PATH%"
    goto :node_found
)

if exist "%ProgramW6432%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramW6432%\nodejs\node.exe"
    set "PATH=%ProgramW6432%\nodejs;%PATH%"
    goto :node_found
)

:: Jika Node.js belum terpasang sama sekali
echo.
echo ========================================================
echo  [PERINGATAN] Node.js belum terpasang di komputer ini!
echo ========================================================
echo.
echo  Aplikasi website ini menggunakan Node.js (Zero-Dependencies,
echo  tanpa perlu instal library npm tambahan).
echo.
echo  Silakan unduh dan instal Node.js versi LTS dari:
echo  https://nodejs.org/
echo.
set /p UNDUH="Apakah ingin membuka halaman unduh Node.js sekarang? (Y/T): "
if /i "%UNDUH%"=="Y" (
    start https://nodejs.org/
)
echo.
echo Tekan tombol apa saja untuk menutup...
pause >nul
exit /b 1

:node_found
echo       Status: Node.js TERSEDIA
for /f "tokens=*" %%v in ('%NODE_CMD% -v 2^>nul') do echo       Versi : %%v
echo.

:: 3. Konfigurasi Port Server (Default 8080 atau bisa di-override: start.bat 3000)
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

echo [3/3] Memulai server pada Port %PORT%...
echo.
echo --------------------------------------------------------
echo   Fitur Portabel Aktif:
echo   - Berjalan mandiri tanpa dependensi luar (Zero Dependencies)
echo   - Jika port %PORT% sedang dipakai, otomatis beralih ke port berikutnya
echo   - Browser akan otomatis terbuka ke website yang aktif
echo --------------------------------------------------------
echo.
echo   [Petunjuk Login Akun Demo]
echo   * Kasir POS   : kasir / kasir123  (atau klik Quick Fill)
echo   * Master Admin: admin / admin123  (atau klik Quick Fill)
echo --------------------------------------------------------
echo.
echo Menjalankan server... Tekan Ctrl + C untuk mematikan.
echo ========================================================
echo.

:: 4. Jalankan Server Node
"%NODE_CMD%" server.js %PORT%

:: 5. Jika server berhenti
echo.
echo ========================================================
echo  Server telah dihentikan.
echo ========================================================
pause
