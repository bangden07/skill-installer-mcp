# Risks

Dokumen ini mencatat risiko utama MVP Tahap 1 beserta mitigasinya.

## Severity Legend

- `High` - berpotensi menggagalkan core flow MVP
- `Medium` - mengganggu reliability atau UX
- `Low` - berdampak kecil atau bisa diterima sementara

---

## RISK-001 - Symlink restrictions di Windows

- Severity: `High`
- Likelihood: `High`

### Description
Sebagian environment Windows tidak mengizinkan pembuatan symlink tanpa privilege tertentu atau policy tertentu.

### Impact
- install mode `symlink` gagal
- beberapa adapter global/native export tidak bisa berjalan seperti rencana awal

### Mitigation
- wajib ada fallback `copy`
- tampilkan warning `COPY_FALLBACK_USED`
- test mode resolution khusus Windows
- gunakan `auto` sebagai default

### Owner
- installer/adapters

---

## RISK-002 - Perbedaan behavior real agent vs dokumentasi

- Severity: `High`
- Likelihood: `Medium`

### Description
Dokumentasi public agent bisa berbeda dengan perilaku runtime aktual atau berubah antar versi.

### Impact
- target path benar secara dokumen tapi tidak terbaca di runtime
- support matrix jadi kurang akurat

### Mitigation
- gunakan adapter verification
- buat smoke test nyata untuk 6 agent awal
- tandai limitation di compatibility matrix
- sediakan status `manual_required` jika perlu

### Owner
- adapter layer

---

## RISK-003 - Registry source berubah atau tidak stabil

- Severity: `Medium`
- Likelihood: `Medium`

### Description
`skills.sh` atau source registry lain bisa berubah API, struktur, atau availability.

### Impact
- recommendation/discovery gagal
- install dari remote source terganggu

### Mitigation
- dukung multiple source: local, git, `skills.sh`
- buat `registryResolver` yang tidak hardcoded ke satu provider
- tambahkan cache metadata jika perlu
- jangan jadikan `skills.sh` satu-satunya jalur install

### Owner
- registry layer

---

## RISK-004 - Metadata skill tidak cukup bagus untuk matching

- Severity: `Medium`
- Likelihood: `High`

### Description
Sebagian skill mungkin punya `description` yang terlalu umum, tidak konsisten, atau kurang berguna untuk recommendation.

### Impact
- hasil recommendation kurang relevan
- user harus memilih skill manual lebih sering

### Mitigation
- gunakan hybrid ranking
- baca context project sebagai input tambahan
- tampilkan alasan recommendation agar transparan
- izinkan install dari selector manual

### Owner
- recommender layer

---

## RISK-005 - Drift antara manifest dan filesystem

- Severity: `High`
- Likelihood: `Medium`

### Description
Target agent atau canonical skill bisa diubah manual di luar installer, sehingga manifest tidak lagi akurat.

### Impact
- status install salah
- sync/update/remove bisa menghasilkan behavior tak terduga

### Mitigation
- `doctor_skills` wajib cek filesystem nyata
- `sync_skills` dan `verifyInstall` tidak boleh hanya percaya manifest
- gunakan hash canonical
- update manifest hanya setelah operasi utama berhasil cukup jauh

### Owner
- state + installer

---

## RISK-006 - Partial failure saat install multi-agent

- Severity: `Medium`
- Likelihood: `High`

### Description
Canonical install bisa sukses, tetapi satu atau beberapa target agent gagal dipasang.

### Impact
- state install tidak seragam
- UX membingungkan jika hasil tidak dilaporkan dengan jelas

### Mitigation
- izinkan `partial` result
- laporkan `installed`, `skipped`, `failed` secara terpisah
- manifest simpan status per target
- jangan rollback canonical pada MVP, tapi tampilkan warning jelas

### Owner
- installer core

---

## RISK-007 - Atomic write tidak konsisten

- Severity: `High`
- Likelihood: `Low`

### Description
Jika write ke manifest atau canonical store tidak atomic, interruption bisa merusak state.

### Impact
- manifest corrupt
- canonical skill setengah tertulis
- sync/update gagal

### Mitigation
- gunakan `temp -> rename`
- install canonical lewat staging dir
- save manifest via atomic JSON write
- gunakan lock file untuk write operations

### Owner
- state layer

---

## RISK-008 - Copy mode menimbulkan out-of-sync target

- Severity: `Medium`
- Likelihood: `High`

### Description
Jika target dipasang dengan `copy`, perubahan canonical di masa depan tidak otomatis tercermin.

### Impact
- target copy bisa stale
- verify harus lebih hati-hati

### Mitigation
- `verifyCopiedContent`
- `sync_skills` harus mendukung `recopy`
- manifest simpan mode target
- `doctor_skills` memberi issue `OUT_OF_SYNC_COPY`

### Owner
- adapter + installer

---

## RISK-009 - Skill berisi file non-portable atau feature spesifik agent

- Severity: `Medium`
- Likelihood: `Medium`

### Description
Skill bisa mengandung metadata atau struktur yang tidak portable antar agent.

### Impact
- skill tetap terpasang tetapi behavior bisa degrade di sebagian target

### Mitigation
- deteksi `nonPortableFields`
- tambahkan warning compatibility
- jangan blok install jika masih aman
- dokumentasikan limitation per agent

### Owner
- parser + adapter

---

## RISK-010 - `mcp.json` menimbulkan ekspektasi berlebih

- Severity: `Medium`
- Likelihood: `Medium`

### Description
User mungkin mengira skill yang memiliki `mcp.json` akan otomatis membuat MCP tools aktif di host.

### Impact
- misunderstanding terhadap capability Tahap 1

### Mitigation
- tampilkan warning/info `BUNDLED_MCP_PRESENT`
- dokumentasikan bahwa Tahap 1 hanya preserve file
- jelaskan bahwa host registration masuk Tahap 2

### Owner
- product/docs

---

## RISK-011 - Project analyzer terlalu agresif atau salah baca stack

- Severity: `Low`
- Likelihood: `Medium`

### Description
Analyzer bisa salah mendeteksi framework atau memberi signal yang kurang akurat.

### Impact
- recommendation sedikit meleset
- tapi install manual tetap bisa jalan

### Mitigation
- analyzer hanya jadi signal tambahan
- recommendation tetap bisa berbasis explicit user goal
- jangan bergantung penuh pada analyzer
- simpan rules-based logic sederhana dulu

### Owner
- analyzer + recommender

---

## RISK-012 - Scope creep ke host registration terlalu cepat

- Severity: `High`
- Likelihood: `Medium`

### Description
Ada godaan untuk langsung menambahkan registrasi MCP host sebelum Tahap 1 stabil.

### Impact
- MVP tertunda
- kompleksitas meningkat drastis
- debugging makin sulit

### Mitigation
- kunci scope Tahap 1
- catat ide Tahap 2 di docs, bukan di implementation backlog sekarang
- semua perubahan yang menyentuh host config dianggap out of scope

### Owner
- product/architecture

---

## RISK-013 - Planning docs tidak di-maintain

- Severity: `Medium`
- Likelihood: `Medium`

### Description
Karena planning disimpan lokal di `planning/`, ada risiko dokumen tidak di-update setelah implementasi berjalan.

### Impact
- keputusan dan real implementation drift
- onboarding ke project jadi lebih sulit

### Mitigation
- update `decisions.md` saat ada perubahan arsitektur
- update `backlog.md` dan `daily/` secara rutin
- gunakan `planning/README.md` sebagai index utama

### Owner
- project owner

---

## RISK-014 - Test coverage kurang pada flow adapter

- Severity: `High`
- Likelihood: `Medium`

### Description
Adapter terlihat sederhana tetapi sebenarnya rawan edge case filesystem.

### Impact
- bug install/sync/remove baru muncul saat runtime nyata
- compatibility antar agent jadi rapuh

### Mitigation
- prioritaskan test pada `BaseAgentAdapter`
- buat integration tests untuk direct/symlink/copy
- buat smoke test untuk 6 adapter awal
- jangan menambah banyak agent sebelum test dasar stabil

### Owner
- adapter/tests

---

## Highest Priority Risks

Risiko yang harus diperhatikan paling awal:
1. symlink restrictions di Windows
2. drift antara manifest dan filesystem
3. partial failure saat install multi-agent
4. perbedaan behavior real agent vs dokumentasi
5. kurangnya test pada adapter layer

## Current Risk Posture

Kesimpulan saat ini:
- MVP tetap sangat feasible
- risiko terbesar ada di filesystem behavior dan compatibility nuance
- mitigasi utama ada pada:
  - fallback `copy`
  - `doctor_skills`
  - `sync_skills`
  - atomic state writes
  - adapter tests
