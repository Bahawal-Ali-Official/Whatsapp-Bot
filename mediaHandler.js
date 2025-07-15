import axios from 'axios';
import FormData from 'form-data';

// --- NSFW Image Detection ---
// Aapki API keys neeche add kar di gayi hain.
const API_USER = '1453607463'; // Aapka Sightengine API User
const API_SECRET = 'mRK6VMCbn5Ywx3vJGeuhQ9ach2dN5VPa'; // Aapka Sightengine API Secret

/**
 * Check karta hai ke image NSFW (Not Safe For Work) hai ya nahi.
 * @param {Buffer} imageBuffer - Image ka buffer.
 * @returns {Promise<boolean>} - True agar image ghalat hai, warna false.
 */
export async function isNsfw(imageBuffer) {
    const formData = new FormData();
    formData.append('media', imageBuffer, { filename: 'image.jpg' });
    formData.append('models', 'nudity-2.0');
    formData.append('api_user', API_USER);
    formData.append('api_secret', API_SECRET);

    try {
        const response = await axios({
            method: 'post',
            url: 'https://api.sightengine.com/1.0/check.json',
            data: formData,
            headers: formData.getHeaders(),
        });

        const nudity = response.data.nudity;
        console.log('NSFW Analysis Result:', JSON.stringify(nudity, null, 2));

        // Agar in categories mein high score ho to image ko explicit samjha jayega.
        const isExplicit = (nudity.sexual_activity > 0.85) || 
                           (nudity.sexual_display > 0.85) || 
                           (nudity.erotica > 0.85) ||         
                           (nudity.very_suggestive > 0.9);

        return isExplicit;

    } catch (error) {
        if (error.response) {
            console.error('Sightengine API Error:', error.response.data);
        } else {
            console.error('Sightengine ko request bhejne mein error:', error.message);
        }
        return false; // Agar API fail ho to message delete na karein.
    }
}
