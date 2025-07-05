const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Load environment         // No need to store mapping with our Caesar cipher approachriables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Log the port we're using
console.log(`ZZZ will run on port: ${port}`);

// Enable path parameters with slashes
app.set('strict routing', false);

// Middleware
app.use(bodyParser.json({ limit: '120mb' })); // Allow for encrypted file overhead
app.use(bodyParser.urlencoded({ extended: true, limit: '120mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// File paths - support custom uploads directory via environment variable
const UPLOADS_DIR = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, 'uploads');
const PIN_FILE = path.join(UPLOADS_DIR, '.pin'); // Hidden PIN file in uploads directory

// Log the uploads directory being used
console.log(`Using uploads directory: ${UPLOADS_DIR}`);

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Check if PIN is set
function isPinSet() {
    return fs.existsSync(PIN_FILE);
}

// Helper function to ensure a directory path exists
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Simple Caesar cipher for name obfuscation
// We'll use the first 4 digits of the PIN hash as the shift values for different parts of the name

// Get PIN from the hidden file in uploads directory
function getPinKey() {
    // Use a simpler, more reliable approach that doesn't depend on parsing hex values
    const defaultKey = [7, 12, 19, 24]; // Default key if PIN not found or error occurs
    
    const pinFile = path.join(UPLOADS_DIR, '.pin');
    if (!fs.existsSync(pinFile)) {
        return defaultKey;
    }
    
    try {
        const pinData = JSON.parse(fs.readFileSync(pinFile, 'utf8'));
        if (!pinData || !pinData.pin) {
            return defaultKey;
        }
        
        // Use consistent numeric values derived from the hash
        // We'll use character codes which are guaranteed to be numbers
        const hash = pinData.pin;
        
        // If the hash is too short, use default key
        if (hash.length < 10) {
            return defaultKey;
        }
        
        // Use character codes from different positions in the hash string
        const positions = [2, 7, 12, 17]; // Choose positions that are likely to have good variance
        const key = positions.map(pos => {
            if (pos >= hash.length) pos = hash.length - 1;
            // Get character code and make sure it's between 1-25
            return (hash.charCodeAt(pos) % 25) + 1;
        });
        
        return key;
    } catch (err) {
        console.error('Error reading PIN file:', err);
        return defaultKey;
    }
}

// Caesar cipher function - enhanced implementation for filename obfuscation
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

// Name obfuscation and deobfuscation functions
function obfuscateFileName(originalName) {
    const key = getPinKey();
    
    // Keep the extension for proper content type detection
    const extension = path.extname(originalName);
    // Normalize the filename to lowercase before encrypting
    const nameWithoutExt = path.basename(originalName, extension).toLowerCase();
    
    // Add a timestamp prefix for uniqueness - use base36 for shorter timestamps
    const timestamp = Date.now().toString(36);
    
    // Encrypt the filename without the extension
    const encryptedName = caesarCipher(nameWithoutExt, key, true);
    
    // Create the obfuscated name: timestamp-encryptedName.extension
    const result = `${timestamp}-${encryptedName}${extension}`;
    
    // console.log(`Obfuscating filename: ${originalName} -> ${result}`);
    
    return result;
}

// Function to get original name from obfuscated name
function getOriginalName(obfuscatedName) {
    // Check if this is even an obfuscated name (should have at least one dash)
    if (!obfuscatedName || obfuscatedName.indexOf('-') === -1) {
        return obfuscatedName;
    }
    
    try {
        const key = getPinKey();
        
        // Keep the extension
        const extension = path.extname(obfuscatedName);
        
        // Split timestamp and encrypted name
        const nameWithoutExt = path.basename(obfuscatedName, extension);
        // Find the first dash which separates timestamp and encrypted name
        const dashIndex = nameWithoutExt.indexOf('-');
        
        if (dashIndex === -1) return obfuscatedName; // Invalid format
        
        // Get everything after the first dash - that's our encrypted name
        const encryptedName = nameWithoutExt.substring(dashIndex + 1);
        
        // Decrypt the name
        const decryptedName = caesarCipher(encryptedName, key, false);
        
        return decryptedName + extension;
    } catch (err) {
        console.error('Error decrypting filename:', err, obfuscatedName);
        return obfuscatedName; // Return original on error
    }
}

// These functions are no longer needed with our new approach but keep them as no-ops
// to avoid breaking existing code that calls them
function storeNameMapping() { /* No longer needed */ }
function getAllNameMappings() { return {}; }
function getObfuscatedName(originalName) { 
    // While we don't need to look up mappings anymore, we can still generate obfuscated names on demand
    return obfuscateFileName(originalName);
}



// Middleware to check authentication
function checkAuth(req, res, next) {
    // Skip authentication check if PIN is not set yet
    if (!isPinSet()) {
        return res.redirect('/setup');
    }
    
    // Check if authenticated
    if (!req.cookies.authenticated) {
        return res.redirect('/login');
    }
    
    next();
}

// Multer storage configuration for the root uploads directory
// We'll move the file to the correct subdirectory after upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Always upload to the root uploads directory first
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Generate an obfuscated filename using our Caesar cipher
        const obfuscatedName = obfuscateFileName(file.originalname);
        cb(null, obfuscatedName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 120 * 1024 * 1024, // 120MB limit to account for encryption overhead
        files: 50, // Allow up to 50 files in a single upload
        fields: 100, // Allow up to 100 fields (needed for multiple file uploads)
        fieldNameSize: 100, // Field name size limit
        fieldSize: 2 * 1024 * 1024, // Field size limit (2MB)
        parts: 200 // Max number of parts in multipart request
    }
});

// Routes
app.get('/', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    // If PIN is not set, redirect to setup
    if (!isPinSet()) {
        return res.redirect('/setup');
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/setup', (req, res) => {
    // If PIN is already set, redirect to login
    if (isPinSet()) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'views', 'setup.html'));
});

// API Routes
app.post('/api/setup', async (req, res) => {
    const { pin } = req.body;
    
    if (!pin || pin.length < 4) {
        return res.status(400).json({ success: false, message: 'PIN must be at least 4 characters' });
    }
    
    try {
        // Hash the PIN
        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(pin, salt);
        
        // Save the hashed PIN in the hidden file in uploads folder
        fs.writeFileSync(PIN_FILE, JSON.stringify({ pin: hashedPin }));
        
        // Return the PIN hash so the client can use it for decryption
        res.json({ success: true, message: 'PIN set successfully', pinHash: hashedPin });
    } catch (error) {
        console.error('Error setting PIN:', error);
        res.status(500).json({ success: false, message: 'Failed to set PIN' });
    }
});

app.post('/api/login', async (req, res) => {
    const { pin } = req.body;
    
    if (!pin) {
        return res.status(400).json({ success: false, message: 'PIN is required' });
    }
    
    try {
        // Read the saved hashed PIN from the hidden file
        const savedData = JSON.parse(fs.readFileSync(PIN_FILE));
        
        // Compare the PINs
        const match = await bcrypt.compare(pin, savedData.pin);
        
        if (match) {
            // Set authentication cookie (1 hour expiration)
            res.cookie('authenticated', true, { maxAge: 3600000, httpOnly: true });
            
            // Send the PIN hash to client for folder name decryption
            res.json({ 
                success: true, 
                message: 'Authentication successful',
                pinHash: savedData.pin
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid PIN' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('authenticated');
    res.json({ success: true, message: 'Logged out successfully' });
});

// File management API routes
app.get('/api/files', checkAuth, (req, res) => {
    try {
        const dirPath = req.query.path || '';
        const page = parseInt(req.query.page) || 1;
        const filesPerPage = parseInt(req.query.filesPerPage) || 20;
        const currentDir = path.join(UPLOADS_DIR, dirPath);
        
        // Ensure the path is within the uploads directory (prevent directory traversal)
        if (!currentDir.startsWith(UPLOADS_DIR)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        // Ensure the directory exists
        if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
            return res.status(404).json({ success: false, message: 'Directory not found' });
        }
        
        const allFiles = fs.readdirSync(currentDir)
            // Filter out hidden files (those starting with a dot)
            .filter(file => !file.startsWith('.'))
            .map(file => {
                const filePath = path.join(currentDir, file);
                const stats = fs.statSync(filePath);
                const isDirectory = stats.isDirectory();
                const relativePath = path.relative(UPLOADS_DIR, filePath);
                
                // Get the original name using our Caesar cipher
                const originalName = getOriginalName(file);
                
                return {
                    name: originalName,  // Display name (original)
                    obfuscatedName: file, // Obfuscated name (stored on disk)
                    path: `/uploads/${relativePath.split(path.sep).join('/')}`,
                    relativePath: relativePath.split(path.sep).join('/'),
                    size: stats.size,
                    isDirectory,
                    mtime: stats.mtime,
                    type: isDirectory ? 'directory' : path.extname(originalName).substr(1)
                };
            });
        
        // Separate folders and files
        const folders = allFiles.filter(item => item.isDirectory);
        const files = allFiles.filter(item => !item.isDirectory);
        
        // Sort folders by name and files by date (newest first)
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
        
        // Calculate pagination for files only (folders are always shown)
        const totalFileCount = files.length;
        const totalPages = Math.max(1, Math.ceil(totalFileCount / filesPerPage));
        const startIndex = (page - 1) * filesPerPage;
        const endIndex = startIndex + filesPerPage;
        const paginatedFiles = files.slice(startIndex, endIndex);
        
        // Combine folders (always shown) with paginated files
        const resultFiles = [...folders, ...paginatedFiles];
        
        // Add parent directory info if not in root
        const result = {
            success: true,
            files: resultFiles,
            currentPath: dirPath,
            isRoot: dirPath === '',
            currentPage: page,
            totalPages: totalPages,
            totalFiles: allFiles.length
        };
        
        if (dirPath !== '') {
            const parentPath = path.dirname(dirPath);
            result.parentPath = parentPath === '.' ? '' : parentPath;
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error reading files:', error);
        res.status(500).json({ success: false, message: 'Failed to read files' });
    }
});

// Simpler approach for file uploads - now supports multiple files
app.post('/api/upload', checkAuth, (req, res) => {
    // Handle Multer upload with custom error handling
    upload.array('files', 50)(req, res, (err) => {
        if (err) {
            console.error('Multer upload error:', err);
            
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Too many files. Maximum 50 files allowed per upload.' 
                    });
                } else if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'File too large. Maximum file size is 120MB.' 
                    });
                } else if (err.code === 'LIMIT_FIELD_COUNT') {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Too many fields in the request.' 
                    });
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Unexpected file field in the request.' 
                    });
                } else {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Upload error: ${err.message}` 
                    });
                }
            } else {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Server error during upload' 
                });
            }
        }
        
        // If no error, proceed with upload processing
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }
        
        try {
        // Get the current path from request body
        const currentPath = req.body.currentPath || '';
        const uploadedFiles = [];
        
        // Process each uploaded file
        for (const file of req.files) {
            const originalName = file.originalname;
            const obfuscatedName = file.filename;
            
            // If currentPath is specified, move the file to the correct subdirectory
            let finalPath = file.path; // Default to current location
            let relativePath = obfuscatedName; // Default relative path
            
            if (currentPath) {
                // Create the target directory if it doesn't exist
                const targetDir = path.join(UPLOADS_DIR, currentPath);
                ensureDirectoryExists(targetDir);
                
                // Set the final path
                finalPath = path.join(targetDir, obfuscatedName);
                relativePath = path.join(currentPath, obfuscatedName).replace(/\\/g, '/');
                
                // Move the file from root uploads to the subfolder
                if (file.path !== finalPath) {
                    fs.renameSync(file.path, finalPath);
                }
            }
            
            // Add to uploaded files array
            uploadedFiles.push({
                name: originalName,
                obfuscatedName: obfuscatedName,
                path: `/uploads/${relativePath}`,
                relativePath: relativePath,
                size: file.size,
                type: path.extname(originalName).substr(1)
            });
        }
        
        res.json({ 
            success: true, 
            message: `${uploadedFiles.length} file(s) uploaded successfully`,
            files: uploadedFiles
        });
    } catch (error) {
        console.error('Error handling file upload:', error);
        res.status(500).json({ success: false, message: 'Error processing uploaded files' });
    }
    }); // Close the upload middleware callback
});

app.delete('/api/files', checkAuth, (req, res) => {
    const filePath = req.query.path || '';
    const fullPath = path.join(UPLOADS_DIR, filePath);
    
    // Ensure the path is within the uploads directory (prevent directory traversal)
    if (!fullPath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    try {
        if (fs.existsSync(fullPath)) {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                // For directories, use recursive removal
                fs.rmdirSync(fullPath, { recursive: true });
                res.json({ success: true, message: 'Folder and its contents deleted successfully' });
            } else {
                // For files, just unlink
                fs.unlinkSync(fullPath);
                res.json({ success: true, message: 'File deleted successfully' });
            }
        } else {
            res.status(404).json({ success: false, message: 'File or folder not found' });
        }
    } catch (error) {
        console.error('Error deleting file or folder:', error);
        res.status(500).json({ success: false, message: 'Failed to delete file or folder' });
    }
});

// Folder management API routes
app.post('/api/folders', checkAuth, (req, res) => {
    const { name, currentPath } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, message: 'Folder name is required' });
    }
    
    // Obfuscate the folder name using our Caesar cipher
    const obfuscatedName = obfuscateFileName(name);
    
    // Create folder path with obfuscated name in the current path or root
    const parentPath = currentPath ? path.join(UPLOADS_DIR, currentPath) : UPLOADS_DIR;
    const dirPath = path.join(parentPath, obfuscatedName);
    
    // Calculate relative path for response
    const relativePath = currentPath ? `${currentPath}/${obfuscatedName}` : obfuscatedName;
    
    // Ensure the path is within the uploads directory (prevent directory traversal)
    if (!dirPath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    try {
        // Check if folder already exists
        if (fs.existsSync(dirPath)) {
            return res.status(409).json({ success: false, message: 'Folder already exists' });
        }
        
        // Create the directory
        ensureDirectoryExists(dirPath);
        
        res.json({ 
            success: true, 
            message: 'Folder created successfully', 
            folder: { 
                name: name, // Original name for display
                obfuscatedName: obfuscatedName, // Obfuscated name for filesystem
                path: `/uploads/${relativePath}`,
                relativePath: relativePath,
                isDirectory: true,
                type: 'directory'
            } 
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ success: false, message: 'Failed to create folder' });
    }
});


// Special route for handling folder navigation in the browser
// Using a simpler approach that doesn't rely on Express path-to-regexp
app.get('/api/navigate', checkAuth, (req, res) => {
    const folderPath = req.query.path || '';
    const currentDir = path.join(UPLOADS_DIR, folderPath);
    
    // Ensure the path is within the uploads directory (prevent directory traversal)
    if (!currentDir.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Check if directory exists
    if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) {
        return res.status(404).json({ success: false, message: 'Directory not found' });
    }
    
    res.json({ 
        success: true, 
        currentPath: folderPath,
        message: 'Navigation successful'
    });
});

// Serve encrypted files (they will be decrypted client-side)
app.use('/uploads', checkAuth, express.static(UPLOADS_DIR));

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`ZZZ server running on port ${port}`);
    console.log(`Access at http://localhost:${port}`);
    
    // Check if PIN is set
    if (!isPinSet()) {
        console.log('No PIN set. Please visit /setup to set your PIN.');
    } else {
        console.log('PIN is set. Use /login to access the gallery.');
    }
});
