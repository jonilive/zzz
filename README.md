# ZZZ - Secure File Gallery

A secure, self-hosted file gallery application with client-side encryption and PIN authentication. Perfect for storing and viewing sensitive photos, videos, and documents.

## 🔐 Security Features

- **Client-side encryption/decryption** - Files are encrypted in your browser before upload using chunked encryption for large files
- **PIN authentication** - Secure access control with 4+ digit PIN requirement
- **Filename obfuscation** - Original filenames are encrypted on the server using Caesar cipher
- **No server-side key storage** - Keys are derived from your PIN and never stored
- **Secure file handling** - Robust error handling and validation for file operations
- **Session management** - Automatic cleanup of decrypted data on logout

## ✨ Features

- 📱 **Responsive design** - Works perfectly on mobile devices
- 🖼️ **Media support** - View images and videos directly in the browser
- 📁 **Folder organization** - Create and navigate through folders
- ⬆️ **Multi-file upload** - Support for uploading up to 50 files at once (100MB per file)
- 🗂️ **Pagination** - Efficient handling of large file libraries (20 files per page)
- 📄 **Drag & drop** - Intuitive file upload interface
- 🔍 **File preview** - Instant preview of images and videos
- 🗑️ **File management** - Upload, view, and delete files and folders
- 🔒 **Session security** - Automatic logout and session management
- 🚀 **Memory optimization** - Efficient handling of large files and thumbnails
- 📲 **Mobile-optimized** - Full-width buttons and touch-friendly interface

## 🚀 Quick Start with Docker

### Docker Compose (Recommended)

1. Create a `docker-compose.yml` file:
```yaml
version: '3'

services:
  zzz:
    image: ghcr.io/jonilive/zzz:latest
    container_name: zzz
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - UPLOADS_DIR=/data/uploads
    volumes:
      - ./zzz-data:/data/uploads
    restart: unless-stopped
```

2. Run the container:
```bash
docker-compose up -d
```

### Docker Run

```bash
docker run -d \
  --name zzz \
  -p 3000:3000 \
  -v ./zzz-data:/data/uploads \
  -e UPLOADS_DIR=/data/uploads \
  ghcr.io/jonilive/zzz:latest
```

## 📦 Unraid Installation

1. Go to **Community Applications** in Unraid
2. Search for "ZZZ" or use this template URL: `https://raw.githubusercontent.com/jonilive/zzz/master/unraid-template.xml`
3. Configure the paths and ports as needed
4. Install and start the container

### Manual Unraid Template

If the community application isn't available yet:

1. Go to **Docker** tab in Unraid
2. Click **Add Container**
3. Set **Template**: `https://raw.githubusercontent.com/jonilive/zzz/master/unraid-template.xml`

## 🔧 Configuration

### Environment Variables

- `PORT` - Web interface port (default: 3000)
- `UPLOADS_DIR` - Directory for encrypted file storage (default: /data/uploads)
- `NODE_ENV` - Application environment (default: production)

### Initial Setup

1. Access the web interface at `http://your-server:3000`
2. You'll be prompted to set up an initial PIN (minimum 4 digits)
3. Remember your PIN - it cannot be recovered if lost!
4. Start uploading and organizing your files

### Usage Tips

- **Multi-file uploads**: Select multiple files or drag & drop up to 50 files at once
- **Large files**: Files up to 100MB are supported per file
- **Pagination**: Navigate through large collections with 20 files per page
- **Mobile usage**: Full-width buttons and optimized touch interface
- **File organization**: Create folders to organize your encrypted files
- **Instant preview**: Click on images and videos for immediate viewing

## 🚀 Recent Improvements

### Version 2.0 Features

- **Multi-file upload support** - Upload up to 50 files simultaneously
- **Improved pagination** - Better handling of large file libraries
- **Enhanced mobile experience** - Optimized UI for mobile devices
- **Better error handling** - More robust file upload with detailed error messages
- **Memory optimization** - Efficient handling of thumbnails and large files
- **Instant UI feedback** - Immediate modal transitions and button states
- **Chunked encryption** - Better performance for large file encryption
- **Improved PIN validation** - Real-time validation with mobile-friendly input

## 🏗️ Development

### Prerequisites

- Node.js 18 or higher
- npm

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/jonilive/zzz.git
cd zzz
```

2. Install dependencies:
```bash
npm install
```

3. Create uploads directory:
```bash
mkdir uploads
```

4. Start the development server:
```bash
npm run dev
```

5. Open http://localhost:3000

### Building Docker Image

```bash
docker build -t zzz .
```

## 📁 File Structure

```
zzz/
├── public/              # Static web assets
│   ├── css/            # Stylesheets
│   └── js/             # Client-side JavaScript
├── views/              # HTML templates
├── uploads/            # Encrypted file storage (created automatically)
├── server.js           # Main application server
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
└── unraid-template.xml # Unraid template
```

## 🔒 Security Notes

- **PIN Security**: Choose a strong PIN. The security of your files depends on it.
- **HTTPS**: Use HTTPS in production (configure with a reverse proxy like Nginx or Traefik)
- **Backup**: Regularly backup your encrypted files and remember your PIN
- **Access Control**: Ensure the application is not publicly accessible unless intended

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## ⚠️ Disclaimer

This software is provided as-is. Always maintain backups of important data and test the application thoroughly in your environment before relying on it for critical files.
