let productsData = [];
let currentViewMode = 'brand'; // 'brand', 'all', 'type', 'packtype'

document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    if (localStorage.getItem("adminSessionActive") === "true") {
        document.getElementById("btn-logout").classList.remove("hidden");
    }
});

function showSection(sectionId) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    document.getElementById(sectionId).classList.remove('hidden');
    
    if (sectionId === 'catalog-view') {
        document.getElementById('btn-nav-catalog').classList.add('active');
        renderCatalog();
    } else if (sectionId === 'admin-view') {
        document.getElementById('btn-nav-admin').classList.add('active');
        renderAdminTable();
    }
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}?action=getProducts`);
        productsData = await response.json();
        renderCatalog();
    } catch (err) {
        console.error("Errore AJAX:", err);
        document.getElementById('catalog-container').innerHTML = "<p style='text-align:center; padding:20px; color:#FF4757; font-weight:bold;'>Impossibile caricare i dati del catalogo.</p>";
    }
}

function changeViewMode(mode) {
    currentViewMode = mode;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        if(b.getAttribute('onclick').includes(mode)) b.classList.add('active');
    });
    renderCatalog();
}

function renderCatalog() {
    const container = document.getElementById('catalog-container');
    const novitaWrapper = document.getElementById('novita-wrapper');
    const novitaContainer = document.getElementById('novita-container');
    
    container.innerHTML = "";
    novitaContainer.innerHTML = "";

    if (productsData.length === 0) {
        container.innerHTML = "<div class='loader'></div>";
        return;
    }

    // 1. GESTIONE EVIDENZA PRODOTTI NOVITÀ (Sempre in alto)
    const novitaItems = productsData.filter(p => p.novità && p.disponibile);
    if (novitaItems.length > 0) {
        novitaWrapper.classList.remove('hidden');
        novitaItems.forEach(p => novitaContainer.appendChild(createProductCard(p)));
    } else {
        novitaWrapper.classList.add('hidden');
    }

    // 2. GESTIONE FILTRI ED ELENCHI
    const activeProducts = productsData.filter(p => p.disponibile);

    if (currentViewMode === 'all') {
        const section = createGroupSection("Tutto il Catalogo", activeProducts, false);
        container.appendChild(section);
    } else {
        let grouped = {};
        activeProducts.forEach(p => {
            let key = p[currentViewMode] || 'Non Specificato';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(p);
        });

        for (let groupName in grouped) {
            const isBrandMode = currentViewMode === 'brand';
            const section = createGroupSection(groupName, grouped[groupName], isBrandMode);
            container.appendChild(section);
        }
    }
}

function createProductCard(p) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
        ${p.novità ? '<span class="card-badge">Novità</span>' : ''}
        <div class="img-container">
            <img src="${p.foto || 'https://via.placeholder.com/200'}" alt="${p.nome}" onerror="this.src='https://via.placeholder.com/200'">
        </div>
        <div class="card-body">
            <span class="card-brand">${p.brand}</span>
            <h4 class="card-title">${p.nome}</h4>
            <p class="card-desc">${p.descrizione}</p>
            <div class="card-footer">
                <span class="card-price">€ ${Number(p.prezzo).toFixed(2)}</span>
                <div class="card-tags">
                    <span>${p.type}</span>
                    <span>${p.packtype}</span>
                </div>
            </div>
        </div>
    `;
    return card;
}

function createGroupSection(title, products, limitToThree) {
    const section = document.createElement('div');
    section.className = 'catalog-group-section';

    const header = document.createElement('div');
    header.className = 'section-title';
    
    if (limitToThree) {
        header.innerHTML = `<h3 class="clickable-brand" onclick="viewFullBrand('${title.replace(/'/g, "\\'")}')">${title}</h3>`;
    } else {
        header.innerHTML = `<h3>${title}</h3>`;
    }

    const grid = document.createElement('div');
    grid.className = 'products-grid';
    
    const displayList = limitToThree ? products.slice(0, 3) : products;
    displayList.forEach(p => grid.appendChild(createProductCard(p)));
    
    section.appendChild(header);
    section.appendChild(grid);
    return section;
}

function viewFullBrand(brandName) {
    // Forza la vista di tutti i prodotti isolando temporaneamente o mostrando l'intero catalogo per quel brand
    currentViewMode = 'all';
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    
    const container = document.getElementById('catalog-container');
    container.innerHTML = "";
    
    const brandProducts = productsData.filter(p => p.brand === brandName && p.disponibile);
    const section = createGroupSection(`Tutti i prodotti del brand: ${brandName}`, brandProducts, false);
    container.appendChild(section);
}

// --- LOGICA AUTENTICAZIONE ---

function checkAdminSession() {
    if (localStorage.getItem("adminSessionActive") === "true") {
        showSection('admin-view');
    } else {
        showSection('login-view');
    }
}

async function login(e) {
    e.preventDefault();
    const u = document.getElementById("username").value;
    const p = document.getElementById("password").value;
    
    try {
        const res = await fetch(`${API_URL}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`);
        const data = await res.json();
        
        if (data.success) {
            localStorage.setItem("adminSessionActive", "true");
            document.getElementById("btn-logout").classList.remove("hidden");
            document.getElementById("login-form").reset();
            document.getElementById("login-error").classList.add("hidden");
            showSection('admin-view');
        } else {
            document.getElementById("login-error").classList.remove("hidden");
        }
    } catch (err) {
        alert("Errore di rete durante l'autenticazione.");
    }
}

function logout() {
    localStorage.removeItem("adminSessionActive");
    document.getElementById("btn-logout").classList.add("hidden");
    showSection('catalog-view');
}

// --- CRUDS INTERFACCIA TABELLA ---

function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    tbody.innerHTML = "";
    
    productsData.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${p.foto}" class="admin-img" onerror="this.src='https://via.placeholder.com/50'"></td>
            <td><strong>${p.brand}</strong></td>
            <td>${p.nome}</td>
            <td><small>${p.type} / ${p.packtype}</small></td>
            <td><strong>€ ${Number(p.prezzo).toFixed(2)}</strong></td>
            <td>
                <span style="color: ${p.disponibile ? '#2ED573' : '#FF4757'}; font-weight: bold;">
                    ${p.disponibile ? 'Visibile' : 'Nascosto'}
                </span>
                ${p.novità ? '<br><span style="background:#FEF2F2;color:#D97706;font-size:10px;padding:1px 4px;border-radius:3px;font-weight:700;">NOVITÀ</span>' : ''}
            </td>
            <td>
                <button class="btn btn-secondary" style="padding:6px 10px;" onclick="openModal('update', ${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-primary" style="padding:6px 10px; background:#FF4757;" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModal(mode, id = null) {
    const modal = document.getElementById('product-modal');
    document.getElementById('product-form').reset();
    document.getElementById('prod-id').value = "";
    
    if (mode === 'insert') {
        document.getElementById('modal-title').innerText = "Aggiungi Nuovo Prodotto";
    } else if (mode === 'update') {
        document.getElementById('modal-title').innerText = "Modifica Prodotto Esistente";
        const p = productsData.find(item => item.id == id);
        if (p) {
            document.getElementById('prod-id').value = p.id;
            document.getElementById('prod-brand').value = p.brand;
            document.getElementById('prod-nome').value = p.nome;
            document.getElementById('prod-descrizione').value = p.descrizione;
            document.getElementById('prod-prezzo').value = p.prezzo;
            document.getElementById('prod-foto').value = p.foto;
            document.getElementById('prod-type').value = p.type;
            document.getElementById('prod-packtype').value = p.packtype;
            document.getElementById('prod-disponibile').checked = p.disponibile;
            document.getElementById('prod-novita').checked = p.novità;
        }
    }
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    
    const payload = {
        action: id ? 'update' : 'insert',
        id: id || undefined,
        brand: document.getElementById('prod-brand').value,
        nome: document.getElementById('prod-nome').value,
        descrizione: document.getElementById('prod-descrizione').value,
        prezzo: parseFloat(document.getElementById('prod-prezzo').value),
        foto: document.getElementById('prod-foto').value,
        type: document.getElementById('prod-type').value,
        packtype: document.getElementById('prod-packtype').value,
        disponibile: document.getElementById('prod-disponibile').checked,
        novità: document.getElementById('prod-novita').checked
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            closeModal();
            productsData = [];
            await loadProducts();
            showSection('admin-view');
        }
    } catch (err) {
        alert("Errore nel salvataggio del record.");
    }
}

async function deleteProduct(id) {
    if (!confirm("Confermi di voler rimuovere definitivamente questo prodotto?")) return;
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', id: id })
        });
        const result = await res.json();
        if (result.success) {
            await loadProducts();
            renderAdminTable();
        }
    } catch (err) {
        alert("Errore durante l'eliminazione.");
    }
}