/**
 * Crypto utility functions for client-side encryption and decryption
 * Uses CryptoJS library (must be loaded separately)
 */

// Generate a secure encryption key from the PIN
async function generateEncryptionKey(pin) {
    // Use PBKDF2 to derive a key from the PIN
    // We use a fixed salt for simplicity - in a production app, you might want to store this securely
    const salt = 'ZZZStaticSalt';
    const keySize = 256 / 32; // 256 bits
    const iterations = 1000;
    
    // Create key
    const key = CryptoJS.PBKDF2(pin, salt, {
        keySize: keySize,
        iterations: iterations
    });
    
    return key.toString();
}

// Encrypt a file with the encryption key
async function encryptFile(file, encryptionKey) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const arrayBuffer = e.target.result;
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // For large files, we need to process in chunks to avoid "Invalid array length" errors
                const chunkSize = 1024 * 1024; // 1MB chunks
                const chunks = [];
                
                // Process file in chunks
                for (let i = 0; i < uint8Array.length; i += chunkSize) {
                    const chunk = uint8Array.slice(i, i + chunkSize);
                    const wordArray = CryptoJS.lib.WordArray.create(chunk);
                    const encryptedChunk = CryptoJS.AES.encrypt(wordArray, encryptionKey).toString();
                    chunks.push(encryptedChunk);
                }
                
                // Combine all encrypted chunks with a delimiter
                const encryptedData = chunks.join('|||CHUNK|||');
                
                // Create a new file with encrypted content
                const encryptedBlob = new Blob([encryptedData], { type: 'application/encrypted' });
                resolve(encryptedBlob);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Error reading file'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Decrypt file data with the encryption key
async function decryptFile(encryptedData, encryptionKey, mimeType) {
    try {
        // Check if this is chunked encrypted data
        if (encryptedData.includes('|||CHUNK|||')) {
            // Handle chunked decryption
            const chunks = encryptedData.split('|||CHUNK|||');
            const decryptedChunks = [];
            
            for (const chunk of chunks) {
                const decrypted = CryptoJS.AES.decrypt(chunk, encryptionKey);
                const typedArray = convertWordArrayToUint8Array(decrypted);
                decryptedChunks.push(typedArray);
            }
            
            // Combine all decrypted chunks
            const totalLength = decryptedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combinedArray = new Uint8Array(totalLength);
            let offset = 0;
            
            for (const chunk of decryptedChunks) {
                combinedArray.set(chunk, offset);
                offset += chunk.length;
            }
            
            // Create a blob with the original mime type
            return new Blob([combinedArray], { type: mimeType || 'application/octet-stream' });
        } else {
            // Handle legacy single-chunk decryption
            const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey);
            const typedArray = convertWordArrayToUint8Array(decrypted);
            
            // Create a blob with the original mime type
            return new Blob([typedArray], { type: mimeType || 'application/octet-stream' });
        }
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt file. Incorrect PIN or corrupted data.');
    }
}

// Helper function to convert WordArray to Uint8Array
function convertWordArrayToUint8Array(wordArray) {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    
    // Create a Uint8Array with the appropriate size
    const u8 = new Uint8Array(sigBytes);
    
    // Copy the values
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        u8[i] = byte;
    }
    
    return u8;
}

// Helper function to get file type from file name
function getFileTypeFromName(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    
    // Check if it's an image
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
        return 'image/' + (extension === 'jpg' ? 'jpeg' : extension);
    }
    
    // Check if it's a video
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'flv', 'mkv'].includes(extension)) {
        return 'video/' + extension;
    }
    
    // Default to binary
    return 'application/octet-stream';
}

// Function to check if a file is an image
function isImageFile(fileName) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    const extension = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
}

// Function to check if a file is a video
function isVideoFile(fileName) {
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'flv', 'mkv'];
    const extension = fileName.split('.').pop().toLowerCase();
    return videoExtensions.includes(extension);
}

// Format file size in human-readable format
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate PIN key for Caesar cipher (matches server-side logic)
function generatePinKey() {
    const defaultKey = [7, 12, 19, 24]; // Default key if PIN not found or error occurs
    
    // Get the PIN hash from sessionStorage (set during login)
    const pinHash = sessionStorage.getItem('pinHash');
    
    if (!pinHash || pinHash.length < 10) {
        return defaultKey;
    }
    
    // Use character codes from different positions in the hash string
    const positions = [2, 7, 12, 17]; // Choose positions that are likely to have good variance
    const key = positions.map(pos => {
        if (pos >= pinHash.length) pos = pinHash.length - 1;
        // Get character code and make sure it's between 1-25
        return (pinHash.charCodeAt(pos) % 25) + 1;
    });
    
    return key;
}

// Caesar cipher function for folder name decryption
function caesarCipher(text, key, encrypt = true) {
    // We use an expanded alphabet that includes common filename characters
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
    const direction = encrypt ? 1 : -1;
    
    // Replace any character not in our alphabet with an underscore when encrypting
    // This ensures we can properly decrypt later
    let processedText = text;
    if (encrypt) {
        processedText = text.replace(/[^a-z0-9\-_]/g, '_');
    }
    
    return processedText.split('').map((char, index) => {
        // Use a different shift value for each character based on its position
        const keyIndex = index % key.length;
        const shift = key[keyIndex] * direction;
        
        // Find the character in our alphabet
        const pos = alphabet.indexOf(char);
        
        // If character is not in our alphabet, replace with underscore when encrypting
        // or keep as is when decrypting
        if (pos === -1) {
            return encrypt ? '_' : char;
        }
        
        // Calculate new position with wrap-around
        let newPos = (pos + shift) % alphabet.length;
        if (newPos < 0) newPos += alphabet.length;
        
        return alphabet[newPos];
    }).join('');
}

// Decrypt folder name using Caesar cipher (matches server-side getOriginalName logic)
function decryptFolderName(obfuscatedName) {
    try {
        // Check if this is even an obfuscated name (should have at least one dash)
        if (!obfuscatedName || obfuscatedName.indexOf('-') === -1) {
            return obfuscatedName;
        }
        
        const key = generatePinKey();
        
        // Keep the extension
        const extension = obfuscatedName.includes('.') ? obfuscatedName.substring(obfuscatedName.lastIndexOf('.')) : '';
        
        // Split timestamp and encrypted name
        const nameWithoutExt = extension ? obfuscatedName.substring(0, obfuscatedName.lastIndexOf('.')) : obfuscatedName;
        
        // Find the first dash which separates timestamp and encrypted name
        const dashIndex = nameWithoutExt.indexOf('-');
        
        if (dashIndex === -1) {
            return obfuscatedName; // Invalid format
        }
        
        // Get everything after the first dash - that's our encrypted name
        const encryptedName = nameWithoutExt.substring(dashIndex + 1);
        
        // Decrypt the name
        const decryptedName = caesarCipher(encryptedName, key, false);
        
        const result = decryptedName + extension;
        return result;
    } catch (error) {
        console.error('Error decrypting folder name:', error);
        return obfuscatedName; // Return original if decryption fails
    }
}

// Hash PIN for folder name encryption key (matches server-side logic)
async function hashPin(pin) {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error('Error hashing PIN:', error);
        // Fallback to a simple hash if crypto.subtle is not available
        return btoa(pin).replace(/=/g, '').toLowerCase();
    }
}
