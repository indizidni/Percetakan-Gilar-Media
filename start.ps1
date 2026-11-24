# ========================================================
#  DIGITAL MEDIA — PORTABLE STARTUP SCRIPT (PowerShell)
#  Bisa dijalankan di mana pun: Laptop, PC, Flashdisk,
#  Desktop, Downloads, Drive C:, D:, E:, dll.
# ========================================================

Set-Location -LiteralPath $PSScriptRoot

Clear-Host
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       DIGITAL MEDIA - DIGITAL PRINTING SOLUTION       " -ForegroundColor Yellow
Write-Host "    Sistem Terpadu: Toko Online + Kasir POS + Admin    " -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[1/3] Memeriksa direktori kerja proyek..." -ForegroundColor Gray
Write-Host "      Lokasi: $PSScriptRoot" -ForegroundColor Green
Write-Host ""

# 2. Cek runtime Node.js
Write-Host "[2/3] Memeriksa runtime Node.js..." -ForegroundColor Gray
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCmd) {
    $commonPaths = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\node\node.exe",
        "$env:APPDATA\nvm\current\node.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $nodeCmd = $p
            $env:PATH = "$(Split-Path $p);$env:PATH"
            break
        }
    }
}

if (-not $nodeCmd) {
    Write-Host ""
    Write-Host "[PERINGATAN] Node.js belum terpasang di komputer ini!" -ForegroundColor Red
    Write-Host "Aplikasi website ini membutuhkan Node.js (Zero-Dependencies)." -ForegroundColor Yellow
    Write-Host "Download gratis di: https://nodejs.org/" -ForegroundColor Cyan
    Write-Host ""
    $open = Read-Host "Buka halaman download Node.js sekarang? (Y/T)"
    if ($open -eq 'Y' -or $open -eq 'y') {
        Start-Process "https://nodejs.org/"
    }
    Read-Host "Tekan Enter untuk keluar..."
    exit 1
}

$nodeVer = & node -v
Write-Host "      Status: Node.js TERSEDIA ($nodeVer)" -ForegroundColor Green
Write-Host ""

# 3. Port configuration
$port = if ($args[0]) { $args[0] } else { "8080" }
Write-Host "[3/3] Memulai server pada Port $port..." -ForegroundColor Gray
Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Fitur Portabel Aktif:" -ForegroundColor White
Write-Host "  - Berjalan mandiri tanpa dependensi luar (Zero Dependencies)" -ForegroundColor Gray
Write-Host "  - Jika port bentrok, otomatis beralih ke port bebas berikutnya" -ForegroundColor Gray
Write-Host "  - Browser akan otomatis terbuka ke website yang aktif" -ForegroundColor Gray
Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Menjalankan server... Tekan Ctrl + C untuk mematikan." -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

& node server.js $port

