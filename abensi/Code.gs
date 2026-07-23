/**
 * ABSENSI SHOLAT — Backend Google Apps Script
 * -------------------------------------------------------------
 * Cara pasang:
 * 1. Buka spreadsheet ABSENSI_MUSHOLA Anda.
 * 2. Menu: Extensions > Apps Script.
 * 3. Hapus isi default, lalu tempel SELURUH isi file ini.
 * 4. Klik Deploy > New deployment.
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Klik Deploy, salin URL Web App yang muncul
 *    (bentuknya: https://script.google.com/macros/s/XXXXX/exec)
 * 6. Tempelkan URL itu ke aplikasi HTML (bagian CONFIG.SCRIPT_URL
 *    atau kotak "Alamat Server" di layar login).
 * -------------------------------------------------------------
 * Struktur sheet yang dipakai:
 *   Sheet1 : A=USER   B=PASSWORD C=STATUS (Admin/Imam/Petugas)
 *   Siswa  : A=NISN   B=Nama     C=Kelas
 *   Sheet3 : A=Timestamp B=NISN  C=Status (Sholat/Hadir)
 */

function doGet(e) { return handle(e); }
function doPost(e) { return handle(e); }

function handle(e) {
  var data = {};
  try {
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }
    var result;
    switch (data.action) {
      case 'login':
        result = login(data.username, data.password);
        break;
      case 'getSiswa':
        result = getSiswa();
        break;
      case 'recordAbsensi':
        result = recordAbsensi(data.nisn, data.status, data.petugas);
        break;
      case 'getKartu':
        result = getKartu(data.nisn, data.bulan, data.tahun);
        break;
      case 'getRekap':
        result = getRekap(data.bulan, data.tahun, data.kelas);
        break;
      case 'ping':
        result = { success: true, message: 'Server aktif' };
        break;
      default:
        result = { success: false, message: 'Aksi tidak dikenal: ' + data.action };
    }
    return output(result);
  } catch (err) {
    return output({ success: false, message: 'Error: ' + err.toString() });
  }
}

function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz() { return Session.getScriptTimeZone() || 'Asia/Jakarta'; }

function login(username, password) {
  var sheet = ss().getSheetByName('Sheet1');
  if (!sheet) return { success: false, message: 'Sheet1 tidak ditemukan' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var u = String(data[i][0] || '').trim();
    var p = String(data[i][1] || '');
    if (!u) continue;
    if (u.toLowerCase() === String(username || '').trim().toLowerCase() &&
        p === String(password || '')) {
      return { success: true, user: u, status: String(data[i][2] || 'Petugas') };
    }
  }
  return { success: false, message: 'Username atau password salah' };
}

function getSiswa() {
  var sheet = ss().getSheetByName('Siswa');
  if (!sheet) return { success: false, message: 'Sheet Siswa tidak ditemukan' };
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    out.push({
      nisn: String(data[i][0]).trim(),
      nama: String(data[i][1] || '').trim(),
      kelas: String(data[i][2] || '').trim()
    });
  }
  return { success: true, data: out };
}

function recordAbsensi(nisn, status, petugas) {
  if (!nisn || !status) return { success: false, message: 'Data tidak lengkap' };
  var sheet = ss().getSheetByName('Sheet3');
  if (!sheet) return { success: false, message: 'Sheet3 tidak ditemukan' };
  var now = new Date();
  var todayStr = Utilities.formatDate(now, tz(), 'yyyy-MM-dd');

  // Cegah dobel-catat status yang sama di hari yang sama
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var ts = data[i][0];
    if (!ts) continue;
    var rowDate = new Date(ts);
    var rowDateStr = Utilities.formatDate(rowDate, tz(), 'yyyy-MM-dd');
    if (rowDateStr === todayStr &&
        String(data[i][1]).trim() === String(nisn).trim() &&
        String(data[i][2]).trim() === String(status).trim()) {
      return { success: false, duplicate: true,
               message: 'Siswa ini sudah tercatat "' + status + '" hari ini' };
    }
  }

  sheet.appendRow([now, String(nisn).trim(), String(status).trim()]);
  return {
    success: true,
    message: 'Absensi tercatat',
    timestamp: Utilities.formatDate(now, tz(), 'yyyy-MM-dd HH:mm:ss')
  };
}

function getKartu(nisn, bulan, tahun) {
  var sheet = ss().getSheetByName('Sheet3');
  if (!sheet) return { success: false, message: 'Sheet3 tidak ditemukan' };
  var data = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var tsVal = data[i][0];
    if (!tsVal) continue;
    var d = new Date(tsVal);
    if (String(data[i][1]).trim() !== String(nisn).trim()) continue;
    if ((d.getMonth() + 1) !== Number(bulan) || d.getFullYear() !== Number(tahun)) continue;
    out.push({
      timestamp: Utilities.formatDate(d, tz(), 'yyyy-MM-dd HH:mm:ss'),
      tanggal: Utilities.formatDate(d, tz(), 'dd/MM/yyyy'),
      jam: Utilities.formatDate(d, tz(), 'HH:mm'),
      status: String(data[i][2]).trim()
    });
  }
  out.sort(function (a, b) { return a.timestamp.localeCompare(b.timestamp); });
  return { success: true, data: out };
}

function getRekap(bulan, tahun, kelas) {
  var siswaSheet = ss().getSheetByName('Siswa');
  var absenSheet = ss().getSheetByName('Sheet3');
  if (!siswaSheet || !absenSheet) {
    return { success: false, message: 'Sheet Siswa/Sheet3 tidak ditemukan' };
  }
  var siswaData = siswaSheet.getDataRange().getValues();
  var map = {};
  var list = [];
  for (var i = 1; i < siswaData.length; i++) {
    if (!siswaData[i][0]) continue;
    var kls = String(siswaData[i][2] || '').trim();
    if (kelas && kelas !== 'ALL' && kls !== kelas) continue;
    var rec = {
      nisn: String(siswaData[i][0]).trim(),
      nama: String(siswaData[i][1] || '').trim(),
      kelas: kls,
      sholat: 0,
      hadir: 0
    };
    map[rec.nisn] = rec;
    list.push(rec);
  }

  var absenData = absenSheet.getDataRange().getValues();
  for (var j = 1; j < absenData.length; j++) {
    var tsVal = absenData[j][0];
    if (!tsVal) continue;
    var d = new Date(tsVal);
    if ((d.getMonth() + 1) !== Number(bulan) || d.getFullYear() !== Number(tahun)) continue;
    var nisn = String(absenData[j][1]).trim();
    if (!map[nisn]) continue;
    var status = String(absenData[j][2]).trim();
    if (status === 'Sholat') map[nisn].sholat++;
    else if (status === 'Hadir') map[nisn].hadir++;
  }

  list.sort(function (a, b) {
    if (a.kelas === b.kelas) return a.nama.localeCompare(b.nama);
    return a.kelas.localeCompare(b.kelas);
  });

  return { success: true, data: list };
}
