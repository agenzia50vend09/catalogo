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
        this.buildFilterMenus();
        this.render();
    }

    // Caricamento asincrono centralizzato da Google Fogli
    async loadDataFromSheets() {
        try {
            const response = await fetch(API_URL);
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
            await fetch(API_URL, {
                method: "POST",
                mode: "no-cors", 
                headers: { "Content-Type": "application/json" },
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
        typeContainer.innerHTML = types.map(t => `<a href="#" onclick="app.setFilter('type', '${t}')">${t}</a>`).join('');

        const packContainer = document.getElementById('dropdown-packtype');
        packContainer.innerHTML = packtypes.map(p => `<a href="#" onclick="app.setFilter('packtype', '${p}')">${p}</a>`).join('');
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
                    <img src="${photoUrl}" alt="${prod.nome}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22%3EFoto non disponibile%3C/text%3E%3C/svg%3E'">
                </div>
                <div class="product-info">
                    <div class="product-brand">${prod.brand}</div>
                    <div class="product-name">${prod.nome}</div>
                    <div class="product-desc">${prod.descrizione}</div>
                    <div class="product-meta">
                        <span><i class="fa-solid fa-boxes-stacked"></i> ${prod.packtype}</span>
                        <span>🏷️ ${prod.type}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="product-price">${parseFloat(prod.prezzo).toFixed(2)}€</span>
                        <span style="font-size:12px; font-weight:bold; color:${isDisponibile ? 'var(--success-green)' : 'var(--danger-red)'}">
                            ${isDisponibile ? 'Disponibile' : 'Esaurito'}
                        </span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
        return grid;
    }

    // --- LOGICA PANNELLO ADMIN ---
    renderAdminTable() {
        const tbody = document.getElementById('admin-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = this.products.map(p => {
            const photoUrl = this.getPhotoUrl(p.foto);
            return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td><img src="${photoUrl}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23f0f0f0%22 width=%2240%22 height=%2240%22/%3E%3C/svg%3E'"></td>
                <td>${p.brand}</td>
                <td>${p.nome}</td>
                <td>${parseFloat(p.prezzo).toFixed(2)}€</td>
                <td>
                    <div class="admin-actions-btns">
                        <button type="button" class="btn-outline" style="padding:5px 10px; font-size:12px;" onclick="app.loadProductIntoForm('${p.id}')"><i class="fa-solid fa-pen"></i> Modifica</button>
                        <button type="button" class="btn-danger" style="padding:5px 10px; font-size:12px;" onclick="app.deleteProduct('${p.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    handleProductSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const fotoValue = document.getElementById('prod-foto').value;
        
        if (!fotoValue || fotoValue.trim() === "") {
            alert('Inserisci un URL valido per la foto del prodotto.');
            return;
        }
        
        const inputPrezzo = document.getElementById('prod-prezzo').value;
        const parsedPrezzo = parseFloat(inputPrezzo);

        if (isNaN(parsedPrezzo)) {
            alert('Inserisci un prezzo numerico valido.');
            return;
        }

        const productData = {
            id: id || 'P' + Date.now().toString().slice(-6),
            brand: document.getElementById('prod-brand').value,
            nome: document.getElementById('prod-nome').value,
            descrizione: document.getElementById('prod-descrizione').value,
            prezzo: parsedPrezzo, 
            disponibile: document.getElementById('prod-disponibile').checked,
            novita: document.getElementById('prod-novita').checked,
            type: document.getElementById('prod-type').value,
            packtype: document.getElementById('prod-packtype').value,
            foto: fotoValue.trim() // Salva la stringa dell'URL nel database remoto
        };

        if (id) {
            this.syncWithSheets('update', productData);
        } else {
            this.syncWithSheets('create', productData);
        }

        this.resetProductForm();
    }

    loadProductIntoForm(id) {
        const prod = this.products.find(p => String(p.id) === String(id));
        if(!prod) return;

        document.getElementById('form-title').innerText = "Modifica Prodotto #" + prod.id;
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-brand').value = prod.brand;
        document.getElementById('prod-nome').value = prod.nome;
        document.getElementById('prod-descrizione').value = prod.descrizione;
        
        // Carica il prezzo puro convertito nel modulo
        document.getElementById('prod-prezzo').value = parseFloat(prod.prezzo);
        
        document.getElementById('prod-disponibile').checked = String(prod.disponibile) === 'true';
        document.getElementById('prod-novita').checked = String(prod.novita) === 'true';
        document.getElementById('prod-type').value = prod.type;
        document.getElementById('prod-packtype').value = prod.packtype;
        
        // Inserisce l'URL nel campo di testo e attiva l'anteprima visiva
        document.getElementById('prod-foto').value = prod.foto;
        this.handleUrlPreview(prod.foto);

        document.getElementById('btn-cancel-edit').classList.remove('hidden');
        document.getElementById('btn-save').innerText = "Aggiorna Prodotto";
        window.scrollTo({top: document.getElementById('admin-panel').offsetTop, behavior: 'smooth'});
    }

    deleteProduct(id) {
        if(confirm(`Sei sicuro di voler eliminare il prodotto ID #${id}?`)) {
            this.syncWithSheets('delete', { id: id });
        }
    }

    resetProductForm() {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('prod-foto').value = '';
        document.getElementById('form-title').innerText = "Aggiungi Nuovo Prodotto";
        document.getElementById('btn-save').innerText = "Salva Prodotto";
        document.getElementById('btn-cancel-edit').classList.add('hidden');
        document.getElementById('photo-preview-container').classList.add('hidden');
    }

    loadMockData() {
        this.credentials = [{username: "admin", password: "password"}];
        this.products = [
            {id: "1", brand: "Frizz", nome: "Goleador Cola", descrizione: "Caramelle gommose frizzanti gusto Cola.", prezzo: 0.20, disponibile: true, novita: true, packtype: "monopezzo", type: "gommose", foto: ""},
            {id: "3", brand: "Chupa", nome: "Chupa Chups Fragola", descrizione: "Il lollipop più famoso al mondo.", prezzo: 0.50, disponibile: true, novita: true, packtype: "lollipop", type: "lollipop", foto: ""}
        ];
        this.buildFilterMenus();
        this.render();
    }
}

const app = new CatalogApp();
