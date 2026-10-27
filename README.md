# Bot WhatsApp Konversi Gambar dan PDF

Bot WhatsApp untuk:
- Mengubah JPG/PNG menjadi PDF.
- Menggabungkan beberapa gambar menjadi satu PDF.
- Mengubah setiap halaman PDF menjadi JPG.
- Menentukan nama file hasil konversi lewat chat.

Bot menggunakan Node.js, Baileys, pdf-lib, dan Poppler. Konversi berjalan di komputer/server tempat bot dijalankan, tanpa API iLovePDF.

> Baileys bukan API resmi WhatsApp. Penggunaan dapat menyebabkan koneksi terputus atau akun dibatasi. Gunakan nomor khusus untuk percobaan.

## Cara menggunakan bot

Kirim pesan dari nomor lain ke nomor WhatsApp bot. Pesan yang dikirim akun bot sendiri diabaikan.

### Gambar menjadi PDF

1. Kirim gambar JPG/PNG.
2. Tunggu konfirmasi bot.
3. Untuk beberapa gambar, kirim satu per satu dan tunggu konfirmasi setiap kiriman.
4. Ketik `pdf`.
5. Setelah bot meminta nama, kirim nama file tanpa ekstensi.
6. Bot mengirim hasil PDF.

Contoh:

```text
Pengguna: [kirim gambar]
Bot: 1 gambar tersimpan. Kirim gambar lain atau ketik pdf.

Pengguna: pdf
Bot: Mau diberi nama apa untuk PDF-nya?

Pengguna: Tugas Kuliah
Bot: [Tugas Kuliah.pdf]
```

Kirim gambar sebagai **dokumen** untuk menjaga kualitas asli. Urutan halaman mengikuti urutan gambar diterima bot.

### PDF menjadi JPG

1. Kirim dokumen PDF.
2. Tunggu konfirmasi bot.
3. Ketik `jpg`.
4. Setelah bot meminta nama, kirim nama file tanpa ekstensi.
5. Bot mengirim JPG untuk setiap halaman.

Contoh:

```text
Pengguna: [kirim PDF]
Bot: PDF tersimpan. Ketik jpg untuk mengubahnya menjadi gambar.

Pengguna: jpg
Bot: Mau diberi nama apa untuk hasil JPG?

Pengguna: Materi Kuliah
Bot: [Materi Kuliah-1.jpg]
Bot: [Materi Kuliah-2.jpg]
```

PDF menjadi JPG berarti merender setiap halaman menjadi gambar, bukan mengekstrak gambar asli yang tertanam dalam PDF.

### Daftar perintah

| Perintah | Fungsi |
|---|---|
| `menu` atau `help` | Menampilkan bantuan |
| `pdf` | Meminta konversi gambar menjadi PDF |
| `jpg` | Meminta konversi PDF menjadi JPG |
| `hapus` | Menghapus kiriman sementara dan membatalkan permintaan nama |

Perintah juga bisa menggunakan `/`, misalnya `/pdf`.

Perintah dikirim sebagai pesan terpisah setelah file, bukan melalui caption.

### Batas penggunaan bawaan

- Maksimal 10 MB per file.
- Maksimal 10 gambar untuk satu PDF.
- Maksimal 20 halaman PDF untuk konversi JPG.
- Format gambar yang didukung: JPG dan PNG.
- Nama hasil maksimal 80 karakter.
- Nama file tidak boleh mengandung karakter `<>:"/\|?*` atau nama khusus Windows seperti `CON` dan `NUL`.
- Hanya chat pribadi; grup tidak diproses.
- PDF baru menggantikan PDF sebelumnya yang belum dikonversi.
- Kiriman sementara kedaluwarsa setelah sekitar 15 menit tidak aktif.
- Kiriman disimpan di RAM dan hilang ketika bot berhenti atau restart.

Saat bot meminta nama hasil, pesan teks berikutnya dianggap nama file, kecuali perintah bantuan atau `hapus`.

## Kebutuhan untuk menjalankan bot sendiri

- Node.js 24 LTS disarankan.
- npm.
- Poppler: `pdfinfo` dan `pdftoppm`.
- Internet.
- Nomor WhatsApp yang dapat ditautkan melalui QR.
- Komputer atau VPS yang tetap menyala.

RAM 1 GB cukup untuk percobaan ringan. Penggunaan banyak pengguna membutuhkan pembatasan dan pengujian tambahan.

## Unduh proyek

Dengan Git:

```bash
git clone https://github.com/wndowee/Bot-WA-Konversi-PDF-JPG
cd Bot-WA-Konversi-PDF-JPG
```

Tanpa Git, pilih **Code → Download ZIP** di GitHub, ekstrak, lalu buka terminal di folder proyek.

## Pemasangan Windows

### Pilihan A: Skrip setup

Jika repository menyediakan `setup.ps1`, buka PowerShell di folder proyek:

```powershell
.\setup.ps1
```

Skrip memasang dependensi bot, menyiapkan Poppler, dan menambahkan Poppler ke PATH pengguna. Node.js akan dicoba dipasang lewat WinGet jika belum tersedia.

Baca isi skrip sebelum menjalankannya. Pemasangan Node.js mungkin meminta persetujuan Administrator.

Jika PowerShell memblokir `setup.ps1`, pengaturan berikut mengizinkan skrip lokal untuk akun pengguna saat ini:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Jangan gunakan `Unrestricted` atau menonaktifkan keamanan sistem secara menyeluruh.

Jika Node.js gagal dipasang lewat skrip, pasang Node.js 24 LTS dari https://nodejs.org/, buka ulang terminal, lalu jalankan setup kembali.

### Pilihan B: Pemasangan manual

1. Pasang Node.js 24 LTS dari https://nodejs.org/.
2. Unduh ZIP Poppler Windows dari:
   https://github.com/oschwartz10612/poppler-windows/releases
3. Ekstrak seluruh ZIP. Jangan memindahkan executable sendirian.
4. Tambahkan folder yang berisi `pdfinfo.exe` dan `pdftoppm.exe` ke PATH pengguna.
5. Buka ulang PowerShell atau VS Code.
6. Pasang dependensi:

```powershell
npm.cmd install
```

Jika proyek menyediakan `package-lock.json` yang sesuai dengan `package.json`, gunakan `npm.cmd ci` untuk pemasangan sesuai lockfile.

### Verifikasi

```powershell
node -v
npm.cmd -v
pdfinfo -v
pdftoppm -v
```

### Jalankan

```powershell
node .\bot.mjs
```

## Pemasangan Ubuntu

Gunakan akun non-root untuk menjalankan bot. Pemasangan paket sistem membutuhkan izin admin.

### 1. Pasang Poppler dan kebutuhan pendukung

```bash
sudo apt update
sudo apt install -y poppler-utils git curl ca-certificates build-essential
```

### 2. Pasang Node.js

Pasang Node.js 24 LTS menggunakan NVM, mengikuti panduan resmi:

https://github.com/nvm-sh/nvm#installing-and-updating

Setelah NVM tersedia:

```bash
nvm install 24
nvm alias default 24
```

### 3. Pasang dependensi proyek

Dari folder repository:

```bash
npm install
```

Jika tersedia lockfile yang sesuai, gunakan `npm ci`.

### 4. Verifikasi dan jalankan

```bash
node -v
npm -v
pdfinfo -v
pdftoppm -v
node bot.mjs
```

## Konfigurasi Poppler lintas OS

Kode harus memanggil program lewat PATH:

```js
await execFileAsync("pdfinfo", [inputPath], options);
await execFileAsync("pdftoppm", args, options);
```

Jangan memakai lokasi pribadi seperti `C:\Users\...`, deklarasi `POPPLER_BIN` khusus komputer tertentu, atau ekstensi `.exe` pada kode lintas OS.

## Menautkan WhatsApp

1. Jalankan `node bot.mjs`.
2. QR muncul di terminal.
3. Buka WhatsApp pada HP akun bot.
4. Pilih **Perangkat tertaut → Tautkan perangkat**.
5. Pindai QR.
6. Tunggu pesan `Bot terhubung.`.

Folder `auth` dibuat otomatis untuk menyimpan kredensial sesi.

**Jangan membagikan, mengunggah, atau menyertakan folder `auth` dalam repository.**

Hentikan bot dengan `Ctrl+C`.

## Menjalankan terus di VPS

Setelah bot berhasil diuji, hentikan proses manual dengan `Ctrl+C`.

Sebagai pengguna non-root yang sama:

```bash
npm install -g pm2
pm2 start bot.mjs --name bot-wa --time
pm2 save
pm2 status
```

Status proses harus `online`.

Perintah pengelolaan:

```bash
pm2 logs bot-wa --lines 50
pm2 restart bot-wa
pm2 stop bot-wa
```

Untuk otomatis berjalan setelah VPS restart:

```bash
pm2 startup
```

Jalankan perintah startup yang dihasilkan PM2 menggunakan izin admin, lalu pastikan daftar proses disimpan dengan `pm2 save` sebagai pengguna bot.

Jika memakai NVM dan mengganti versi Node.js, konfigurasi startup PM2 mungkin perlu dibuat ulang.

Laptop boleh dimatikan jika bot sudah berjalan di VPS. VPS tetap harus menyala dan memiliki internet.

Jangan menjalankan dua proses bot menggunakan folder sesi yang sama.

## Pemecahan masalah

### `npm.ps1 cannot be loaded`

Di Windows, gunakan:

```powershell
npm.cmd install
```

### `Cannot find module ... bot.mjs`

Pastikan terminal berada di folder proyek dan nama file benar, bukan `bot.mjs.txt`.

### `spawn pdfinfo ENOENT`

`pdfinfo` belum ditemukan. Pastikan Poppler terpasang dan folder executable masuk PATH. Restart terminal dan proses bot setelah mengubah PATH.

### `pdftoppm is not recognized`

Tambahkan folder Poppler yang berisi `pdftoppm.exe` ke PATH Windows, lalu buka ulang terminal.

### `pm2: command not found`

Pasang PM2 sebagai pengguna bot:

```bash
npm install -g pm2
```

### `Akun keluar`

Hentikan bot. Pindahkan atau ganti nama folder `auth` lama, lalu jalankan bot dan tautkan ulang melalui QR.

Cadangan `auth` lama tetap sensitif. Jangan unggah ke GitHub.

### Bot tidak membalas

Periksa:
- Proses bot masih berjalan.
- Log menampilkan koneksi berhasil.
- Pesan dikirim dari nomor lain, bukan akun bot sendiri.
- Pesan dikirim lewat chat pribadi.
- Bot tidak sedang memproses kiriman sebelumnya.

## Privasi dan keamanan

- Gunakan bot hanya dengan izin pemilik akun dan server.
- Jangan mengunggah folder `auth`, private key SSH, password, atau file pengguna.
- Jangan membagikan QR login.
- Periksa log sebelum membagikannya. Dependensi dapat mencetak materi kunci enkripsi.
- Gambar dan PDF masuk disimpan sementara di RAM.
- Konversi PDF ke JPG memakai folder sementara yang dibersihkan setelah proses melalui blok `finally`; gangguan proses atau server dapat meninggalkan sisa file.
- Jalankan konversi dengan akun terbatas, bukan root.
- Untuk layanan publik, tambahkan antrean global, batas pengguna, batas RAM, dan isolasi proses konversi. Batas ukuran file saja tidak cukup melindungi server dari file berbahaya.

## Catatan

Proyek ini untuk pembelajaran dan percobaan. Koneksi WhatsApp dan keberhasilan konversi tidak dijamin selalu tersedia.