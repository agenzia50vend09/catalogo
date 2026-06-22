// --- CONFIGURAZIONE WEB APP GOOGLE SHEETS ---
const API_URL = "https://script.google.com/macros/s/AKfycbx778vC2rPCpLIHB7TnG1nsPUymQeUvKR_uNmfKYG-EzoO5-aTz-qkalxX1UXgObxZDFg/exec";

class CatalogApp {
    constructor() {
        this.products = [];
        this.credentials = [];
        this.currentView = { type: 'home', value: null }; // home, all, brand, type, packtype
        
        this.init();
    }

    async init() {
        this.checkAdminSession();
        await this.loadDataFromSheets();
        
        // Generiamo i menu e renderizziamo SOLO SE il caricamento remoto ha avuto successo.
        // Se è fallito, loadMockData() ha già pensato a fare il build e il render.
        if (this.products.length > 0) {
            this.buildFilterMenus();
            this.render();
        }
    }

    // Caricamento asincrono centralizzato da Google Fogli
    async loadDataFromSheets() {
        try {
            // Aggiunto un timestamp in query string per prevenire il caching aggressivo del browser
            const response = await fetch(`${API_URL}?_=${Date.now()}`);
            if (!response.ok) throw new Error("Risposta del server non valida");
            
            const data = await response.json();
            this.products = data.prodotti || [];
            this.credentials = data.credenziali || [];
        } catch (error) {
            console.error("Errore nel caricamento dati da Google Sheets:", error);
            alert("Impossibile connettersi al database di Google Fogli. Verranno usati dati locali simulati.");
            this.loadMockData();
        }
    }

    // Sincronizzazione con il database di Google Fogli (Invia modifiche)
    async syncWithSheets(action, payload) {
        try {
            // Rimossa la modalità 'no-cors' che bloccava la risposta e interrompeva il flusso JS.
            // Usiamo 'text/plain' per evitare che il browser invii una richiesta OPTIONS (pre-flight), 
            // cosa che Google Apps Script digerisce molto meglio.
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action, data: payload })
            });
            
            // Ricarica i dati aggiornati dal database remoto
            await this.loadDataFromSheets();
            this.render();
            if (this.isAdminActive()) {
                this.renderAdminTable();
            }
        } catch (error) {
            console.error("Errore di sincronizzazione:", error);
            alert("Si è verificato un errore durante il salvataggio dei dati su Google Fogli.");
        }
    }

    isAdminActive() {
        return localStorage.getItem('isAdminSession') === 'true';
    }

    // Controllo se la sessione admin è salvata in localStorage
    checkAdminSession() {
        const adminPanel = document.getElementById('admin-panel');
        const adminGateBtn = document.getElementById('btn-admin-gate');

        if (this.isAdminActive()) {
            adminPanel.classList.remove('hidden');
            adminGateBtn.innerHTML = '<i class="fa-solid fa-unlock"></i> Pannello Aperto';
            this.renderAdminTable();
        } else {
            adminPanel.classList.add('hidden');
            adminGateBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Admin';
        }
    }

    toggleAdminModal(show) {
        document.getElementById('login-modal').style.display = show ? 'flex' : 'none';
    }

    handleLogin(e) {
        e.preventDefault();
        const userIn = document.getElementById('username').value;
        const passIn = document.getElementById('password').value;

        const valid = this.credentials.some(c => c.username === userIn && c.password === passIn);

        if (valid) {
            localStorage.setItem('isAdminSession', 'true');
            this.toggleAdminModal(false);
            this.checkAdminSession();
            document.getElementById('login-form').reset();
        } else {
            alert("Credenziali non valide. Riprova.");
        }
    }

    handleLogout() {
        localStorage.removeItem('isAdminSession');
        this.checkAdminSession();
    }

    buildFilterMenus() {
        const types = ['gum', 'caramella', 'lollipop', 'gommose'];
        const packtypes = ['stick', 'box', 'monopezzo', 'lollipop', 'busta', 'bottle'];

        const typeContainer = document.getElementById('dropdown-type');
        if (typeContainer) {
            typeContainer.innerHTML = types.map(t => `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`).join('');
        }

        const packContainer = document.getElementById('dropdown-packtype');
        if (packContainer) {
            packContainer.innerHTML = packtypes.map(p => `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`).join('');
        }
    }

    setFilter(filterType, value) {
        this.currentView = { type: filterType, value: value };
        this.render();
    }

    viewAllProducts() {
        this.currentView = { type: 'all', value: null };
        this.render();
    }

    renderCatalog() {
        this.currentView = { type: 'home', value: null };
        this.render();
    }

    // Gestione dell'anteprima in tempo reale all'inserimento dell'URL di Google Drive
    handleUrlPreview(url) {
        const previewContainer = document.getElementById('photo-preview-container');
        const previewImg = document.getElementById('photo-preview');

        if (url && url.trim() !== "") {
            previewImg.src = url;
            previewContainer.classList.remove('hidden');
        } else {
            previewContainer.classList.add('hidden');
        }
    }

    // Ritorna l'URL dell'immagine salvato o un placeholder SVG integrato in caso di errore/campo vuoto
    getPhotoUrl(photoData) {
        if (!photoData || photoData.trim() === "" || photoData.startsWith('photo_')) {
            return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext x="50%" y="50%" font-family="Arial" font-size="14" fill="%23999" text-anchor="middle" dy=".3em"%3ENessuna foto%3C/text%3E%3C/svg%3E';
        }
        return photoData; // Restituisce direttamente l'URL web/Google Drive
    }

    // --- RENDERING SEZIONE CATALOGO UTENTE ---
    render() {
        const container = document.getElementById('main-content');
        if (!container) return;
        container.innerHTML = ''; 

        if (this.currentView.type === 'home') {
            const novitaProducts = this.products.filter(p => String(p.novita) === 'true');
            if (novitaProducts.length > 0) {
                container.appendChild(this.createSectionHeading("✨ Novità In Evidenza"));
                container.appendChild(this.createGrid(novitaProducts));
            }

            const brands = [...new Set(this.products.map(p => p.brand))];
            brands.forEach(brand => {
                const brandProducts = this.products.filter(p => p.brand === brand).slice(0, 3);
                
                const headingEl = document.createElement('h2');
                headingEl.className = 'section-title';
                headingEl.innerHTML = `<span class="brand-title" onclick="app.setFilter('brand', '${brand}')">${brand} &raquo;</span>`;
                
                container.appendChild(headingEl);
                container.appendChild(this.createGrid(brandProducts));
            });
        } 
        else {
            let filteredList = [];
            let titleText = "";

            switch(this.currentView.type) {
                case 'all':
                    filteredList = this.products;
                    titleText = "Tutto il Catalogo Prodotti";
                    break;
                case 'brand':
                    filteredList = this.products.filter(p => p.brand === this.currentView.value);
                    titleText = `Prodotti del Brand: ${this.currentView.value}`;
                    break;
                case 'type':
                    filteredList = this.products.filter(p => p.type === this.currentView.value);
                    titleText = `Categoria: ${this.currentView.value}`;
                    break;
                case 'packtype':
                    filteredList = this.products.filter(p => p.packtype === this.currentView.value);
                    titleText = `Confezione: ${this.currentView.value}`;
                    break;
            }

            container.appendChild(this.createSectionHeading(titleText));
            container.appendChild(this.createGrid(filteredList));
        }
    }

    createSectionHeading(text) {
        const h2 = document.createElement('h2');
        h2.className = 'section-title';
        h2.innerText = text;
        return h2;
    }

    createGrid(productsList) {
        const grid = document.createElement('div');
        grid.className = 'grid-products';

        if(productsList.length === 0) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--gray-text);">Nessun prodotto trovato in questa selezione.</p>`;
            return grid;
        }

        productsList.forEach(prod => {
            const isDisponibile = String(prod.disponibile) === 'true';
            const isNovita = String(prod.novita) === 'true';
            const photoUrl = this.getPhotoUrl(prod.foto);

            const card = document.createElement('div');
            card.className = `product-card ${!isDisponibile ? 'out-of-stock' : ''}`;
            
            card.innerHTML = `
                ${isNovita ? '<div class="badge-novita">Novità</div>' : ''}
                <div class="product-img-container">
                    <img src="${photoUrl}" alt="${prod.nome}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%2
