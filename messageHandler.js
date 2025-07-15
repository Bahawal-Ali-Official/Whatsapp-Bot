import { downloadMediaMessage, areJidsSameUser } from '@whiskeysockets/baileys';
import { BAD_WORDS_EN, BAD_WORDS_UR } from './config.js';
import { isNsfw } from './mediaHandler.js';

const LINK_REGEX = new RegExp(/(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b[a-zA-Z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?\b)/gi);
const ABUSE_REGEX = new RegExp(`\\b(${[...BAD_WORDS_EN, ...BAD_WORDS_UR].join('|')})\\b`, 'gi');

export async function handleMessage(sock, message) {
    const remoteJid = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;
    const senderName = message.pushName || 'Unknown User';

    if (!remoteJid.endsWith('@g.us')) {
        return;
    }

    let groupMetadata;
    try {
        groupMetadata = await sock.groupMetadata(remoteJid);
    } catch (e) {
        console.error("Group metadata get karne mein fail:", e);
        return;
    }
    
    const participants = groupMetadata.participants;

    // --- FINAL FIX ---
    // Bot ko check karne wali logic hata di gayi hai.
    // Ab direct message bhejne walay (sender) ko check kiya jayega.
    
    const senderInfo = participants.find(p => areJidsSameUser(p.id, sender));
    const isSenderAdmin = senderInfo && (senderInfo.admin === 'admin' || senderInfo.admin === 'superadmin');

    // Agar message bhejne wala admin hai to kuch na karein
    if (isSenderAdmin) {
        // console.log(`${senderName} ek admin hai, message ko ignore kiya ja raha hai.`);
        return;
    }

    console.log(`${senderName} ek admin nahi hai, message check kiya ja raha hai...`);

    const messageContent = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || '';
    let violationFound = false;
    let reason = '';

    if (LINK_REGEX.test(messageContent)) {
        violationFound = true;
        reason = 'Link Sharing';
    }

    if (!violationFound && ABUSE_REGEX.test(messageContent)) {
        violationFound = true;
        reason = 'Verbal Abuse';
    }

    const imageMessage = message.message?.imageMessage;
    if (!violationFound && imageMessage) {
        try {
            console.log(`${senderName} se image analyze ki ja rahi hai...`);
            const buffer = await downloadMediaMessage(message, 'buffer', {});
            if (await isNsfw(buffer)) {
                violationFound = true;
                reason = 'Explicit Image';
            }
        } catch (e) {
            console.error("Image analyze karne mein error:", e);
        }
    }
    
    if (violationFound) {
        console.log(`[VIOLATION] ${senderName} ka message group "${groupMetadata.subject}" se delete kiya ja raha hai. Wajah: ${reason}.`);
        
        try {
            const warningText = `*⚠️ Warning ⚠️*\n\nHello ${senderName}, aapka message delete kar diya gaya hai.\n*Wajah:* ${reason}.\n\n_Is group mein non-admins ko link share karne ya ghalat content post karne ki ijazat nahi hai._`;
            await sock.sendMessage(remoteJid, { text: warningText });
            await sock.sendMessage(remoteJid, { delete: message.key });
        } catch (e) {
            console.error("Message delete karne ya warning bhejne mein fail:", e);
        }
    }
}
