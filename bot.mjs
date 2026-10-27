import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const POPPLER_BIN =
  "C:\\Users\\Administrator\\Documents\\Bot_WA\\poppler-26.09.0\\Library\\bin";

const execFileAsync = promisify(execFile);
const logger = pino({ level: "silent" });

// Batas untuk percobaan.
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 10;
const MAX_PDF_PAGES = 20;
const SESSION_TTL = 15 * 60 * 1000;

// Data terpisah untuk setiap chat pribadi.
const sessions = new Map();
const busy = new Set();

function getSession(chatId) {
  let session = sessions.get(chatId);

  if (!session) {
    session = {
      images: [],
      pdf: null,
      pendingConversion: null,
      updatedAt: Date.now(),
    };
    sessions.set(chatId, session);
  }

  session.updatedAt = Date.now();
  return session;
}

function detectType(buffer) {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(png)
  ) {
    return "png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  if (buffer.subarray(0, 5).toString() === "%PDF-") {
    return "pdf";
  }

  return null;
}

async function imagesToPdf(images) {
  const pdf = await PDFDocument.create();

  for (const item of images) {
    const image =
      item.type === "png"
        ? await pdf.embedPng(item.buffer)
        : await pdf.embedJpg(item.buffer);

    // Ukuran A4, gambar dipasang proporsional.
    const page = pdf.addPage([595.28, 841.89]);
    const margin = 24;
    const scale = Math.min(
      (page.getWidth() - margin * 2) / image.width,
      (page.getHeight() - margin * 2) / image.height
    );

    const width = image.width * scale;
    const height = image.height * scale;

    page.drawImage(image, {
      x: (page.getWidth() - width) / 2,
      y: (page.getHeight() - height) / 2,
      width,
      height,
    });
  }

  return Buffer.from(await pdf.save());
}

async function sendPdfAsImages(sock, chatId, buffer, outputName) {
  const folder = await fs.mkdtemp(
    path.join(os.tmpdir(), "wa-convert-")
  );

  try {
    const inputPath = path.join(folder, "input.pdf");
    const outputPrefix = path.join(folder, "halaman");

    await fs.writeFile(inputPath, buffer);

  const { stdout } = await execFileAsync(
     "pdfinfo",
      [inputPath],
      { timeout: 15_000, windowsHide: true }
    );

    const pages = Number(
      stdout.match(/^Pages:\s+(\d+)/m)?.[1]
    );

    if (!pages || pages > MAX_PDF_PAGES) {
      throw new Error(
        `PDF harus berisi 1–${MAX_PDF_PAGES} halaman.`
      );
    }

    await execFileAsync(
      "pdftoppm",
      [
        "-jpeg",
        "-r",
        "120",
        "-scale-to",
        "2000",
        inputPath,
        outputPrefix,
      ],
      { timeout: 60_000, windowsHide: true }
    );

    const files = (await fs.readdir(folder))
      .filter((name) => /^halaman-\d+\.jpg$/.test(name))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

    for (const name of files) {
      const image = await fs.readFile(path.join(folder, name));

      // Kirim sebagai dokumen agar JPG tidak dikompresi WhatsApp.
      await sock.sendMessage(chatId, {
        document: image,
        mimetype: "image/jpeg",
        fileName: name.replace(/^halaman/, outputName),
      });
    }
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
}

const help = [
  "Perintah bot:",
  "",
  "1. Kirim JPG/PNG, lalu ketik: pdf",
  "2. Kirim beberapa gambar, lalu ketik: pdf",
  "3. Kirim PDF, lalu ketik: jpg",
  "4. Ketik: hapus — kosongkan kiriman sementara",
  "",
  "Kirim gambar sebagai dokumen untuk menjaga kualitas.",
  "Batas: 10 MB/file, 10 gambar, 20 halaman PDF.",
  "Kiriman sementara kedaluwarsa setelah 15 menit tidak aktif.",
].join("\n");

function getOutputName(text) {
  // Ekstensi ditentukan bot, bukan pengguna.
  const name = text
    .trim()
    .replace(/\.(pdf|jpe?g)$/i, "")
    .trim();

  if (
    !name ||
    name.length > 80 ||
    /[<>:"/\\|?*\x00-\x1F]/.test(name) ||
    /[. ]$/.test(name) ||
    name === "." ||
    name === ".." ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name)
  ) {
    return null;
  }

  return name;
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./auth");

  const sock = makeWASocket({
    auth: state,
    logger,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("Pindai QR melalui menu Perangkat tertaut:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("Bot terhubung.");
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        setTimeout(() => {
          startBot().catch(console.error);
        }, 3000);
      } else {
        console.log(
          "Akun keluar. Hentikan bot dan tautkan ulang sesi."
        );
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const chatId = message.key.remoteJid;

      // Prototipe: hanya chat pribadi dari pengguna lain.
      if (
        !chatId ||
        message.key.fromMe ||
        chatId.endsWith("@g.us") ||
        chatId === "status@broadcast" ||
        !message.message
      ) {
        continue;
      }

      const reply = (text) =>
        sock.sendMessage(chatId, { text });

      if (busy.has(chatId)) {
        await reply(
          "Masih memproses kiriman sebelumnya. Tunggu balasan bot."
        );
        continue;
      }

      busy.add(chatId);

      try {
        const content = message.message;
        const media =
          content.imageMessage || content.documentMessage;

        if (media) {
          const reportedSize = Number(media.fileLength || 0);

          if (reportedSize > MAX_FILE_SIZE) {
            await reply("File terlalu besar. Maksimal 10 MB.");
            continue;
          }

          const buffer = await downloadMediaMessage(
            message,
            "buffer",
            {},
            {
              logger,
              reuploadRequest: sock.updateMediaMessage,
            }
          );

          if (buffer.length > MAX_FILE_SIZE) {
            await reply("File terlalu besar. Maksimal 10 MB.");
            continue;
          }

          const fileType = detectType(buffer);

          if (!fileType) {
            await reply("Format didukung: JPG, PNG, dan PDF.");
            continue;
          }

          const session = getSession(chatId);

          if (fileType === "pdf") {
            session.pdf = buffer;
            await reply(
              "PDF tersimpan. Ketik jpg untuk mengubahnya menjadi gambar."
            );
          } else {
            if (session.images.length >= MAX_IMAGES) {
              await reply(
                "Maksimal 10 gambar. Ketik pdf atau hapus."
              );
              continue;
            }

            session.images.push({ buffer, type: fileType });

            await reply(
              `${session.images.length} gambar tersimpan. ` +
              "Kirim gambar lain atau ketik pdf."
            );
          }

          continue;
        }

        const text = (
          content.conversation ||
          content.extendedTextMessage?.text ||
          ""
        ).trim().toLowerCase();

        const command = text.replace(/^\//, "");

        if (command === "menu" || command === "help") {
          await reply(help);
          continue;
        }

                if (command === "hapus") {
          sessions.delete(chatId);
          await reply("Kiriman sementara dihapus.");
          continue;
        }

        // Jika bot sedang menunggu nama, gunakan pesan sebagai nama hasil.
        const activeSession = sessions.get(chatId);

        if (activeSession?.pendingConversion && text) {
          const originalText =
            content.conversation ||
            content.extendedTextMessage?.text ||
            "";

          const outputName = getOutputName(originalText);

          if (!outputName) {
            await reply(
              "Nama tidak valid. Maksimal 80 karakter. " +
              'Jangan gunakan karakter <>:"/\\|?*. ' +
              "Kirim nama lain atau ketik hapus untuk membatalkan."
            );
            continue;
          }

          activeSession.updatedAt = Date.now();

          if (activeSession.pendingConversion === "pdf") {
            await reply(`Sedang membuat ${outputName}.pdf...`);

            const document = await imagesToPdf(activeSession.images);

            await sock.sendMessage(chatId, {
              document,
              mimetype: "application/pdf",
              fileName: `${outputName}.pdf`,
            });

            activeSession.images = [];
          } else {
            await reply("Sedang mengubah PDF menjadi JPG...");

            await sendPdfAsImages(
              sock,
              chatId,
              activeSession.pdf,
              outputName
            );

            activeSession.pdf = null;
          }

          activeSession.pendingConversion = null;
          continue;
        }

        if (command === "pdf") {
          const session = getSession(chatId);

          if (!session.images.length) {
            await reply("Kirim gambar dulu, lalu ketik pdf.");
            continue;
          }

          session.pendingConversion = "pdf";

          await reply(
            "Mau diberi nama apa untuk PDF-nya?\n" +
            "Kirim nama tanpa ekstensi, contoh: Tugas Kuliah\n" +
            "Ketik hapus untuk membatalkan."
          );

          continue;
        }

        if (command === "jpg") {
          const session = getSession(chatId);

          if (!session.pdf) {
            await reply("Kirim PDF dulu, lalu ketik jpg.");
            continue;
          }

          session.pendingConversion = "jpg";

          await reply(
            "Mau diberi nama apa untuk hasil JPG?\n" +
            "Kirim nama tanpa ekstensi, contoh: Materi Kuliah\n" +
            "Jika beberapa halaman, nama diberi nomor otomatis.\n" +
            "Ketik hapus untuk membatalkan."
          );

          continue;
        }

        if (text) {
          await reply("Ketik menu untuk melihat cara penggunaan.");
        }
      } catch (error) {
        console.error(error);

        await reply(
          "Konversi gagal. Pastikan file valid, PDF tidak " +
          "terkunci, dan Poppler sudah terpasang."
        );
      } finally {
        busy.delete(chatId);
      }
    }
  });
}

// Bersihkan kiriman yang sudah kedaluwarsa.
setInterval(() => {
  const now = Date.now();

  for (const [chatId, session] of sessions) {
    if (
      !busy.has(chatId) &&
      now - session.updatedAt > SESSION_TTL
    ) {
      sessions.delete(chatId);
    }
  }
}, 60_000).unref();

startBot().catch(console.error);