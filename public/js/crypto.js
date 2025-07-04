/**
 * Crypto utility functions for client-side encryption and decryption
 * Uses CryptoJS library
 */

// Import CryptoJS from CDN
document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>');

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
