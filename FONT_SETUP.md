# Font Setup Documentation

## Overview
DoujinDesk menggunakan font **Figtree** sebagai font utama dengan sistem fallback yang robust untuk memastikan konsistensi tampilan.

## Font Loading Strategy

### 1. Primary: Google Fonts
- Font Figtree dimuat dari Google Fonts CDN
- Lokasi: `index.html` dengan preconnect untuk optimasi
- URL: `https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,300..900;1,300..900&display=swap`

### 2. Fallback: Local CSS
- File lokal: `src/assets/fonts/figtree.css`
- Berisi definisi @font-face yang sama dengan Google Fonts
- Diimpor di `src/index.css` sebagai backup

### 3. System Font Fallback
Jika Figtree tidak tersedia, sistem akan menggunakan:
- **Sans-serif**: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', dll.
- **Serif**: Georgia, 'Times New Roman', Times, serif
- **Monospace**: 'Fira Code', 'Consolas', 'Monaco', dll.

## Font Monitoring

### FontLoader Component
- Lokasi: `src/components/FontLoader.tsx`
- Fungsi: Memantau status loading font dan mendeteksi fallback
- Menambahkan attribute `data-font-status` ke body element

### Status Font
- `loading`: Font sedang dimuat
- `loaded`: Font Figtree berhasil dimuat
- `fallback`: Menggunakan system font fallback

## CSS Variables

```css
:root {
  --font-sans: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
  --font-serif: 'Figtree', Georgia, 'Times New Roman', Times, serif;
  --font-mono: 'Figtree', 'Fira Code', 'Consolas', 'Monaco', ...;
}
```

## Troubleshooting

### Font Tidak Muncul
1. Periksa koneksi internet untuk Google Fonts
2. Cek console browser untuk error loading
3. Verifikasi `data-font-status` di body element
4. Pastikan file `src/assets/fonts/figtree.css` ada

### Debugging
```javascript
// Cek status font di browser console
console.log(document.body.getAttribute('data-font-status'));

// Cek apakah font tersedia
console.log(document.fonts.check('16px Figtree'));
```

### Performance
- Google Fonts menggunakan `font-display: swap` untuk loading yang cepat
- Preconnect ke fonts.googleapis.com dan fonts.gstatic.com
- Local fallback mengurangi dependency pada CDN eksternal

## File Structure
```
src/
├── assets/
│   └── fonts/
│       └── figtree.css          # Local font definitions
├── components/
│   └── FontLoader.tsx           # Font monitoring component
├── index.css                    # Main CSS with font imports
└── App.tsx                      # FontLoader integration

index.html                       # Google Fonts preconnect
tailwind.config.js              # Font family configuration
```

## Best Practices

1. **Selalu gunakan fallback fonts** untuk kompatibilitas
2. **Monitor font loading** dengan FontLoader component
3. **Test offline** untuk memastikan fallback bekerja
4. **Gunakan font-display: swap** untuk performa yang baik
5. **Preconnect ke font CDN** untuk optimasi loading