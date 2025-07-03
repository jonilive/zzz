# ZZZ

A secure file gallery application built with Node.js, featuring client-side encryption/decryption. Can be deployed natively or using Docker/Unraid.

## Features

- Responsive design for mobile devices
- PIN authentication for secure access
- Client-side file encryption/decryption
- Support for viewing images and videos
- File upload (up to 100MB) and deletion functionality
- Folder organization with navigation
- First-run setup for PIN creation
- File and folder name obfuscation using Caesar cipher

## Security Features

- Files are encrypted on the client-side before upload
- Files are decrypted on the client-side for viewing
- PIN is stored as a hashed value using bcrypt in a hidden file
- Authentication with secure HTTP-only cookies
- File and folder names are obfuscated using a Caesar cipher with PIN-derived key

## Requirements

- Node.js 14.x or higher
- Modern web browser with JavaScript enabled

## Installation

1. Clone the repository
```
git clone https://github.com/yourusername/zzz.git
cd zzz
```

2. Install dependencies
```
npm install
```

3. Create a `.env` file (or use the provided one)
```
PORT=3000
```

4. Start the application
```
npm start
```

5. Open your browser and navigate to:
```
http://localhost:3000
```

6. Follow the setup process to create a PIN on first run

## Development

To run the application in development mode with auto-restart:
```
npm run dev
```

## Usage

1. First-time setup: Create a PIN for authentication
2. Login with your PIN
3. View, upload, and delete files in the gallery
4. Create folders to organize your files
5. Navigate through folders using the breadcrumb navigation
6. Filter files by type (images, videos, all)
7. Click on a file to preview it
8. Use the logout button when finished

## Technical Details

- **Backend**: Node.js with Express
- **Authentication**: PIN-based with bcrypt for hashing
- **Encryption**: Client-side AES encryption using CryptoJS
- **File Storage**: Local storage in the 'uploads' directory
- **Responsive UI**: Modern CSS with responsive design for mobile devices

## Important Notes

- This application is designed to be used locally and runs on HTTP
- All files are encrypted using a key derived from your PIN
- If you forget your PIN, you will not be able to decrypt your files
- Maximum file size for upload is 100MB

## Docker Deployment

### Using Docker Compose (Recommended)

1. Make sure Docker and Docker Compose are installed on your system
2. Clone the repository or download the source code
3. Navigate to the project directory
4. Run the application with Docker Compose:

```bash
docker-compose up -d
```

5. Access ZZZ at `http://localhost:3000`
6. To stop the container:

```bash
docker-compose down
```

### Using Docker Directly

1. Build the Docker image:

```bash
docker build -t zzz .
```

2. Run the container:

```bash
docker run -d \
  --name zzz \
  -p 3000:3000 \
  -v $(pwd)/uploads:/data/uploads \
  zzz
```

3. Access ZZZ at `http://localhost:3000`

### Configuration Options

The Docker container can be configured using the following environment variables:

- `PORT`: The port the application runs on (default: 3000)
- `UPLOADS_DIR`: The directory where files are stored (default: /data/uploads)

Example with custom port:

```bash
docker run -d \
  --name zzz \
  -p 8080:8080 \
  -e PORT=8080 \
  -v $(pwd)/uploads:/data/uploads \
  zzz
```

## Unraid Deployment

To deploy ZZZ on Unraid:

1. Navigate to the Docker tab in your Unraid web interface
2. Click "Add Container"
3. Fill in the following details:
   - Repository: `yourusername/zzz` (or use a custom built image)
   - Network Type: Bridge
   - Port Mappings: `3000:3000`
   - Add the following Path:
     - Host Path: `/mnt/user/appdata/zzz` (or your preferred location)
     - Container Path: `/data/uploads`
     - Access Mode: Read/Write
4. Click "Apply" to create and start the container

For a more user-friendly installation, a Community Applications template may be available in the future.

## License

ISC
