// Expanded Base Database
const baseItemDB = {
    "Bird Wing": "Ruined Temple (Beak)",
    "Minotaur Skin": "Ruined Temple: Forbidden Hall (Minotaur)",
    "Energy Bottle": "Sykea Deep Valley (Mech Little Boar)",
    "Nightmare Crystal": "Ancient Empress Tomb (Nightmare Roar)",
    "Mithril Ore": "Ultimea Sewer: Southeast (Underground Nemico)",
    "Flower Nectar": "Lonogo Canyon (Pova)",
    "Bitter Nut": "Nisel Mountain (Shell Mask)",
    "Nisel Wood": "Nisel Mountain (Shell Mask)",
    "Thick Beak": "Witeka Scorched Plains (Pova)",
    "Summer Shell": "Water Element Monsters (Summer Event)",
    "Anti-Degradation": "Ruined Temple: Forbidden Hall (Minotaur)",
    "Luminous Water": "Underground Channel (Ghost)",
    "Bismuth Ore": "Labilans Sector (Corroded Knight)",
    "Ivy": "Korda Basin (Casspy)",
    "Hematite": "Ruined Temple (Goblin)",
    "Mithril": "Processing / Bosses",
    "Orichalcum Ore": "Varies / Minibosses",
    "Orichalcum": "Varies / Bosses",
    "Animal Horn": "Varies (Beast type)",
    "Cracked Stone": "Varies (Rock type)",
    "Metal (Farming)": "Varies (See Coryn Club)",
    "Wood (Farming)": "Varies (See Coryn Club)",
    "Beast (Farming)": "Varies (See Coryn Club)",
    "Cloth (Farming)": "Varies (See Coryn Club)",
    "Medicine (Farming)": "Varies (See Coryn Club)",
    "Mana (Farming)": "Varies (See Coryn Club)"
};

let stock = JSON.parse(localStorage.getItem('toram_stock_v3')) || {};
let cbSlots = JSON.parse(localStorage.getItem('toram_cb_v3')) || Array(14).fill(null);
let logs = JSON.parse(localStorage.getItem('toram_logs_v3')) || [];
let alerts = JSON.parse(localStorage.getItem('toram_alerts_v3')) || {};
let customDB = JSON.parse(localStorage.getItem('toram_custom_db_v3')) || {};
let activeSlotIndex = null;

const inputName = document.getElementById('stockName');
const autocompleteList = document.getElementById('autocompleteList');
const tickStd = document.getElementById('tickStd');
const tickLvl = document.getElementById('tickLvl');
const tickBag = document.getElementById('tickBag');
const guildBuff = document.getElementById('guildBuff');
const cbModal = document.getElementById('cbModal');

// Helper to combine base items with your custom learned items
function getFullDB() {
    return { ...baseItemDB, ...customDB };
}

document.addEventListener('DOMContentLoaded', () => {
    renderTabs();
    renderStock();
    renderBoard();
    renderLogs();
    renderAlerts();
    [tickStd, tickLvl, tickBag].forEach(box => box.addEventListener('change', renderBoard));
    guildBuff.addEventListener('input', renderBoard);
});

inputName.addEventListener('input', function() {
    const val = this.value;
    autocompleteList.innerHTML = '';
    if (!val || val.length < 1) {
        autocompleteList.classList.add('hidden');
        return;
    }
    
    autocompleteList.classList.remove('hidden');
    let hasMatches = false;
    const currentDB = getFullDB();

    Object.keys(currentDB).forEach(item => {
        if (item.toLowerCase().includes(val.toLowerCase())) {
            hasMatches = true;
            const div = document.createElement('div');
            const regex = new RegExp(`(${val})`, "gi");
            div.innerHTML = item.replace(regex, "<strong>$1</strong>");
            div.addEventListener('click', () => {
                inputName.value = item;
                autocompleteList.classList.add('hidden');
            });
            autocompleteList.appendChild(div);
        }
    });

    if (!hasMatches) {
        const div = document.createElement('div');
        div.innerText = `Add "${val}" (New Item)`;
        div.addEventListener('click', () => autocompleteList.classList.add('hidden'));
        autocompleteList.appendChild(div);
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== inputName) autocompleteList.classList.add('hidden');
});

function renderTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(e.currentTarget.dataset.tab).classList.add('active');
        });
    });
}

document.getElementById('trackNewItemBtn').addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) return alert("Enter an item name.");
    
    if (stock[name] === undefined) {
        const currentDB = getFullDB();
        
        // New item learning logic
        if (!currentDB[name]) {
            let location = prompt(`New item detected!\nWhere do you farm ${name}? (Optional)`);
            if (location) {
                customDB[name] = location;
                localStorage.setItem('toram_custom_db_v3', JSON.stringify(customDB));
            }
        }

        stock[name] = 0; 
        saveData();
        renderStock();
        inputName.value = '';
    } else {
        alert("This item is already in your tracker!");
    }
});

function renderStock() {
    const list = document.getElementById('stockList');
    list.innerHTML = '';
    
    for (const [name, qty] of Object.entries(stock)) {
        const safeId = name.replace(/[^a-zA-Z0-9]/g, '_'); 
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size: 16px;">${name}</strong> 
                <div style="display:flex; align-items:center; gap: 12px;">
                    <span class="text-green" style="font-size:18px;">Total: ${qty.toLocaleString()}</span>
                    <button class="btn-danger" style="padding: 6px 12px; font-size:13px; border-radius: 6px;" onclick="untrackItem('${name}')">X</button>
                </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:15px; align-items:center;">
                <input type="number" id="qty_${safeId}" placeholder="Qty" style="margin:0; width:80px; padding:10px; text-align:center;" min="1">
                <button class="btn-primary" style="padding:10px; font-size:13px; flex:1;" onclick="modifyItemStock('${name}', '${safeId}', 'add')">Restock</button>
                <button class="btn-secondary" style="padding:10px; font-size:13px; flex:1; background: var(--fee-red);" onclick="modifyItemStock('${name}', '${safeId}', 'sub')">Consume</button>
                <button class="btn-secondary" style="padding:10px; font-size:13px; flex:1;" onclick="modifyItemStock('${name}', '${safeId}', 'set')">Set</button>
            </div>
        `;
        list.appendChild(div);
    }
    populateAlertSelect();
}

window.modifyItemStock = function(name, safeId, action) {
    const input = document.getElementById(`qty_${safeId}`);
    const amount = parseInt(input.value);
    if (isNaN(amount) || amount < 0) return alert("Enter a valid amount first.");
    if (action === 'add') stock[name] += amount;
    else if (action === 'sub') {
        if (amount > stock[name]) return alert("You don't have that many to consume!");
        stock[name] -= amount;
    } else if (action === 'set') stock[name] = amount;
    
    input.value = '';
    saveData();
    renderStock();
    renderAlerts();
};

window.untrackItem = function(name) {
    if (confirm(`Stop tracking ${name}? This will remove it from your stock.`)) {
        delete stock[name];
        if (alerts[name]) delete alerts[name];
        saveData();
        renderStock();
        renderAlerts();
    }
};

function renderBoard() {
    const container = document.getElementById('cbSlots');
    container.innerHTML = '';
    let reduction = 0;
    
    // Base Tickets
    if (tickLvl.checked) reduction += 0.30;
    if (tickStd.checked) reduction += 0.20;
    if (tickBag.checked) reduction += 0.10;
    
    // Guild Market Investment Buff
    let guildReduction = parseInt(guildBuff.value);
    if (!isNaN(guildReduction)) {
        reduction += (guildReduction / 100);
    }
    
    let effectiveFeeRate = 10 * (1 - reduction);
    if (effectiveFeeRate < 0) effectiveFeeRate = 0;
    
    document.getElementById('feeDisplay').innerText = effectiveFeeRate.toFixed(1) + '%';

    cbSlots.forEach((slot, index) => {
        const div = document.createElement('div');
        div.className = 'cb-slot ' + (slot ? 'filled' : '');
        
        if (!slot) {
            div.innerHTML = `<div style="color: var(--brand-blurple); margin-bottom: 5px;">+ Add Listing</div><span class="text-muted">Empty Slot ${index + 1}</span>`;
            div.onclick = () => openModal(index);
        } else {
            let baseFee = Math.floor(slot.price * 0.10);
            let discount = Math.floor(baseFee * reduction);
            let finalFee = baseFee - discount;
            let netProfit = slot.price - finalFee;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size: 16px;">${slot.name} <span class="text-muted" style="font-weight:normal;">(x${slot.qty})</span></strong>
                    <span class="text-muted">Slot ${index + 1}</span>
                </div>
                <div style="margin-top: 12px; font-size: 14px; background: var(--bg-base); padding: 12px; border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>List Price:</span> <span>${slot.price.toLocaleString()}s</span></div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Fee Tax:</span> <span class="text-red">-${finalFee.toLocaleString()}s</span></div>
                    <div style="display:flex; justify-content:space-between; border-top: 1px solid #3f4147; padding-top: 4px; margin-top: 4px;"><span>Net Earn:</span> <span class="text-green">+${netProfit.toLocaleString()}s</span></div>
                </div>
                <button class="btn-success" onclick="collectSpina(${index}, '${slot.name}', ${slot.qty}, ${netProfit})">Mark as Sold (Collect)</button>
                <button class="btn-secondary" style="width:100%; margin-top:8px; background: transparent; border: 1px solid var(--fee-red); color: var(--fee-red);" onclick="cancelListing(${index})">Cancel Listing</button>
            `;
        }
        container.appendChild(div);
    });
}

function openModal(index) {
    activeSlotIndex = index;
    const select = document.getElementById('modalItemSelect');
    select.innerHTML = '<option value="">Select from Stock...</option>';
    
    for (const [name, qty] of Object.entries(stock)) {
        if (qty > 0) select.innerHTML += `<option value="${name}">${name} (Avail: ${qty})</option>`;
    }
    
    document.getElementById('modalSellQty').value = '';
    document.getElementById('modalPrice').value = '';
    cbModal.classList.remove('hidden');
}

document.getElementById('cancelModalBtn').onclick = () => cbModal.classList.add('hidden');

document.getElementById('confirmModalBtn').onclick = () => {
    const name = document.getElementById('modalItemSelect').value;
    const sellQty = parseInt(document.getElementById('modalSellQty').value);
    const price = parseInt(document.getElementById('modalPrice').value);

    if (!name || isNaN(sellQty) || sellQty <= 0 || isNaN(price) || price <= 0) return alert("Fill all fields correctly.");
    
    // 99 Max Stack checking
    if (sellQty > 99) return alert("Quantity cannot exceed 99 (Toram stack limit)!");
    
    if (sellQty > stock[name]) return alert("You don't have enough in stock!");

    stock[name] -= sellQty;
    cbSlots[activeSlotIndex] = { name, qty: sellQty, price };
    
    cbModal.classList.add('hidden');
    saveData();
    renderStock();
    renderBoard();
    renderAlerts();
};

window.cancelListing = function(index) {
    const item = cbSlots[index];
    if (stock[item.name] !== undefined) stock[item.name] += item.qty; 
    else stock[item.name] = item.qty; 
    
    cbSlots[index] = null;
    saveData();
    renderStock();
    renderBoard();
    renderAlerts();
};

function populateAlertSelect() {
    const select = document.getElementById('alertItemSelect');
    select.innerHTML = '<option value="">Select Item...</option>';
    for (const name of Object.keys(stock)) {
        select.innerHTML += `<option value="${name}">${name}</option>`;
    }
}

document.getElementById('setAlertBtn').addEventListener('click', () => {
    const name = document.getElementById('alertItemSelect').value;
    const limit = parseInt(document.getElementById('alertLimit').value);
    if (!name || isNaN(limit)) return;
    
    alerts[name] = limit;
    saveData();
    renderAlerts();
    document.getElementById('alertLimit').value = '';
});

function renderAlerts() {
    const list = document.getElementById('alertList');
    const badge = document.getElementById('alertBadge');
    list.innerHTML = '';
    let alertCount = 0;
    const currentDB = getFullDB();

    for (const [name, limit] of Object.entries(alerts)) {
        const currentStock = stock[name] || 0;
        const isLow = currentStock < limit;
        const mapInfo = currentDB[name] || "Location unknown (Check Coryn Club)";
        if (isLow) alertCount++;

        const div = document.createElement('div');
        div.className = 'card ' + (isLow ? 'border-orange' : '');
        if(isLow) div.style.borderLeft = "4px solid var(--warning-orange)";
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size: 15px;">${name}</strong>
                <span class="${isLow ? 'text-orange' : 'text-green'}" style="background: var(--bg-base); padding: 4px 8px; border-radius: 6px; font-size: 12px;">Stock: ${currentStock} / ${limit}</span>
            </div>
            ${isLow ? `<div class="text-muted" style="margin-top:12px; background: rgba(240, 178, 50, 0.1); padding: 10px; border-radius: 6px; color: #f2f3f5;">⚠️ <strong>Farm at:</strong> ${mapInfo}</div>` : ''}
            <button class="btn-secondary" style="padding: 6px 12px; font-size:12px; margin-top:12px; border: 1px solid var(--fee-red); color: var(--fee-red); background: transparent;" onclick="removeAlert('${name}')">Remove Alert</button>
        `;
        list.appendChild(div);
    }
    
    if (alertCount > 0) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
}

window.removeAlert = function(name) {
    delete alerts[name];
    saveData();
    renderAlerts();
};

window.collectSpina = function(index, name, qty, netProfit) {
    const todayStr = new Date().toLocaleDateString();
    logs.unshift({
        name, qty, profit: netProfit, dateStr: todayStr, fullDate: new Date().toLocaleString()
    });
    cbSlots[index] = null;
    saveData();
    renderBoard();
    renderLogs();
};

document.getElementById('resetLogsBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to delete your entire earning history? This cannot be undone.")) {
        logs = [];
        saveData();
        renderLogs();
    }
});

function renderLogs() {
    const container = document.getElementById('earningsLog');
    container.innerHTML = '';
    let todayTotal = 0;
    let allTimeTotal = 0;
    const todayStr = new Date().toLocaleDateString();
    
    logs.forEach(log => {
        allTimeTotal += log.profit;
        if (log.dateStr === todayStr) todayTotal += log.profit;

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size: 15px;">${log.name} <span class="text-muted">(x${log.qty})</span></strong>
                <span class="text-green" style="font-size: 16px;">+${log.profit.toLocaleString()}s</span>
            </div>
            <div class="text-muted" style="margin-top:8px;">${log.fullDate}</div>
        `;
        container.appendChild(div);
    });
    
    document.getElementById('todayEarnings').innerText = todayTotal.toLocaleString() + 's';
    document.getElementById('allTimeEarnings').innerText = allTimeTotal.toLocaleString() + 's';
}

function saveData() {
    localStorage.setItem('toram_stock_v3', JSON.stringify(stock));
    localStorage.setItem('toram_cb_v3', JSON.stringify(cbSlots));
    localStorage.setItem('toram_logs_v3', JSON.stringify(logs));
    localStorage.setItem('toram_alerts_v3', JSON.stringify(alerts));
}
