// Start with an empty database
let baseItemDB = {};

let stock = JSON.parse(localStorage.getItem('toram_stock_v3')) || {};
let cbSlots = JSON.parse(localStorage.getItem('toram_cb_v3')) || Array(14).fill(null);
let logs = JSON.parse(localStorage.getItem('toram_logs_v3')) || [];
let alerts = JSON.parse(localStorage.getItem('toram_alerts_v3')) || {};
let customDB = JSON.parse(localStorage.getItem('toram_custom_db_v3')) || {};
let marketData = JSON.parse(localStorage.getItem('toram_market_v1')) || {};

let activeSlotIndex = null;
let activeTickerItem = null;
let priceChart = null; 

const inputName = document.getElementById('stockName');
const autocompleteList = document.getElementById('autocompleteList');
const tickStd = document.getElementById('tickStd');
const tickLvl = document.getElementById('tickLvl');
const tickBag = document.getElementById('tickBag');
const guildBuff = document.getElementById('guildBuff');
const cbModal = document.getElementById('cbModal');
const tickerModal = document.getElementById('tickerModal');

function getFullDB() { return { ...baseItemDB, ...customDB }; }

function getEffectiveFeeRate() {
    let reduction = 0;
    if (tickLvl.checked) reduction += 0.30;
    if (tickStd.checked) reduction += 0.20;
    if (tickBag.checked) reduction += 0.10;
    
    let guildReduction = parseInt(guildBuff.value);
    if (!isNaN(guildReduction)) reduction += (guildReduction / 100);
    
    let rate = 10 * (1 - reduction);
    return rate < 0 ? 0 : rate;
}

// Fetch the JSON database before setting up the rest of the app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('items.json');
        baseItemDB = await response.json();
    } catch (error) {
        console.log("Could not load JSON. App will still work with custom learned items.");
    }

    renderTabs();
    renderStock();
    renderBoard();
    renderLogs();
    renderAlerts();
    renderTicker();
    updateChartDropdown(); 

    [tickStd, tickLvl, tickBag, guildBuff].forEach(el => {
        el.addEventListener('change', () => {
            renderBoard();
            calculateFlip(); 
        });
    });

    document.getElementById('flipBuy').addEventListener('input', calculateFlip);
    document.getElementById('flipSell').addEventListener('input', calculateFlip);
    document.getElementById('chartItemSelect').addEventListener('change', renderChart);
});

// --- FLIPPING TAB & GRAPH LOGIC --- //

function calculateFlip() {
    const buy = parseInt(document.getElementById('flipBuy').value);
    const sell = parseInt(document.getElementById('flipSell').value);
    const resultDiv = document.getElementById('flipResult');

    if (isNaN(buy) || isNaN(sell)) { resultDiv.style.display = 'none'; return; }

    const feeRate = getEffectiveFeeRate() / 100;
    const tax = Math.floor(sell * feeRate);
    const net = sell - tax;
    const profit = net - buy;
    
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Market Tax (${(feeRate*100).toFixed(1)}%):</span> <span class="text-red">-${tax.toLocaleString()}s</span></div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Net Revenue:</span> <span>${net.toLocaleString()}s</span></div>
        <div style="display:flex; justify-content:space-between; border-top: 1px solid #3f4147; padding-top: 6px; margin-top: 6px;">
            <strong>Expected Profit:</strong> 
            <strong style="font-size: 16px;" class="${profit >= 0 ? 'text-green' : 'text-red'}">${profit > 0 ? '+' : ''}${profit.toLocaleString()}s</strong>
        </div>
    `;
}

function updateChartDropdown() {
    const select = document.getElementById('chartItemSelect');
    const currentVal = select.value;
    select.innerHTML = '';
    const items = Object.keys(marketData);
    
    if (items.length === 0) {
        document.getElementById('chartContainer').style.display = 'none';
        return;
    }
    
    document.getElementById('chartContainer').style.display = 'block';
    items.forEach(item => { select.innerHTML += `<option value="${item}">${item}</option>`; });
    
    if (items.includes(currentVal)) select.value = currentVal;
    else select.value = items[0];
    
    renderChart();
}

function renderChart() {
    const itemName = document.getElementById('chartItemSelect').value;
    if (!itemName || !marketData[itemName] || marketData[itemName].length === 0) return;

    const history = [...marketData[itemName]].reverse();
    const labels = history.map(entry => `${entry.date} ${entry.time}`);
    const prices = history.map(entry => entry.price);

    const ctx = document.getElementById('priceGraph').getContext('2d');
    if (priceChart) priceChart.destroy();
    
    Chart.defaults.color = '#949ba4';
    Chart.defaults.font.family = 'Inter';

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Price',
                data: prices,
                borderColor: '#5865F2', 
                backgroundColor: 'rgba(88, 101, 242, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#23a559', 
                pointBorderColor: '#fff',
                pointRadius: 5, 
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e1f22',
                    titleColor: '#dbdee1',
                    bodyColor: '#23a559',
                    bodyFont: { weight: 'bold', size: 15 },
                    padding: 12,
                    displayColors: false,
                    callbacks: { label: function(context) { return context.parsed.y.toLocaleString() + ' Spina'; } }
                }
            },
            scales: {
                x: { grid: { color: '#3f4147' }, ticks: { maxTicksLimit: 4 } },
                y: { grid: { color: '#3f4147' }, ticks: { callback: function(value) { return value.toLocaleString() + 's'; } } }
            }
        }
    });
}

document.getElementById('addTickerBtn').addEventListener('click', () => {
    const name = document.getElementById('tickerName').value.trim();
    if (!name) return;
    if (!marketData[name]) {
        marketData[name] = []; 
        saveData();
        renderTicker();
        updateChartDropdown();
        document.getElementById('tickerName').value = '';
    } else { alert("Already watching this item!"); }
});

function renderTicker() {
    const list = document.getElementById('marketTickerList');
    list.innerHTML = '';

    for (const [name, history] of Object.entries(marketData)) {
        const hasData = history.length > 0;
        const current = hasData ? history[0] : null;
        const previous = history.length > 1 ? history[1] : null;

        let trend = '➖';
        let trendColor = 'text-muted';
        
        if (current && previous) {
            // NEW: Calculate the exact percentage change
            let percentChange = ((current.price - previous.price) / previous.price) * 100;
            
            if (current.price > previous.price) { 
                trend = `🔼 Up (+${percentChange.toFixed(1)}%)`; 
                trendColor = 'text-green'; 
            }
            else if (current.price < previous.price) { 
                trend = `🔽 Down (-${Math.abs(percentChange).toFixed(1)}%)`; 
                trendColor = 'text-red'; 
            } else {
                trend = `➖ 0%`;
            }
        }

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size: 15px;">${name}</strong>
                <button class="btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="unwatchTicker('${name}')">Stop Watching</button>
            </div>
            
            ${hasData ? `
            <div style="display:flex; justify-content:space-between; margin-top: 12px; font-size: 13px;">
                <span>Current: <strong>${current.price.toLocaleString()}s</strong></span>
                <span class="${trendColor}"><strong style="font-size:14px;">${trend}</strong></span>
            </div>
            <div class="text-muted" style="font-size: 11px; margin-top: 4px;">Supply Logged: ${current.supply} | ${current.date} ${current.time}</div>
            ` : `<div class="text-muted" style="margin-top:12px; font-size:12px;">No data logged yet.</div>`}
            
            <button class="btn-secondary" style="width:100%; margin-top:12px; padding: 10px;" onclick="openTickerModal('${name}')">Log New Price Check</button>
        `;
        list.appendChild(div);
    }
}

window.openTickerModal = function(name) {
    activeTickerItem = name;
    document.getElementById('tickerModalName').innerText = `Updating: ${name}`;
    document.getElementById('tickerPrice').value = '';
    document.getElementById('tickerSupply').value = '';
    tickerModal.classList.remove('hidden');
};

document.getElementById('cancelTickerBtn').onclick = () => tickerModal.classList.add('hidden');

document.getElementById('confirmTickerBtn').onclick = () => {
    const price = parseInt(document.getElementById('tickerPrice').value);
    const supply = document.getElementById('tickerSupply').value; 
    
    if (isNaN(price) || price <= 0 || !supply) return alert("Enter valid price and supply.");

    const now = new Date();
    
    marketData[activeTickerItem].unshift({
        price: price,
        supply: supply,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    if (marketData[activeTickerItem].length > 15) marketData[activeTickerItem].pop();

    saveData();
    renderTicker();
    updateChartDropdown(); 
    tickerModal.classList.add('hidden');
};

window.unwatchTicker = function(name) {
    if (confirm(`Stop watching ${name}? This deletes its price history.`)) {
        delete marketData[name];
        saveData();
        renderTicker();
        updateChartDropdown();
    }
};
// --- CORE TABS & STOCK LOGIC --- //
inputName.addEventListener('input', function() {
    const val = this.value; autocompleteList.innerHTML = '';
    if (!val || val.length < 1) { autocompleteList.classList.add('hidden'); return; }
    autocompleteList.classList.remove('hidden'); let hasMatches = false;
    Object.keys(getFullDB()).forEach(item => {
        if (item.toLowerCase().includes(val.toLowerCase())) {
            hasMatches = true; const div = document.createElement('div');
            div.innerHTML = item.replace(new RegExp(`(${val})`, "gi"), "<strong>$1</strong>");
            div.addEventListener('click', () => { inputName.value = item; autocompleteList.classList.add('hidden'); });
            autocompleteList.appendChild(div);
        }
    });
    if (!hasMatches) {
        const div = document.createElement('div'); div.innerText = `Add "${val}" (New Item)`;
        div.addEventListener('click', () => autocompleteList.classList.add('hidden')); autocompleteList.appendChild(div);
    }
});

document.addEventListener('click', (e) => { if (e.target !== inputName) autocompleteList.classList.add('hidden'); });

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
    const name = inputName.value.trim(); if (!name) return alert("Enter an item name.");
    if (stock[name] === undefined) {
        if (!getFullDB()[name]) {
            let loc = prompt(`New item! Where do you farm ${name}? (Optional)`);
            if (loc) { customDB[name] = loc; localStorage.setItem('toram_custom_db_v3', JSON.stringify(customDB)); }
        }
        stock[name] = 0; saveData(); renderStock(); inputName.value = '';
    } else { alert("Already in tracker!"); }
});

function renderStock() {
    const list = document.getElementById('stockList'); list.innerHTML = '';
    for (const [name, qty] of Object.entries(stock)) {
        const safeId = name.replace(/[^a-zA-Z0-9]/g, '_'); 
        const div = document.createElement('div'); div.className = 'card';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size: 16px;">${name}</strong> 
                <div style="display:flex; gap: 12px; align-items:center;">
                    <span class="text-green" style="font-size:16px;">Total: ${qty.toLocaleString()}</span>
                    <button class="btn-remove" onclick="untrackItem('${name}')">✕</button>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:15px;">
                <input type="number" id="qty_${safeId}" placeholder="Qty" style="grid-column: span 3; margin:0; text-align:center;" min="1">
                <button class="btn-action btn-add" onclick="modifyItemStock('${name}', '${safeId}', 'add')">Restock</button>
                <button class="btn-action btn-sub" onclick="modifyItemStock('${name}', '${safeId}', 'sub')">Consume</button>
                <button class="btn-action btn-set" onclick="modifyItemStock('${name}', '${safeId}', 'set')">Set</button>
            </div>
        `;
        list.appendChild(div);
    }
    populateAlertSelect();
}

window.modifyItemStock = function(name, id, action) {
    const val = parseInt(document.getElementById(`qty_${id}`).value); if (isNaN(val) || val < 0) return alert("Enter valid amount.");
    if (action === 'add') stock[name] += val; else if (action === 'sub') { if (val > stock[name]) return alert("Not enough to consume!"); stock[name] -= val; } else if (action === 'set') stock[name] = val;
    saveData(); renderStock(); renderAlerts();
};

window.untrackItem = function(name) { if (confirm(`Stop tracking ${name}?`)) { delete stock[name]; delete alerts[name]; saveData(); renderStock(); renderAlerts(); } };

function renderBoard() {
    const container = document.getElementById('cbSlots'); container.innerHTML = ''; const rate = getEffectiveFeeRate(); document.getElementById('feeDisplay').innerText = rate.toFixed(1) + '%';
    cbSlots.forEach((slot, index) => {
        const div = document.createElement('div'); div.className = 'cb-slot ' + (slot ? 'filled' : '');
        if (!slot) { div.innerHTML = `<div style="color: var(--brand-blurple); margin-bottom: 5px;">+ Add Listing</div><span class="text-muted">Empty Slot ${index + 1}</span>`; div.onclick = () => openModal(index); } else {
            let tax = Math.floor(slot.price * (rate / 100)); let net = slot.price - tax;
            div.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${slot.name} <span class="text-muted">(x${slot.qty})</span></strong><span class="text-muted">Slot ${index + 1}</span></div><div style="margin-top: 12px; background: var(--bg-base); padding: 12px; border-radius: 8px; font-size: 14px;"><div style="display:flex; justify-content:space-between;"><span>Price:</span> <span>${slot.price.toLocaleString()}s</span></div><div style="display:flex; justify-content:space-between;"><span>Tax:</span> <span class="text-red">-${tax.toLocaleString()}s</span></div><div style="display:flex; justify-content:space-between; border-top: 1px solid #3f4147; padding-top: 4px; margin-top: 4px;"><span>Net:</span> <span class="text-green">+${net.toLocaleString()}s</span></div></div><button class="btn-success" onclick="collectSpina(${index}, '${slot.name}', ${slot.qty}, ${net})">Mark as Sold</button><button class="btn-secondary" style="width:100%; margin-top:8px; background:transparent; border:1px solid var(--fee-red); color:var(--fee-red);" onclick="cancelListing(${index})">Cancel Listing</button>`;
        }
        container.appendChild(div);
    });
}

function openModal(index) {
    activeSlotIndex = index; const s = document.getElementById('modalItemSelect'); s.innerHTML = '<option value="">Select from Stock...</option>';
    for (const [name, qty] of Object.entries(stock)) if (qty > 0) s.innerHTML += `<option value="${name}">${name} (Avail: ${qty})</option>`;
    document.getElementById('modalSellQty').value = ''; document.getElementById('modalPrice').value = ''; cbModal.classList.remove('hidden');
}

document.getElementById('cancelModalBtn').onclick = () => cbModal.classList.add('hidden');
document.getElementById('confirmModalBtn').onclick = () => {
    const name = document.getElementById('modalItemSelect').value; const qty = parseInt(document.getElementById('modalSellQty').value); const price = parseInt(document.getElementById('modalPrice').value);
    if (!name || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) return alert("Fill all fields.");
    if (qty > 99) return alert("Max stack is 99!"); if (qty > stock[name]) return alert("Not enough in stock!");
    stock[name] -= qty; cbSlots[activeSlotIndex] = { name, qty, price }; cbModal.classList.add('hidden'); saveData(); renderStock(); renderBoard(); renderAlerts();
};

window.cancelListing = function(i) { const item = cbSlots[i]; stock[item.name] = (stock[item.name] || 0) + item.qty; cbSlots[i] = null; saveData(); renderStock(); renderBoard(); renderAlerts(); };

function populateAlertSelect() { const s = document.getElementById('alertItemSelect'); s.innerHTML = '<option value="">Select Item...</option>'; for (const name of Object.keys(stock)) s.innerHTML += `<option value="${name}">${name}</option>`; }
document.getElementById('setAlertBtn').onclick = () => { const n = document.getElementById('alertItemSelect').value; const l = parseInt(document.getElementById('alertLimit').value); if(n && !isNaN(l)){ alerts[n] = l; saveData(); renderAlerts(); document.getElementById('alertLimit').value = ''; } };

function renderAlerts() {
    const list = document.getElementById('alertList'); const badge = document.getElementById('alertBadge'); list.innerHTML = ''; let count = 0; const db = getFullDB();
    for (const [name, limit] of Object.entries(alerts)) {
        const cur = stock[name] || 0; const isLow = cur < limit; const loc = db[name] || "Unknown location"; if (isLow) count++;
        const div = document.createElement('div'); div.className = 'card ' + (isLow ? 'border-orange' : ''); if(isLow) div.style.borderLeft = "4px solid var(--warning-orange)";
        div.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${name}</strong> <span class="${isLow?'text-orange':'text-green'}" style="background:var(--bg-base); padding:4px 8px; border-radius:6px; font-size:12px;">Stock: ${cur}/${limit}</span></div>${isLow ? `<div class="text-muted" style="margin-top:12px; background:rgba(240,178,50,0.1); padding:10px; border-radius:6px;">⚠️ <strong>Farm:</strong> ${loc}</div>` : ''}<button class="btn-secondary" style="padding: 6px 12px; font-size:12px; margin-top:12px; border:1px solid var(--fee-red); color:var(--fee-red); background:transparent;" onclick="removeAlert('${name}')">Remove</button>`; list.appendChild(div);
    }
    count > 0 ? badge.classList.remove('hidden') : badge.classList.add('hidden');
}

window.removeAlert = function(n) { delete alerts[n]; saveData(); renderAlerts(); };
window.collectSpina = function(i, n, q, p) { logs.unshift({ name: n, qty: q, profit: p, dateStr: new Date().toLocaleDateString(), fullDate: new Date().toLocaleString() }); cbSlots[i] = null; saveData(); renderBoard(); renderLogs(); };
document.getElementById('resetLogsBtn').onclick = () => { if(confirm("Delete all history?")){ logs = []; saveData(); renderLogs(); } };

function renderLogs() {
    const list = document.getElementById('earningsLog'); 
    list.innerHTML = ''; 
    let t = 0, a = 0; 
    const tStr = new Date().toLocaleDateString();
    
    logs.forEach(l => { 
        a += l.profit; 
        if (l.dateStr === tStr) t += l.profit; 
        
        const div = document.createElement('div'); 
        div.className = 'card'; 
        div.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${l.name} <span class="text-muted">(x${l.qty})</span></strong><span class="text-green">+${l.profit.toLocaleString()}s</span></div><div class="text-muted" style="margin-top:8px; font-size:12px;">${l.fullDate}</div>`; 
        list.appendChild(div); 
    });

    // NEW: Compact Number Formatter for the Stat Boxes
    const compactFormatter = new Intl.NumberFormat('en-US', {
        notation: "compact",
        maximumFractionDigits: 1
    });

    document.getElementById('todayEarnings').innerText = compactFormatter.format(t) + 's'; 
    document.getElementById('allTimeEarnings').innerText = compactFormatter.format(a) + 's';
}

function saveData() {
    localStorage.setItem('toram_stock_v3', JSON.stringify(stock)); localStorage.setItem('toram_cb_v3', JSON.stringify(cbSlots)); localStorage.setItem('toram_logs_v3', JSON.stringify(logs)); localStorage.setItem('toram_alerts_v3', JSON.stringify(alerts)); localStorage.setItem('toram_market_v1', JSON.stringify(marketData)); 
}
// --- EARNINGS GRAPH PATCH ---
window.logChartInstance = null;

document.getElementById('logChartFilter').addEventListener('change', renderLogChart);

function getLogChartData(filter) {
    const grouped = {};
    const reversedLogs = [...logs].reverse(); // Sort chronologically

    reversedLogs.forEach(log => {
        const d = new Date(log.dateStr);
        if(isNaN(d)) return;

        let key = "";
        if (filter === 'day') {
            key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (filter === 'week') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            key = "Wk of " + monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (filter === 'month') {
            key = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }

        if (!grouped[key]) grouped[key] = 0;
        grouped[key] += log.profit;
    });

    return { labels: Object.keys(grouped), data: Object.values(grouped) };
}

function renderLogChart() {
    const container = document.getElementById('logChartContainer');
    if (logs.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';

    const filter = document.getElementById('logChartFilter').value;
    const chartData = getLogChartData(filter);

    const ctx = document.getElementById('logChartCanvas').getContext('2d');
    if (window.logChartInstance) window.logChartInstance.destroy();

    window.logChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Earnings',
                data: chartData.data,
                backgroundColor: '#23a559', // Spina Green
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1e1f22', titleColor: '#dbdee1', bodyColor: '#23a559', bodyFont: { weight: 'bold', size: 14 }, callbacks: { label: function(c) { return c.parsed.y.toLocaleString() + 's'; } } }
            },
            scales: {
                x: { grid: { display: false, color: '#3f4147' } },
                y: { grid: { color: '#3f4147' }, ticks: { callback: function(v) { const f = new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }); return f.format(v); } } }
            }
        }
    });
}

// This automatically overrides the old renderLogs function!
function renderLogs() {
    const list = document.getElementById('earningsLog'); list.innerHTML = ''; 
    let t = 0, a = 0; const tStr = new Date().toLocaleDateString();
    
    logs.forEach(l => { 
        a += l.profit; if (l.dateStr === tStr) t += l.profit; 
        const div = document.createElement('div'); div.className = 'card'; 
        div.innerHTML = `<div style="display:flex; justify-content:space-between;"><strong>${l.name} <span class="text-muted">(x${l.qty})</span></strong><span class="text-green">+${l.profit.toLocaleString()}s</span></div><div class="text-muted" style="margin-top:8px; font-size:12px;">${l.fullDate}</div>`; 
        list.appendChild(div); 
    });

    const compactFormatter = new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 });
    document.getElementById('todayEarnings').innerText = compactFormatter.format(t) + 's'; 
    document.getElementById('allTimeEarnings').innerText = compactFormatter.format(a) + 's';
    
    // Call the chart draw function every time logs update
    renderLogChart();
}

// --- GEAR APPRAISER LOGIC --- //

// Populate the searchable datalist with items from JSON AND Market History
function populateXtalDropdowns() {
    const datalist = document.getElementById('xtalDatalist');
    let options = '';
    
    const db = getFullDB();
    // Add Xtals from the base database
    for (const name of Object.keys(db)) {
        if (name.includes('◇') || name.toLowerCase().includes('xtal')) {
            options += `<option value="${name}">`;
        }
    }
    // Add any custom Xtals the user has previously tracked in the Market tab
    for (const name of Object.keys(marketData)) {
        if ((name.includes('◇') || name.toLowerCase().includes('xtal')) && !db[name]) {
            options += `<option value="${name}">`;
        }
    }
    datalist.innerHTML = options;
}

// Handle UI changes based on selections
document.getElementById('aprSlots').addEventListener('change', (e) => {
    const slots = parseInt(e.target.value);
    document.getElementById('aprXtal1Container').style.display = slots >= 1 ? 'block' : 'none';
    document.getElementById('aprXtal2Container').style.display = slots === 2 ? 'block' : 'none';
    // Clear the text inputs if slots are reduced
    if(slots < 1) document.getElementById('aprXtal1').value = '';
    if(slots < 2) document.getElementById('aprXtal2').value = '';
});

// Handle UI changes based on selections
document.getElementById('aprType').addEventListener('change', (e) => {
    const statContainer = document.getElementById('aprStatContainer');
    // Hide custom stats for Add/Ring
    if (e.target.value === 'add' || e.target.value === 'ring') {
        statContainer.style.display = 'none';
        document.getElementById('aprStatPrice').value = '';
    } else {
        statContainer.style.display = 'block';
    }
});

document.getElementById('aprSlots').addEventListener('change', (e) => {
    const slots = parseInt(e.target.value);
    document.getElementById('aprXtal1Container').style.display = slots >= 1 ? 'block' : 'none';
    document.getElementById('aprXtal2Container').style.display = slots === 2 ? 'block' : 'none';
    if(slots < 1) document.getElementById('aprXtal1').value = 'none';
    if(slots < 2) document.getElementById('aprXtal2').value = 'none';
});

// Run this once when the app loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(populateXtalDropdowns, 500); // Wait for JSON to fetch
});

// Helper to get or ask for Xtal price
function getOrAskPrice(itemName) {
    if (itemName === 'none' || !itemName) return 0;
    
    // Check if we already have it tracked in Flipping Market Data
    if (marketData[itemName] && marketData[itemName].length > 0) {
        return marketData[itemName][0].price; // Return newest price
    }

    // If not, ask the user and log it for the future!
    const userPrice = prompt(`We don't have the current price for ${itemName}.\nWhat is the lowest Board price right now?`);
    const priceInt = parseInt(userPrice);
    
    if (!isNaN(priceInt) && priceInt > 0) {
        if (!marketData[itemName]) marketData[itemName] = [];
        const now = new Date();
        marketData[itemName].unshift({
            price: priceInt, supply: "Appraisal Log", 
            date: now.toLocaleDateString(), time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        });
        saveData();
        renderTicker();
        if(typeof updateChartDropdown === "function") updateChartDropdown();
        return priceInt;
    }
    return 0; // Fallback if they cancel
}

window.calculateAppraisal = function() {
    const type = document.getElementById('aprType').value;
    const slots = parseInt(document.getElementById('aprSlots').value);
    const basePrice = parseInt(document.getElementById('aprBasePrice').value) || 0;
    const statPrice = (type === 'add' || type === 'ring') ? 0 : (parseInt(document.getElementById('aprStatPrice').value) || 0);
    
    const xtal1Name = document.getElementById('aprXtal1').value;
    const xtal2Name = document.getElementById('aprXtal2').value;

    let xtal1Raw = slots >= 1 ? getOrAskPrice(xtal1Name) : 0;
    let xtal2Raw = slots === 2 ? getOrAskPrice(xtal2Name) : 0;

    // Get Extraction Crysta price (usually 700k - 1m). Ask if missing.
    let extCrystaPrice = getOrAskPrice('Extraction Crysta');
    if (extCrystaPrice === 0) extCrystaPrice = 800000; // Default fallback

    // Calculate the TRUE value of the slotted xtals (Raw - Extraction Cost)
    let xtal1True = xtal1Raw > 0 ? Math.max(xtal1Raw - extCrystaPrice, 0) : 0;
    let xtal2True = xtal2Raw > 0 ? Math.max(xtal2Raw - extCrystaPrice, 0) : 0;

    const totalFairValue = basePrice + statPrice + xtal1True + xtal2True;

    const resultDiv = document.getElementById('aprResult');
    resultDiv.style.display = 'block';
    
    resultDiv.innerHTML = `
        <div style="text-align:center; margin-bottom: 12px; color: var(--brand-blurple); font-weight: bold;">Appraisal Report</div>
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Base Item:</span> <span>${basePrice.toLocaleString()}s</span></div>
        ${(type === 'weapon' || type === 'armor') ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Custom Stats:</span> <span>+${statPrice.toLocaleString()}s</span></div>` : ''}
        
        ${slots >= 1 && xtal1Raw > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;" class="text-muted"><span>[Slotted] ${xtal1Name}:</span> <span>+${xtal1True.toLocaleString()}s <br><small>(Raw: ${xtal1Raw.toLocaleString()} - Ext: ${extCrystaPrice.toLocaleString()})</small></span></div>` : ''}
        ${slots === 2 && xtal2Raw > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:12px;" class="text-muted"><span>[Slotted] ${xtal2Name}:</span> <span>+${xtal2True.toLocaleString()}s <br><small>(Raw: ${xtal2Raw.toLocaleString()} - Ext: ${extCrystaPrice.toLocaleString()})</small></span></div>` : ''}
        
        <div style="display:flex; justify-content:space-between; border-top: 1px solid #3f4147; padding-top: 6px; margin-top: 6px;">
            <strong>Estimated Fair Value:</strong> 
            <strong style="font-size: 18px;" class="text-green">${totalFairValue.toLocaleString()}s</strong>
        </div>
        <div class="text-muted" style="margin-top: 10px; font-size: 11px; text-align: center;">Never buy gear based on Raw Xtal value. Extraction costs were factored in.</div>
    `;
};
