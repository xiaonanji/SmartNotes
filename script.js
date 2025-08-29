class SmartNotes {
    constructor() {
        this.notebooks = this.loadNotebooks();
        this.currentNotebook = null;
        this.currentView = 'notebooks';
        
        this.initializeEventListeners();
        this.renderNotebooks();
    }

    loadNotebooks() {
        const stored = localStorage.getItem('smartnotes-notebooks');
        return stored ? JSON.parse(stored) : [];
    }

    saveNotebooks() {
        localStorage.setItem('smartnotes-notebooks', JSON.stringify(this.notebooks));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    initializeEventListeners() {
        // Navigation
        document.getElementById('homeBtn').addEventListener('click', () => this.showNotebooks());
        document.getElementById('backBtn').addEventListener('click', () => this.showNotebooks());

        // Notebook creation
        document.getElementById('createNotebookBtn').addEventListener('click', () => this.showCreateNotebookModal());
        document.getElementById('cancelNotebookBtn').addEventListener('click', () => this.hideCreateNotebookModal());
        document.getElementById('saveNotebookBtn').addEventListener('click', () => this.createNotebook());
        document.getElementById('notebookNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createNotebook();
        });

        // Note creation
        document.getElementById('createNoteBtn').addEventListener('click', () => this.showCreateNoteModal());
        document.getElementById('cancelNoteBtn').addEventListener('click', () => this.hideCreateNoteModal());
        document.getElementById('saveNoteBtn').addEventListener('click', () => this.createNote());

        // Note type selection
        document.querySelectorAll('.note-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectNoteType(e.target.dataset.type));
        });

        // File input for images
        document.getElementById('noteImageInput').addEventListener('change', (e) => this.handleImageFile(e));

        // Paste functionality
        this.setupPasteHandlers();

        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideCreateNotebookModal();
                    this.hideCreateNoteModal();
                }
            });
        });
    }

    setupPasteHandlers() {
        const imagePasteArea = document.getElementById('imagePasteArea');
        const textPasteArea = document.getElementById('textPasteArea');

        // Image paste area
        imagePasteArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imagePasteArea.classList.add('dragover');
        });

        imagePasteArea.addEventListener('dragleave', () => {
            imagePasteArea.classList.remove('dragover');
        });

        imagePasteArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imagePasteArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            const imageFile = files.find(file => file.type.startsWith('image/'));
            if (imageFile) {
                this.handleImageFile({ target: { files: [imageFile] } });
            }
        });

        // Global paste handler for images
        document.addEventListener('paste', (e) => {
            if (this.currentNoteType === 'image' && document.getElementById('createNoteModal').classList.contains('show')) {
                const items = Array.from(e.clipboardData.items);
                const imageItem = items.find(item => item.type.startsWith('image/'));
                
                if (imageItem) {
                    e.preventDefault();
                    const file = imageItem.getAsFile();
                    this.handleImageFile({ target: { files: [file] } });
                }
            }
        });
    }

    showNotebooks() {
        this.currentView = 'notebooks';
        this.currentNotebook = null;
        
        document.getElementById('notebooks-view').style.display = 'block';
        document.getElementById('notes-view').style.display = 'none';
        document.getElementById('homeBtn').classList.add('active');
        document.getElementById('backBtn').style.display = 'none';
        
        this.renderNotebooks();
    }

    showNotebook(notebookId) {
        this.currentNotebook = this.notebooks.find(nb => nb.id === notebookId);
        if (!this.currentNotebook) return;

        this.currentView = 'notes';
        
        document.getElementById('notebooks-view').style.display = 'none';
        document.getElementById('notes-view').style.display = 'block';
        document.getElementById('homeBtn').classList.remove('active');
        document.getElementById('backBtn').style.display = 'block';
        document.getElementById('notebook-title').textContent = this.currentNotebook.name;
        
        this.renderNotes();
    }

    showCreateNotebookModal() {
        document.getElementById('createNotebookModal').classList.add('show');
        document.getElementById('notebookNameInput').focus();
    }

    hideCreateNotebookModal() {
        document.getElementById('createNotebookModal').classList.remove('show');
        document.getElementById('notebookNameInput').value = '';
    }

    createNotebook() {
        const name = document.getElementById('notebookNameInput').value.trim();
        if (!name) return;

        const notebook = {
            id: this.generateId(),
            name: name,
            notes: [],
            createdAt: new Date().toISOString()
        };

        this.notebooks.push(notebook);
        this.saveNotebooks();
        this.renderNotebooks();
        this.hideCreateNotebookModal();
    }

    deleteNotebook(notebookId) {
        if (confirm('Are you sure you want to delete this notebook and all its notes?')) {
            this.notebooks = this.notebooks.filter(nb => nb.id !== notebookId);
            this.saveNotebooks();
            this.renderNotebooks();
        }
    }

    showCreateNoteModal() {
        if (!this.currentNotebook) return;
        
        this.currentNoteType = null;
        document.getElementById('createNoteModal').classList.add('show');
        document.getElementById('noteContentArea').style.display = 'none';
        document.getElementById('saveNoteBtn').style.display = 'none';
        
        // Reset all inputs
        document.querySelectorAll('.note-type-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('noteTextInput').value = '';
        document.getElementById('noteImageInput').value = '';
        document.querySelector('#textPasteArea textarea').value = '';
    }

    hideCreateNoteModal() {
        document.getElementById('createNoteModal').classList.remove('show');
        this.currentNoteType = null;
    }

    selectNoteType(type) {
        this.currentNoteType = type;
        
        document.querySelectorAll('.note-type-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelector(`[data-type="${type}"]`).classList.add('selected');
        
        // Show content area
        document.getElementById('noteContentArea').style.display = 'block';
        document.getElementById('saveNoteBtn').style.display = 'block';
        
        // Hide all input types
        document.getElementById('noteTextInput').style.display = 'none';
        document.getElementById('noteImageInput').style.display = 'none';
        document.getElementById('imagePasteArea').style.display = 'none';
        document.getElementById('textPasteArea').style.display = 'none';
        
        // Show appropriate input
        switch (type) {
            case 'text':
                document.getElementById('noteTextInput').style.display = 'block';
                document.getElementById('noteTextInput').focus();
                break;
            case 'image':
                document.getElementById('noteImageInput').style.display = 'block';
                document.getElementById('imagePasteArea').style.display = 'block';
                break;
            case 'paste':
                document.getElementById('textPasteArea').style.display = 'block';
                document.querySelector('#textPasteArea textarea').focus();
                break;
        }
    }

    handleImageFile(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedImageData = e.target.result;
            
            // Show preview
            let preview = document.getElementById('imagePreview');
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'imagePreview';
                preview.style.maxWidth = '200px';
                preview.style.maxHeight = '200px';
                preview.style.marginTop = '1rem';
                preview.style.borderRadius = '6px';
                document.getElementById('imagePasteArea').appendChild(preview);
            }
            preview.src = this.selectedImageData;
        };
        reader.readAsDataURL(file);
    }

    createNote() {
        if (!this.currentNotebook || !this.currentNoteType) return;

        let content = '';
        let type = this.currentNoteType;

        switch (type) {
            case 'text':
                content = document.getElementById('noteTextInput').value.trim();
                break;
            case 'image':
                content = this.selectedImageData;
                break;
            case 'paste':
                content = document.querySelector('#textPasteArea textarea').value.trim();
                break;
        }

        if (!content) return;

        const note = {
            id: this.generateId(),
            type: type,
            content: content,
            createdAt: new Date().toISOString()
        };

        this.currentNotebook.notes.push(note);
        this.saveNotebooks();
        this.renderNotes();
        this.hideCreateNoteModal();
    }

    deleteNote(noteId) {
        if (!this.currentNotebook) return;
        
        if (confirm('Are you sure you want to delete this note?')) {
            this.currentNotebook.notes = this.currentNotebook.notes.filter(note => note.id !== noteId);
            this.saveNotebooks();
            this.renderNotes();
        }
    }

    renderNotebooks() {
        const container = document.getElementById('notebooks-container');
        
        if (this.notebooks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No notebooks yet</h3>
                    <p>Create your first notebook to start taking notes</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notebooks.map(notebook => `
            <div class="notebook-card" onclick="app.showNotebook('${notebook.id}')">
                <button class="delete-btn" onclick="event.stopPropagation(); app.deleteNotebook('${notebook.id}')" title="Delete notebook">×</button>
                <h3>${this.escapeHtml(notebook.name)}</h3>
                <div class="note-count">${notebook.notes.length} notes</div>
            </div>
        `).join('');
    }

    renderNotes() {
        if (!this.currentNotebook) return;
        
        const container = document.getElementById('notes-container');
        
        if (this.currentNotebook.notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No notes yet</h3>
                    <p>Create your first note card</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.currentNotebook.notes.map(note => {
            const date = new Date(note.createdAt).toLocaleDateString();
            const typeEmoji = {
                'text': '📝',
                'image': '🖼️',
                'paste': '📋'
            }[note.type];

            let contentHtml = '';
            switch (note.type) {
                case 'text':
                case 'paste':
                    contentHtml = `<div class="note-text">${this.escapeHtml(note.content)}</div>`;
                    break;
                case 'image':
                    contentHtml = `<img src="${note.content}" alt="Note image" />`;
                    break;
            }

            return `
                <div class="note-card">
                    <button class="delete-btn" onclick="app.deleteNote('${note.id}')" title="Delete note">×</button>
                    <div class="note-type">${typeEmoji}</div>
                    <div class="note-content">${contentHtml}</div>
                    <div class="note-date">${date}</div>
                </div>
            `;
        }).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app
const app = new SmartNotes();