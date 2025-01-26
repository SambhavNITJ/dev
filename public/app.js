const socket = io();

// DOM Elements
const loginSection = document.getElementById('login-section');
const workspace = document.getElementById('workspace');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const createDocBtn = document.getElementById('create-doc-btn');
const documentsList = document.getElementById('documents-list');
const documentEditor = document.getElementById('document-editor');
const currentDocName = document.getElementById('current-doc-name');
const documentContent = document.getElementById('document-content');
const backToDocsBtn = document.getElementById('back-to-docs');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const filesList = document.getElementById('files-list');
const fileViewer = document.getElementById('file-viewer');
const currentFileName = document.getElementById('current-file-name');
const imagePreview = document.getElementById('image-preview');
const pdfPreview = document.getElementById('pdf-preview');
const pdfControls = document.getElementById('pdf-controls');
const prevPage = document.getElementById('prev-page');
const nextPage = document.getElementById('next-page');
const pageNum = document.getElementById('page-num');
const pageCount = document.getElementById('page-count');
const backToFiles = document.getElementById('back-to-files');

let currentRoom = null;
let currentDocument = null;
let pdfDoc = null;
let pageNum_ = 1;
let currentPdfFile = null;
let currentRenderTask = null;

// Create Room
if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
        socket.emit('create-room');
    });
}

// Join Room
if (joinRoomBtn && roomCodeInput) {
    joinRoomBtn.addEventListener('click', () => {
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        if (roomCode) {
            socket.emit('join-room', roomCode);
        }
    });
}

// PDF rendering function with improved error handling
async function renderPage(num, retryCount = 0) {
    if (!pdfDoc) {
        console.error('No PDF document loaded');
        return;
    }
    
    try {
        // Cancel any ongoing render task
        if (currentRenderTask) {
            await currentRenderTask.cancel();
            currentRenderTask = null;
        }

        // Validate page number
        if (num < 1) num = 1;
        if (num > pdfDoc.numPages) num = pdfDoc.numPages;
        
        // Show loading state
        if (pdfPreview) {
            pdfPreview.style.opacity = '0.5';
            const msg = createLoadingMessage('Rendering page...');
            pdfPreview.parentElement.appendChild(msg);
        }

        const page = await pdfDoc.getPage(num);
        const canvas = pdfPreview;
        const ctx = canvas.getContext('2d');
        
        // Calculate scale to fit width while maintaining aspect ratio
        const viewport = page.getViewport({ scale: 1.0 });
        const parent = canvas.parentElement;
        const desiredWidth = parent.clientWidth - 40; // 20px padding on each side
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        
        // Clear previous content
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport
        };
        
        // Store the render task and wait for it to complete
        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;
        currentRenderTask = null;
        
        // Update page number display
        if (pageNum) pageNum.textContent = num;
        pageNum_ = num;

        // Remove loading message and restore opacity
        if (pdfPreview) {
            pdfPreview.style.opacity = '1';
            removeLoadingMessage();
        }

        // Emit page change to other users
        if (currentRoom && currentPdfFile) {
            socket.emit('pdf-page-change', {
                roomCode: currentRoom,
                page: num,
                filename: currentPdfFile
            });
        }
    } catch (error) {
        console.error('Error rendering page:', error);
        removeLoadingMessage();
        currentRenderTask = null;
        
        if (retryCount < 2 && error.name !== 'RenderingCancelled') {
            console.log(`Retrying render, attempt ${retryCount + 1}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return renderPage(num, retryCount + 1);
        } else {
            if (pdfPreview) pdfPreview.style.opacity = '1';
            console.error('Failed to render PDF page after retries');
        }
    }
}

// PDF navigation with debouncing
let navigationTimeout = null;

if (prevPage) {
    prevPage.addEventListener('click', () => {
        if (pageNum_ <= 1 || !pdfDoc) return;
        clearTimeout(navigationTimeout);
        navigationTimeout = setTimeout(() => {
            pageNum_--;
            renderPage(pageNum_);
        }, 100);
    });
}

if (nextPage) {
    nextPage.addEventListener('click', () => {
        if (!pdfDoc || pageNum_ >= pdfDoc.numPages) return;
        clearTimeout(navigationTimeout);
        navigationTimeout = setTimeout(() => {
            pageNum_++;
            renderPage(pageNum_);
        }, 100);
    });
}

// Create Document with file upload
if (createDocBtn) {
    createDocBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt,.doc,.docx,.pdf';
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type.includes('text') || file.name.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    socket.emit('create-document', {
                        roomCode: currentRoom,
                        docName: file.name,
                        content: event.target.result
                    });
                };
                reader.readAsText(file);
            } else {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('roomCode', currentRoom);

                try {
                    const response = await fetch('/upload', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        alert(data.error || 'Upload failed');
                    }
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('Upload failed');
                }
            }
        });

        fileInput.click();
    });
}

// Document Selection
if (documentsList) {
    documentsList.addEventListener('click', (e) => {
        const docItem = e.target.closest('.document-item');
        if (docItem) {
            const docName = docItem.dataset.name;
            currentDocument = docName;
            currentDocName.textContent = docName;
            documentContent.value = docItem.dataset.content;
            documentsList.parentElement.classList.add('d-none');
            documentEditor.classList.remove('d-none');
        }
    });
}

// Back to Documents List
if (backToDocsBtn) {
    backToDocsBtn.addEventListener('click', () => {
        documentEditor.classList.add('d-none');
        documentsList.parentElement.classList.remove('d-none');
        currentDocument = null;
    });
}

// Document Content Changes
if (documentContent) {
    let timeout = null;
    documentContent.addEventListener('input', () => {
        if (currentRoom && currentDocument) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                socket.emit('update-document', {
                    roomCode: currentRoom,
                    docName: currentDocument,
                    content: documentContent.value
                });
            }, 500);
        }
    });
}

// File upload handling
if (uploadForm && fileInput) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('roomCode', currentRoom);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (response.ok) {
                fileInput.value = '';
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload failed');
        }
    });
}

// File viewing
function addFileToList(fileInfo) {
    if (!filesList) return;
    
    const fileItem = document.createElement('div');
    fileItem.className = 'list-group-item file-item';
    fileItem.dataset.path = fileInfo.path;
    fileItem.dataset.type = fileInfo.type;
    fileItem.dataset.name = fileInfo.originalName;
    fileItem.innerHTML = `
        <i class="fas fa-${fileInfo.type.includes('pdf') ? 'file-pdf' : 'image'}"></i>
        ${fileInfo.originalName}
    `;
    fileItem.addEventListener('click', () => viewFile(fileInfo));
    filesList.appendChild(fileItem);
}

async function viewFile(fileInfo) {
    if (!fileViewer || !currentFileName) return;
    
    try {
        // Cancel any ongoing render task
        if (currentRenderTask) {
            await currentRenderTask.cancel();
            currentRenderTask = null;
        }

        currentFileName.textContent = fileInfo.originalName;
        documentEditor.classList.add('d-none');
        fileViewer.classList.remove('d-none');

        if (fileInfo.type.includes('pdf')) {
            imagePreview.classList.add('d-none');
            pdfPreview.classList.remove('d-none');
            pdfControls.classList.remove('d-none');

            try {
                // Show loading state
                pdfPreview.style.opacity = '0.5';
                const msg = createLoadingMessage('Loading PDF...');
                pdfPreview.parentElement.appendChild(msg);

                // Load PDF with timeout
                const pdfDataPromise = fetch(fileInfo.path)
                    .then(res => {
                        if (!res.ok) throw new Error('Failed to fetch PDF');
                        return res.arrayBuffer();
                    });
                
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('PDF loading timeout')), 15000)
                );

                const pdfData = await Promise.race([pdfDataPromise, timeoutPromise]);
                
                // Initialize PDF.js with basic options
                const loadingTask = pdfjsLib.getDocument({
                    data: pdfData,
                    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                    cMapPacked: true
                });
                
                // Track loading progress
                loadingTask.onProgress = function (progressData) {
                    if (progressData.total > 0) {
                        const percent = (progressData.loaded / progressData.total * 100).toFixed(0);
                        const msg = document.getElementById('pdf-loading-msg');
                        if (msg) {
                            msg.textContent = `Loading PDF... ${percent}%`;
                        }
                    }
                };

                pdfDoc = await loadingTask.promise;
                
                // Set page count and initialize
                if (pageCount) pageCount.textContent = pdfDoc.numPages;
                currentPdfFile = fileInfo.originalName;
                pageNum_ = 1;

                // Remove loading message and restore opacity
                removeLoadingMessage();
                pdfPreview.style.opacity = '1';

                // Emit PDF file change to other users
                if (currentRoom) {
                    socket.emit('pdf-file-change', {
                        roomCode: currentRoom,
                        filename: fileInfo.originalName
                    });
                }

                // Initial render
                await renderPage(pageNum_);
            } catch (error) {
                console.error('Error loading PDF:', error);
                pdfDoc = null;
                currentPdfFile = null;
                currentRenderTask = null;
                
                // Clean up UI
                pdfPreview.classList.add('d-none');
                pdfControls.classList.add('d-none');
                removeLoadingMessage();
                pdfPreview.style.opacity = '1';
                
                alert('Error loading PDF file. Please try again.');
            }
        } else {
            currentPdfFile = null;
            pdfDoc = null;
            currentRenderTask = null;
            pdfPreview.classList.add('d-none');
            pdfControls.classList.add('d-none');
            imagePreview.classList.remove('d-none');
            imagePreview.src = fileInfo.path;
        }
    } catch (error) {
        console.error('Error in viewFile:', error);
        alert('Error viewing file. Please try again.');
    }
}

// Back to files list
if (backToFiles) {
    backToFiles.addEventListener('click', () => {
        fileViewer.classList.add('d-none');
        documentsList.parentElement.classList.remove('d-none');
        pdfDoc = null;
        currentPdfFile = null;
        currentRenderTask = null;
    });
}

// Chat Message Sending
if (sendMessageBtn && chatInput) {
    sendMessageBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function sendMessage() {
    if (!chatInput) return;
    
    const message = chatInput.value.trim();
    if (message && currentRoom) {
        socket.emit('send-message', {
            roomCode: currentRoom,
            message
        });
        chatInput.value = '';
    }
}

// Socket Event Handlers
socket.on('room-created', (roomCode) => {
    currentRoom = roomCode;
    alert(`Room created! Room code: ${roomCode}`);
    if (loginSection) loginSection.classList.add('d-none');
    if (workspace) workspace.classList.remove('d-none');
});

socket.on('room-joined', async (data) => {
    if (data.success) {
        currentRoom = roomCodeInput.value.trim().toUpperCase();
        if (loginSection) loginSection.classList.add('d-none');
        if (workspace) workspace.classList.remove('d-none');
        
        // Load existing documents
        if (documentsList) {
            documentsList.innerHTML = '';
            data.documents.forEach(([name, content]) => {
                addDocumentToList(name, content);
            });
        }

        // Load existing files
        if (filesList) {
            filesList.innerHTML = '';
            data.files.forEach(addFileToList);
        }

        // Load existing chat messages
        if (chatMessages) {
            chatMessages.innerHTML = '';
            data.chat.forEach(addChatMessage);
        }

        // Load active PDF if exists
        if (data.activePdf && data.activePdf.filename) {
            const fileItem = Array.from(filesList.children)
                .find(item => item.dataset.name === data.activePdf.filename);
            if (fileItem) {
                const fileInfo = {
                    path: fileItem.dataset.path,
                    type: fileItem.dataset.type,
                    originalName: fileItem.dataset.name
                };
                await viewFile(fileInfo);
                if (pdfDoc) {
                    pageNum_ = data.activePdf.page;
                    await renderPage(pageNum_);
                }
            }
        }
    } else {
        alert(data.error);
    }
});

socket.on('document-created', ({ docName, content }) => {
    addDocumentToList(docName, content);
});

socket.on('document-updated', ({ docName, content }) => {
    if (currentDocument === docName && documentContent) {
        documentContent.value = content;
    }
    updateDocumentInList(docName, content);
});

socket.on('new-message', addChatMessage);
socket.on('file-uploaded', addFileToList);

// Handle PDF sync events with better error handling
socket.on('pdf-page-updated', async ({ page, filename }) => {
    try {
        const fileItem = Array.from(filesList.children)
            .find(item => item.dataset.name === filename);
        
        if (fileItem) {
            if (currentPdfFile !== filename) {
                // If different PDF is open, switch to the new one
                const fileInfo = {
                    path: fileItem.dataset.path,
                    type: fileItem.dataset.type,
                    originalName: fileItem.dataset.name
                };
                await viewFile(fileInfo);
            }
            
            if (pdfDoc) {
                pageNum_ = page;
                await renderPage(pageNum_);
            }
        }
    } catch (error) {
        console.error('Error handling page update:', error);
    }
});

socket.on('pdf-file-updated', async ({ filename }) => {
    try {
        const fileItem = Array.from(filesList.children)
            .find(item => item.dataset.name === filename);
        
        if (fileItem) {
            const fileInfo = {
                path: fileItem.dataset.path,
                type: fileItem.dataset.type,
                originalName: fileItem.dataset.name
            };
            await viewFile(fileInfo);
        }
    } catch (error) {
        console.error('Error handling file update:', error);
    }
});

// Helper Functions
function addDocumentToList(name, content) {
    if (!documentsList) return;
    
    const docItem = document.createElement('div');
    docItem.className = 'list-group-item document-item';
    docItem.dataset.name = name;
    docItem.dataset.content = content;
    docItem.textContent = name;
    documentsList.appendChild(docItem);
}

function updateDocumentInList(name, content) {
    if (!documentsList) return;
    
    const docItem = Array.from(documentsList.children)
        .find(item => item.dataset.name === name);
    if (docItem) {
        docItem.dataset.content = content;
    }
}

function addChatMessage(message) {
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${message.userId === socket.id ? 'own' : 'other'}`;
    messageDiv.textContent = message.message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to create loading message
function createLoadingMessage(text) {
    const existingMsg = document.getElementById('pdf-loading-msg');
    if (existingMsg) existingMsg.remove();
    
    const loadingMsg = document.createElement('div');
    loadingMsg.textContent = text;
    loadingMsg.style.position = 'absolute';
    loadingMsg.style.top = '50%';
    loadingMsg.style.left = '50%';
    loadingMsg.style.transform = 'translate(-50%, -50%)';
    loadingMsg.id = 'pdf-loading-msg';
    return loadingMsg;
}

// Helper function to remove loading message
function removeLoadingMessage() {
    const loadingMsg = document.getElementById('pdf-loading-msg');
    if (loadingMsg) loadingMsg.remove();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentRoom) {
        socket.disconnect();
    }
});
