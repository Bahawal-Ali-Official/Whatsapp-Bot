import { Boom } from '@hapi/boom';
import Baileys, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './messageHandler.js';

const logger = pino({ level: 'info' });

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Baileys version v${version.join('.')} istemal ho raha hai, isLatest: ${isLatest}`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = Baileys.default({
        version,
        logger,
        auth: state,
        // FIX: Crashing error ko theek kiya gaya hai
        shouldIgnoreJid: jid => typeof jid === 'string' && jid.includes('@broadcast'),
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('------------------------------------------------');
            console.log('QR code mil gaya hai, apnay phone se scan karein:');
            qrcode.generate(qr, { small: true });
            console.log('------------------------------------------------');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) &&
                                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection band ho gaya hai: ', lastDisconnect.error, ', dobara connect kar rahe hain: ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Connection open ho gaya hai!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type !== 'notify') return;
        const message = m.messages[0];
        if (!message.message || message.key.fromMe) return;

        await handleMessage(sock, message);
    });

    return sock;
}

startBot().catch(err => {
    console.error("Bot start karne mein error:", err);
});
