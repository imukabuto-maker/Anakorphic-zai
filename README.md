# Shadow Box Generator

Wall-Wash Anamorphic Shadow Box Generator.

## Deploy ke GitHub Pages (dari iPhone, tanpa laptop)

Project ini sudah dilengkapi GitHub Actions workflow (`.github/workflows/deploy.yml`)
yang otomatis build & deploy setiap kali kamu push ke branch `main`.
Semua proses build terjadi di server GitHub, jadi kamu **tidak perlu install
Node.js atau menjalankan perintah apa pun di iPhone**.

### 1. Buat repo di GitHub (pakai app GitHub atau Safari)

1. Buka app **GitHub** (atau github.com lewat Safari) → login.
2. Tap **+** → **New repository**.
3. Beri nama, misalnya `shadow-box`. Set ke **Public** (perlu public untuk
   GitHub Pages gratis, kecuali kamu punya GitHub Pro/Team).
4. Jangan centang "Add a README" (biar tidak konflik nanti).
5. Tap **Create repository**.

### 2. Upload isi folder project ini

Cara paling gampang dari iPhone: pakai **Working Copy** (app Git gratis di
App Store) atau upload lewat browser Safari:

**Opsi A — lewat Safari (paling simpel):**
1. Buka repo yang baru dibuat di github.com.
2. Tap menu **Add file → Upload files**.
3. Buka app **Files** di iPhone, browse ke folder project ini (hasil unzip),
   lalu pilih semua file & folder (termasuk folder `.github` — di iOS folder
   yang diawali titik kadang disembunyikan Files app; kalau begitu pakai
   Opsi B di bawah).
4. Drag/pilih ke halaman upload GitHub, lalu **Commit changes** langsung ke
   branch `main`.

**Opsi B — pakai app Working Copy (lebih andal, terutama untuk folder `.github`):**
1. Install **Working Copy** dari App Store (gratis untuk pakai dasar).
2. Buka Working Copy → hubungkan akun GitHub kamu (Settings → Connect to GitHub).
3. Clone repo kosong yang baru dibuat.
4. Dari app **Files**, share/copy semua isi folder project ini ke dalam repo
   yang di-clone tadi di Working Copy (Working Copy expose dirinya sebagai
   lokasi di Files app, jadi bisa "Save to Files" ke sana, atau import zip
   lalu extract di dalam Working Copy).
5. Di Working Copy: **Changes → Commit** → tulis pesan commit → **Push**.

Setelah file ter-push ke `main`, buka tab **Actions** di repo GitHub —
kamu akan lihat workflow "Deploy to GitHub Pages" berjalan otomatis
(sekitar 1-2 menit).

### 3. Aktifkan GitHub Pages (sekali saja)

1. Di repo → **Settings → Pages**.
2. Di bagian **Build and deployment → Source**, pilih **GitHub Actions**
   (bukan "Deploy from a branch").
3. Simpan. Setelah workflow selesai jalan, situs akan tersedia di:
   `https://<username-kamu>.github.io/<nama-repo>/`

### 4. Update project berikutnya

Setiap kali kamu edit file (lewat Working Copy, app GitHub, atau editor
web github.dev) dan push/commit ke `main`, GitHub Actions otomatis build
ulang dan deploy — tidak perlu langkah manual lagi.

### Edit kode langsung dari iPhone

Untuk edit kode tanpa laptop, buka repo di Safari lalu ganti URL dari
`github.com/...` menjadi `github.dev/...` (atau tekan tombol `.` di
keyboard kalau ada) — ini membuka editor VS Code versi web yang jalan
penuh di browser, bisa edit banyak file lalu commit langsung dari situ.

## Development lokal (opsional, kalau nanti pakai komputer)

```bash
npm install
npm run dev       # jalan di http://localhost:3000
npm run build     # build ke folder dist/
npm run typecheck # cek error TypeScript
```
