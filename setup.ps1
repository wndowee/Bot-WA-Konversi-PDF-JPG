$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

try {
    # 1. Node.js
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw "WinGet belum tersedia. Pasang App Installer dari Microsoft Store, lalu jalankan setup lagi."
        }

        Write-Host "Memasang Node.js 24 LTS..."

        winget.exe install --id OpenJS.NodeJS.LTS --exact `
            --version 24.22.1 `
            --accept-package-agreements `
            --accept-source-agreements

        if ($LASTEXITCODE -ne 0) {
            throw "Pemasangan Node.js gagal. Pasang Node.js 24 LTS dari https://nodejs.org/ lalu jalankan setup lagi."
        }

        Refresh-Path
    }

    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
        throw "Node.js belum terbaca. Buka ulang PowerShell, lalu jalankan setup lagi."
    }

    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm belum tersedia. Perbaiki pemasangan Node.js."
    }

    # 2. Dependensi proyek
    if (-not (Test-Path ".\package.json")) {
        npm.cmd init -y

        if ($LASTEXITCODE -ne 0) {
            throw "Pembuatan package.json gagal."
        }
    }

    Write-Host "Memasang dependensi bot..."

    npm.cmd install @whiskeysockets/baileys pino qrcode-terminal pdf-lib

    if ($LASTEXITCODE -ne 0) {
        throw "Pemasangan dependensi gagal. Periksa pesan npm di atas."
    }

    # 3. Cari Poppler yang sudah ada dalam proyek
    $pdfinfo = Get-ChildItem -Path $PSScriptRoot `
        -Filter "pdfinfo.exe" -File -Recurse |
        Where-Object {
            $_.FullName -notmatch "\\node_modules\\" -and
            (Test-Path (Join-Path $_.DirectoryName "pdftoppm.exe"))
        } |
        Select-Object -First 1

    # Kalau tidak ditemukan dalam proyek, cek PATH
    if (-not $pdfinfo) {
        $command = Get-Command pdfinfo.exe -ErrorAction SilentlyContinue

        if ($command) {
            $candidate = Get-Item $command.Source

            if (Test-Path (Join-Path $candidate.DirectoryName "pdftoppm.exe")) {
                $pdfinfo = $candidate
            }
        }
    }

    # 4. Unduh Poppler jika belum tersedia
    if (-not $pdfinfo) {
        Write-Host "Mengunduh Poppler Windows..."

        $headers = @{ "User-Agent" = "Bot-WA-Setup" }

        $release = Invoke-RestMethod `
            -Uri "https://api.github.com/repos/oschwartz10612/poppler-windows/releases/latest" `
            -Headers $headers

        $asset = $release.assets |
            Where-Object { $_.name -match "^Release.*\.zip$" } |
            Select-Object -First 1

        if (-not $asset) {
            throw "ZIP Poppler tidak ditemukan pada rilis terbaru."
        }

        $zipPath = Join-Path $PSScriptRoot "poppler-download.zip"
        $popplerFolder = Join-Path $PSScriptRoot "poppler"

        Invoke-WebRequest `
            -Uri $asset.browser_download_url `
            -OutFile $zipPath `
            -Headers $headers

        Expand-Archive -Path $zipPath -DestinationPath $popplerFolder -Force

        $pdfinfo = Get-ChildItem -Path $popplerFolder `
            -Filter "pdfinfo.exe" -File -Recurse |
            Where-Object {
                Test-Path (Join-Path $_.DirectoryName "pdftoppm.exe")
            } |
            Select-Object -First 1
    }

    if (-not $pdfinfo) {
        throw "pdfinfo.exe dan pdftoppm.exe tidak ditemukan."
    }

    # 5. Tambahkan Poppler ke PATH pengguna, tanpa menghapus entri lama
    $popplerBin = $pdfinfo.DirectoryName
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")

    $entries = @(
        $userPath -split ";" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($entries -notcontains $popplerBin) {
        $newPath = ($entries + $popplerBin) -join ";"

        [Environment]::SetEnvironmentVariable(
            "Path",
            $newPath,
            "User"
        )
    }

    Refresh-Path

    # 6. Verifikasi
    node.exe -v
    if ($LASTEXITCODE -ne 0) { throw "Node.js gagal dijalankan." }

    npm.cmd -v
    if ($LASTEXITCODE -ne 0) { throw "npm gagal dijalankan." }

    & (Join-Path $popplerBin "pdfinfo.exe") -v
    if ($LASTEXITCODE -ne 0) { throw "pdfinfo gagal dijalankan." }

    & (Join-Path $popplerBin "pdftoppm.exe") -v
    if ($LASTEXITCODE -ne 0) { throw "pdftoppm gagal dijalankan." }

    Write-Host ""
    Write-Host "Setup selesai."
    Write-Host "Poppler: $popplerBin"
    Write-Host "Jalankan bot: node .\bot.mjs"
}
catch {
    Write-Host ""
    Write-Host "Setup gagal: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}