@echo off
title Percetakan Gilar Media — Akses Online Publik (Data Seluler & Wi-Fi Kampus)

cd /d "%~dp0"
cls
echo ========================================================
echo   PERCETAKAN GILAR MEDIA — ONLINE PUBLIC ACCESS
echo   Buka Website dari Luar / Kampus via Data Seluler / Wi-Fi
echo ========================================================
echo.
echo [1/2] Mendapatkan IP Publik untuk verifikasi keamanan...
for /f "tokens=*" %%a in ('powershell -NoProfile -Command "(Invoke-WebRequest -Uri 'https://loca.lt/mytunnelpassword' -UseBasicParsing).Content.Trim()" 2^>nul') do set "TUNNEL_PASS=%%a"

if "%TUNNEL_PASS%"=="" set "TUNNEL_PASS=101.255.137.96"

echo       Password Tunnel Keamanan: %TUNNEL_PASS%
echo.
echo [2/2] Membuka Tunnel Publik yang TIDAK DIBLOKIR Operator Seluler...
echo.
echo ========================================================
echo   LINK WEBSITE ANDA (BISA DIBUKA DI HP & LAPTOP KAMPUS):
echo.
echo   1. Pelanggan    : https://gilar-media.loca.lt/
echo   2. Kasir POS    : https://gilar-media.loca.lt/kasir/
echo   3. Master Admin : https://gilar-media.loca.lt/admin/
echo.
echo   CATATAN PENTING:
echo   - Jika saat pertama kali dibuka di HP muncul "Tunnel Password",
echo     masukkan angka: %TUNNEL_PASS%
echo     lalu klik "Click to Submit" (hanya 1x di awal).
echo   - Fitur Auto-Reconnect aktif: Jika koneksi putus, otomatis menyambung kembali.
echo ========================================================
echo.
echo Menjalankan tunnel online... Tekan Ctrl + C untuk mematikan.
echo.

:tunnel_loop
cmd /c "npx --yes localtunnel --port 8080 --subdomain gilar-media"
echo.
echo [INFO] Sesi tunnel terputus, menyambungkan kembali dalam 3 detik...
timeout /t 3 /nobreak >nul
goto tunnel_loop
