/**
 * Main gallery JavaScript file
 * Handles file display, upload, preview, and deletion
 */

document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    const fileContainer = document.getElementById('file-container');
    const uploadBtn = document.getElementById('upload-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const uploadModal = document.getElementById('upload-modal');
    const previewModal = document.getElementById('preview-modal');
    const fileTemplate = document.getElementById('file-template');
    
    // Current directory path (empty string means root)
    let currentPath = '';
    
    // Pagination variables
    let currentPage = 1;
    let totalPages = 1;
    let totalFiles = 0;
    const filesPerPage = 20; // 20 files per page
    
    // Check if we have an encryption key in sessionStorage
    const encryptionKey = sessionStorage.getItem('encryptionKey');
    if (!encryptionKey) {
        // If no encryption key, redirect to login
        window.location.href = '/login';
        return;
    }
    
    // Load files
    loadFiles();
    
    // Event listeners
    uploadBtn.addEventListener('click', openUploadModal);
    document.getElementById('new-folder-btn').addEventListener('click', openCreateFolderModal);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Close modal buttons
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = closeBtn.closest('.modal');
            
            // Clean up blob URLs when closing preview modal
            if (modal === previewModal) {
                cleanupPreviewModal();
            }
            
            // Close modal immediately
            modal.style.display = 'none';
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
        if (e.target === previewModal) {
            cleanupPreviewModal();
            previewModal.style.display = 'none';
        }
    });
    
    // Function to clean up blob URLs in preview modal
    function cleanupPreviewModal() {
        const previewContainer = document.getElementById('preview-container');
        
        // Find any video elements and stop them
        const videos = previewContainer.querySelectorAll('video');
        videos.forEach(video => {
            // Pause the video
            video.pause();
            
            // Reset video to beginning
            video.currentTime = 0;
            
            // Clear the video source to stop any buffering
            video.src = '';
            video.load(); // Force reload to clear buffer
            
            // Clean up blob URL if it exists
            const objectURL = video.getAttribute('data-object-url');
            if (objectURL) {
                URL.revokeObjectURL(objectURL);
            }
            
            // Remove the video element completely
            video.remove();
        });
        
        // Find any links with blob URLs
        const links = previewContainer.querySelectorAll('a[href^="blob:"]');
        links.forEach(link => {
            URL.revokeObjectURL(link.href);
        });
        
        // Clear the entire preview container to ensure everything is removed
        previewContainer.innerHTML = '';
    }
    
    // Setup upload form
    setupUploadForm();
    
    // Handle drag and drop
    setupDragDrop();
    
    // Clean up blob URLs when page unloads
    window.addEventListener('beforeunload', () => {
        // Clean up thumbnail blob URLs
        const thumbnails = document.querySelectorAll('[data-thumbnail-url]');
        thumbnails.forEach(thumbnail => {
            const url = thumbnail.getAttribute('data-thumbnail-url');
            if (url) {
                URL.revokeObjectURL(url);
            }
        });
        
        // Clean up preview modal blob URLs
        cleanupPreviewModal();
    });
    
    // Load files function
    async function loadFiles(path = null, page = 1) {
        try {
            // If path is provided, use it; otherwise, use currentPath
            if (path !== null) {
                currentPath = path;
                currentPage = 1; // Reset to first page when changing directories
            } else {
                currentPage = page;
            }
            
            // Show loading state
            fileContainer.innerHTML = '<div class="loading">Loading files...</div>';
            
            // Hide pagination during loading
            const paginationEl = document.getElementById('pagination-controls');
            if (paginationEl) {
                paginationEl.style.display = 'none';
            }
            
            // Update URL with query parameters
            const url = new URL('/api/files', window.location.origin);
            if (currentPath) {
                url.searchParams.append('path', currentPath);
            }
            url.searchParams.append('page', currentPage);
            url.searchParams.append('filesPerPage', filesPerPage);
            
            // If we're changing directories, validate the path first
            if (path !== null && path !== '') {
                try {
                    const validateUrl = new URL('/api/navigate', window.location.origin);
                    validateUrl.searchParams.append('path', path);
                    const validateResponse = await fetch(validateUrl);
                    if (!validateResponse.ok) {
                        throw new Error('Invalid directory path');
                    }
                } catch (navError) {
                    console.error('Navigation error:', navError);
                    // If navigation fails, reset to root
                    currentPath = '';
                }
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch files');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Update pagination info
                totalFiles = data.totalFiles || 0;
                totalPages = data.totalPages || 1;
                currentPage = data.currentPage || 1;
                
                // Update the breadcrumb navigation
                updateBreadcrumb(data.currentPath, data.isRoot, data.parentPath);
                
                // Display files and folders
                displayFiles(data.files);
                
                // Update pagination controls (this will show them again)
                updatePaginationControls();
            } else {
                fileContainer.innerHTML = '<div class="error">Failed to load files</div>';
            }
        } catch (error) {
            console.error('Error loading files:', error);
            fileContainer.innerHTML = '<div class="error">Error loading files</div>';
        }
    }
    
    // Update breadcrumb navigation
    function updateBreadcrumb(path, isRoot, parentPath) {
        const breadcrumbEl = document.getElementById('breadcrumb');
        breadcrumbEl.innerHTML = '';
        
        // Add home/root
        const homeLink = document.createElement('a');
        homeLink.href = '#';
        homeLink.className = 'breadcrumb-item' + (isRoot ? ' active' : '');
        homeLink.textContent = 'Home';
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadFiles('');
        });
        breadcrumbEl.appendChild(homeLink);
        
        // If we're in the root, no need for additional breadcrumbs
        if (isRoot) return;
        
        // Split the path and build breadcrumb trail
        const parts = path.split('/');
        let currentTrail = '';
        
        parts.forEach((part, index) => {
            if (!part) return; // Skip empty parts
            
            // Add separator
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            separator.className = 'breadcrumb-separator';
            breadcrumbEl.appendChild(separator);
            
            // Update current trail
            currentTrail += (currentTrail ? '/' : '') + part;
            
            // Add breadcrumb item
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'breadcrumb-item' + (index === parts.length - 1 ? ' active' : '');
            
            // Decrypt the folder name for display
            try {
                const decryptedName = decryptFolderName(part);
                item.textContent = decryptedName;
            } catch (error) {
                console.error('Error decrypting folder name:', error);
                item.textContent = part; // Fallback to original name
            }
            
            // Only add click event if it's not the last item
            if (index !== parts.length - 1) {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    loadFiles(currentTrail);
                });
            }
            
            breadcrumbEl.appendChild(item);
        });
    }
    
    // Update pagination controls
    function updatePaginationControls() {
        let paginationEl = document.getElementById('pagination-controls');
        
        // Create pagination container if it doesn't exist
        if (!paginationEl) {
            paginationEl = document.createElement('div');
            paginationEl.id = 'pagination-controls';
            paginationEl.className = 'pagination-controls';
            
            // Insert after the breadcrumb
            const breadcrumb = document.getElementById('breadcrumb');
            if (breadcrumb) {
                breadcrumb.parentNode.insertBefore(paginationEl, breadcrumb.nextSibling);
            } else {
                // Fallback: insert before file container
                fileContainer.parentNode.insertBefore(paginationEl, fileContainer);
            }
        }
        
        // Clear existing content
        paginationEl.innerHTML = '';
        
        // Only show pagination if there are multiple pages
        if (totalPages <= 1) {
            paginationEl.style.display = 'none';
            return;
        }
        
        paginationEl.style.display = 'flex';
        
        // Previous button
        if (currentPage > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn pagination-btn';
            prevBtn.innerHTML = '← Previous';
            prevBtn.onclick = () => {
                prevBtn.disabled = true;
                prevBtn.innerHTML = '← Loading...';
                loadFiles(null, currentPage - 1);
            };
            paginationEl.appendChild(prevBtn);
        }
        
        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.className = 'page-info';
        pageInfo.innerHTML = `
            <strong>Page ${currentPage} of ${totalPages}</strong>
            <br>
            <small>${totalFiles} total files</small>
        `;
        paginationEl.appendChild(pageInfo);
        
        // Next button
        if (currentPage < totalPages) {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn pagination-btn';
            nextBtn.innerHTML = 'Next →';
            nextBtn.onclick = () => {
                nextBtn.disabled = true;
                nextBtn.innerHTML = 'Loading... →';
                loadFiles(null, currentPage + 1);
            };
            paginationEl.appendChild(nextBtn);
        }
        
        // Page size info
        const sizeInfo = document.createElement('span');
        sizeInfo.className = 'size-info';
        sizeInfo.innerHTML = `<small>${filesPerPage} files per page</small>`;
        paginationEl.appendChild(sizeInfo);
    }
     // Display files in the gallery
    function displayFiles(files) {
        if (files.length === 0) {
            fileContainer.innerHTML = '<div class="loading">No files found</div>';
            // No need for the create folder button here as we have it in the header
            return;
        }

        // Clean up any existing thumbnail blob URLs before loading new ones
        const existingThumbnails = fileContainer.querySelectorAll('[data-thumbnail-url]');
        existingThumbnails.forEach(thumbnail => {
            const url = thumbnail.getAttribute('data-thumbnail-url');
            if (url) {
                URL.revokeObjectURL(url);
            }
        });

        fileContainer.innerHTML = '';
        
        // We've moved the "New Folder" button to the header
        
        // Group files and folders
        const folders = files.filter(item => item.isDirectory);
        const normalFiles = files.filter(item => !item.isDirectory);
        
        // Sort folders by name
        folders.sort((a, b) => a.name.localeCompare(b.name));
        
        // Sort files by date (newest first)
        normalFiles.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
        
        // First add folders
        folders.forEach(folder => {
            // Create folder item from template
            const folderItem = document.importNode(fileTemplate.content, true).querySelector('.file-item');
            
            // Set folder properties
            const folderName = folderItem.querySelector('.file-name');
            const fileSize = folderItem.querySelector('.file-size');
            const thumbnail = folderItem.querySelector('.thumbnail');
            const viewBtn = folderItem.querySelector('.view-btn');
            const deleteBtn = folderItem.querySelector('.delete-btn');
            
            // Decrypt folder name for display
            try {
                const decryptedName = decryptFolderName(folder.name);
                folderName.textContent = decryptedName;
            } catch (error) {
                console.error('Error decrypting folder name:', error);
                folderName.textContent = folder.name; // Fallback to original name
            }
            fileSize.textContent = 'Folder';
            
            // Set folder type for filtering
            folderItem.setAttribute('data-type', 'folder');
            
            // Add folder path as data attribute
            folderItem.setAttribute('data-path', folder.relativePath);
            
            // Use folder icon for thumbnail
            thumbnail.classList.remove('loading');
            thumbnail.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%234a6fa5\' width=\'48px\' height=\'48px\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Cpath d=\'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z\'/%3E%3C/svg%3E")';
            thumbnail.style.backgroundSize = '48px';
            thumbnail.style.backgroundColor = '#f0f0f0';
            
            // Change view button to open button
            viewBtn.innerHTML = '<span class="icon">📂</span>';
            viewBtn.title = 'Open folder';
            
            // View button event for folders
            viewBtn.addEventListener('click', () => {
                loadFiles(folder.relativePath);
            });
            
            // Click on the thumbnail to open the folder
            thumbnail.addEventListener('click', () => {
                loadFiles(folder.relativePath);
            });
            
            // Delete button event for folders
            deleteBtn.addEventListener('click', () => {
                confirmDelete(folder, true);
            });
            
            fileContainer.appendChild(folderItem);
        });
        
        // Then add regular files
        normalFiles.forEach(file => {
            // Create file item from template
            const fileItem = document.importNode(fileTemplate.content, true).querySelector('.file-item');
            
            // Set file properties
            const fileName = fileItem.querySelector('.file-name');
            const fileSize = fileItem.querySelector('.file-size');
            const thumbnail = fileItem.querySelector('.thumbnail');
            const viewBtn = fileItem.querySelector('.view-btn');
            const deleteBtn = fileItem.querySelector('.delete-btn');
            
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            
            // Set file type for filtering
            let fileType = 'other';
            if (isImageFile(file.name)) {
                fileType = 'image';
            } else if (isVideoFile(file.name)) {
                fileType = 'video';
            }
            
            fileItem.setAttribute('data-type', fileType);
            
            // Add file path as data attribute
            fileItem.setAttribute('data-path', file.path);
            
            // Load thumbnail for images
            if (fileType === 'image') {
                loadThumbnail(file.path, thumbnail);
            } else if (fileType === 'video') {
                // Use video icon for thumbnail
                thumbnail.classList.remove('loading');
                thumbnail.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%234a6fa5\' width=\'48px\' height=\'48px\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z\'/%3E%3C/svg%3E")';
                thumbnail.style.backgroundSize = '48px';
                thumbnail.style.backgroundColor = '#f0f0f0';
            } else {
                // Use generic file icon for other files
                thumbnail.classList.remove('loading');
                thumbnail.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%236c757d\' width=\'48px\' height=\'48px\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Cpath d=\'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z\'/%3E%3C/svg%3E")';
                thumbnail.style.backgroundSize = '48px';
                thumbnail.style.backgroundColor = '#f0f0f0';
            }
            
            // View button event
            viewBtn.addEventListener('click', () => {
                viewFile(file);
            });
            
            // Delete button event
            deleteBtn.addEventListener('click', () => {
                confirmDelete(file);
            });
            
            // Click on the thumbnail to view the file
            thumbnail.addEventListener('click', () => {
                viewFile(file);
            });
            
            fileContainer.appendChild(fileItem);
        });
    }
    
    // Load and decrypt thumbnail
    async function loadThumbnail(filePath, thumbnailEl) {
        try {
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error('Failed to load thumbnail');
            }
            
            // Get the encrypted data
            const encryptedData = await response.text();
            
            // Decrypt the data
            const mimeType = getFileTypeFromName(filePath);
            const decryptedBlob = await decryptFile(encryptedData, encryptionKey, mimeType);
            
            // Create URL for the decrypted blob
            const objectURL = URL.createObjectURL(decryptedBlob);
            
            // Store the object URL for cleanup
            thumbnailEl.setAttribute('data-thumbnail-url', objectURL);
            
            // Set as background image
            thumbnailEl.style.backgroundImage = `url(${objectURL})`;
            thumbnailEl.classList.remove('loading');
            
            // Clean up blob URL when image loads (convert to data URL for better memory management)
            const img = new Image();
            img.onload = () => {
                // Create a canvas to convert blob to data URL
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Convert to data URL and update thumbnail
                const dataURL = canvas.toDataURL('image/jpeg', 0.8);
                thumbnailEl.style.backgroundImage = `url(${dataURL})`;
                
                // Clean up blob URL
                URL.revokeObjectURL(objectURL);
                thumbnailEl.removeAttribute('data-thumbnail-url');
            };
            img.src = objectURL;
            
        } catch (error) {
            console.error('Error loading thumbnail:', error);
            thumbnailEl.classList.remove('loading');
            thumbnailEl.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%23dc3545\' width=\'48px\' height=\'48px\'%3E%3Cpath d=\'M0 0h24v24H0z\' fill=\'none\'/%3E%3Cpath d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z\'/%3E%3C/svg%3E")';
            thumbnailEl.style.backgroundSize = '48px';
            thumbnailEl.style.backgroundColor = '#f8d7da';
        }
    }
    
    // View file function
    async function viewFile(file) {
        try {
            const previewContainer = document.getElementById('preview-container');
            
            // Show the modal immediately with loading state
            previewModal.style.display = 'block';
            previewContainer.innerHTML = '<div class="loading">Loading...</div>';
            
            // Force reflow for animation
            requestAnimationFrame(() => {
                previewModal.style.opacity = '1';
            });
            
            // Fetch the encrypted file
            const response = await fetch(file.path);
            
            if (!response.ok) {
                throw new Error('Failed to load file');
            }
            
            // Get the encrypted data
            const encryptedData = await response.text();
            
            // Decrypt the data
            const mimeType = getFileTypeFromName(file.name);
            const decryptedBlob = await decryptFile(encryptedData, encryptionKey, mimeType);
            
            // Create object URL for the decrypted blob
            const objectURL = URL.createObjectURL(decryptedBlob);
            
            // Clear the loading message
            previewContainer.innerHTML = '';
            
            // Create appropriate element based on file type
            if (isImageFile(file.name)) {
                const img = document.createElement('img');
                img.src = objectURL;
                img.alt = file.name;
                img.onload = () => URL.revokeObjectURL(objectURL); // Clean up when loaded
                previewContainer.appendChild(img);
            } else if (isVideoFile(file.name)) {
                const video = document.createElement('video');
                video.src = objectURL;
                video.controls = true;
                video.autoplay = true;
                
                // Store the URL for cleanup when modal is closed
                video.setAttribute('data-object-url', objectURL);
                
                // Clean up URL when video ends or when modal is closed
                video.addEventListener('ended', () => {
                    URL.revokeObjectURL(objectURL);
                });
                
                previewContainer.appendChild(video);
            } else {
                // For other file types, show download link
                const link = document.createElement('a');
                link.href = objectURL;
                link.download = file.name;
                link.textContent = `Download ${file.name}`;
                link.classList.add('btn', 'primary-btn');
                previewContainer.appendChild(link);
            }
        } catch (error) {
            console.error('Error viewing file:', error);
            document.getElementById('preview-container').innerHTML = 
                '<div class="error">Failed to decrypt and display the file</div>';
        }
    }
    
    // Confirm and delete file or folder
    function confirmDelete(file, isFolder = false) {
        const itemType = isFolder ? 'folder and all its contents' : 'file';
        if (confirm(`Are you sure you want to delete ${file.name} ${itemType}?`)) {
            deleteFile(file);
        }
    }
    
    // Delete file or folder function
    async function deleteFile(file) {
        try {
            // Use the relativePath if available, otherwise fallback to name
            const filePath = file.relativePath || file.name;
            const url = new URL('/api/files', window.location.origin);
            url.searchParams.append('path', filePath);
            const response = await fetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to delete ${file.isDirectory ? 'folder' : 'file'}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Reload files after successful deletion
                loadFiles();
            } else {
                alert(`Failed to delete ${file.isDirectory ? 'folder' : 'file'}: ${data.message}`);
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting file');
        }
    }
    
    // Set up upload form
    function setupUploadForm() {
        const uploadForm = document.getElementById('upload-form');
        const fileInput = document.getElementById('file-input');
        const uploadProgress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        const uploadMessage = document.getElementById('upload-message');
        
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const files = Array.from(fileInput.files);
            
            if (files.length === 0) {
                uploadMessage.textContent = 'Please select at least one file';
                uploadMessage.className = 'message error';
                return;
            }
            
            // Check file count limit (50 files max)
            if (files.length > 50) {
                uploadMessage.textContent = `Too many files selected. Maximum 50 files allowed per upload, you selected ${files.length} files.`;
                uploadMessage.className = 'message error';
                return;
            }
            
            // Check file size limit (100MB per file)
            const maxSizeBytes = 100 * 1024 * 1024;
            const oversizedFiles = files.filter(file => file.size > maxSizeBytes);
            if (oversizedFiles.length > 0) {
                uploadMessage.textContent = `${oversizedFiles.length} file(s) exceed the 100MB limit per file`;
                uploadMessage.className = 'message error';
                return;
            }
            
            try {
                // Show progress
                uploadProgress.style.display = 'block';
                progressBar.style.width = '10%';
                
                uploadMessage.textContent = `Encrypting ${files.length} file(s)...`;
                uploadMessage.className = 'message';
                
                // Create form data
                const formData = new FormData();
                
                // Encrypt and add each file to form data
                let encryptedCount = 0;
                for (const file of files) {
                    const encryptedFile = await encryptFile(file, encryptionKey);
                    formData.append('files', encryptedFile, file.name);
                    
                    encryptedCount++;
                    const encryptProgress = 10 + (encryptedCount / files.length) * 40; // 10% to 50%
                    progressBar.style.width = `${encryptProgress}%`;
                }
                
                // Add current path to form data
                formData.append('currentPath', currentPath);
                
                progressBar.style.width = '60%';
                uploadMessage.textContent = `Uploading ${files.length} encrypted file(s)...`;
                
                // Upload the encrypted files
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                progressBar.style.width = '90%';
                
                const data = await response.json();
                
                if (data.success) {
                    progressBar.style.width = '100%';
                    uploadMessage.textContent = data.message;
                    uploadMessage.className = 'message success';
                    
                    // Reset the form and close modal after a brief delay
                    setTimeout(() => {
                        uploadForm.reset();
                        uploadModal.style.display = 'none';
                        uploadProgress.style.display = 'none';
                        progressBar.style.width = '0';
                        uploadMessage.textContent = '';
                        uploadMessage.className = 'message';
                        
                        // Reset the drop area text
                        const dropText = document.querySelector('#drop-area p');
                        if (dropText) {
                            dropText.textContent = 'Drag & drop files here or click to browse';
                        }
                        
                        // Reload files to show new uploads
                        loadFiles();
                    }, 1500);
                } else {
                    throw new Error(data.message || 'Upload failed');
                }
            } catch (error) {
                console.error('Error during upload:', error);
                uploadMessage.textContent = error.message || 'Error uploading files';
                uploadMessage.className = 'message error';
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0';
            }
        });
    }
    
    // Set up drag and drop
    function setupDragDrop() {
        const dropArea = document.getElementById('drop-area');
        const fileInput = document.getElementById('file-input');
        
        // Add file input change listener to show selected files count
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            const dropText = dropArea.querySelector('p');
            
            if (files.length === 0) {
                dropText.textContent = 'Drag & drop files here or click to browse';
            } else if (files.length === 1) {
                dropText.textContent = `1 file selected: ${files[0].name}`;
            } else {
                dropText.textContent = `${files.length} files selected`;
            }
        });
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
            document.body.addEventListener(eventName, preventDefaults, false);
        });
        
        // Highlight drop area when dragging over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });
        
        // Remove highlight when dragging leaves
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });
        
        // Handle dropped files
        dropArea.addEventListener('drop', handleDrop, false);
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        function highlight() {
            dropArea.classList.add('highlight');
        }
        
        function unhighlight() {
            dropArea.classList.remove('highlight');
        }
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                // Create a new FileList-like object and assign it to the input
                const fileList = Array.from(files);
                
                // Create a new DataTransfer object and add files to it
                const dataTransfer = new DataTransfer();
                fileList.forEach(file => dataTransfer.items.add(file));
                
                // Assign the files to the input
                fileInput.files = dataTransfer.files;
                
                // Update the drop area text to show number of files selected
                const dropText = dropArea.querySelector('p');
                if (dropText && files.length > 1) {
                    dropText.textContent = `${files.length} files selected`;
                }
            }
        }
    }
    
    // Open upload modal
    function openUploadModal() {
        // Reset form state immediately
        const uploadForm = document.getElementById('upload-form');
        const uploadMessage = document.getElementById('upload-message');
        const uploadProgress = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        
        uploadForm.reset();
        uploadMessage.textContent = '';
        uploadMessage.className = 'message';
        uploadProgress.style.display = 'none';
        progressBar.style.width = '0';
        
        // Reset the drop area text
        const dropText = document.querySelector('#drop-area p');
        if (dropText) {
            dropText.textContent = 'Drag & drop files here or click to browse';
        }
        
        // Show modal immediately
        uploadModal.style.display = 'block';
        
        // Force reflow for animation
        requestAnimationFrame(() => {
            uploadModal.style.opacity = '1';
        });
    }
    
    // Open create folder modal
    function openCreateFolderModal() {
        // Create modal if it doesn't exist
        if (!document.getElementById('folder-modal')) {
            createFolderModal();
        }
        
        const folderModal = document.getElementById('folder-modal');
        const folderForm = document.getElementById('folder-form');
        const folderMessage = document.getElementById('folder-message');
        const submitBtn = folderForm.querySelector('button[type="submit"]');
        
        // Reset form state immediately
        folderForm.reset();
        folderMessage.textContent = '';
        folderMessage.className = 'message';
        
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Folder';
        }
        
        // Show modal immediately
        folderModal.style.display = 'block';
        
        // Force reflow for animation and focus input
        requestAnimationFrame(() => {
            folderModal.style.opacity = '1';
            const folderNameInput = document.getElementById('folder-name');
            if (folderNameInput) {
                folderNameInput.focus();
            }
        });
    }
    
    // Create folder modal HTML
    function createFolderModal() {
        const modal = document.createElement('div');
        modal.id = 'folder-modal';
        modal.className = 'modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Create New Folder</h2>
                <form id="folder-form" class="form">
                    <div class="form-group">
                        <label for="folder-name">Folder Name:</label>
                        <input type="text" id="folder-name" name="folder-name" required>
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn primary-btn">Create Folder</button>
                    </div>
                </form>
                <div id="folder-message" class="message"></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
            // Reset button state when closing modal
            const submitBtn = modal.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Folder';
            }
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                // Reset button state when closing modal
                const submitBtn = modal.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Folder';
                }
            }
        });
        
        // Handle folder creation
        document.getElementById('folder-form').addEventListener('submit', createFolder);
    }
    
    // Create folder function
    async function createFolder(e) {
        e.preventDefault();
        
        const folderName = document.getElementById('folder-name').value.trim();
        const folderMessage = document.getElementById('folder-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        if (!folderName) {
            folderMessage.textContent = 'Please enter a folder name';
            folderMessage.className = 'message error';
            return;
        }
        
        // Check for invalid characters
        if (/[\\/:*?"<>|]/.test(folderName)) {
            folderMessage.textContent = 'Folder name contains invalid characters';
            folderMessage.className = 'message error';
            return;
        }
        
        // Disable button immediately
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';
        
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    currentPath: currentPath
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Close modal immediately and reload files
                document.getElementById('folder-modal').style.display = 'none';
                loadFiles();
            } else {
                folderMessage.textContent = data.message || 'Failed to create folder';
                folderMessage.className = 'message error';
                // Re-enable button on error
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Folder';
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            folderMessage.textContent = 'Error creating folder';
            folderMessage.className = 'message error';
            // Re-enable button on error
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Folder';
        }
    }
    
    // Handle logout
    async function handleLogout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });
            
            // Clear encryption key from session storage
            sessionStorage.removeItem('encryptionKey');
            
            // Redirect to login page
            window.location.href = '/login';
        } catch (error) {
            console.error('Error during logout:', error);
            alert('Error during logout');
        }
    }
});
