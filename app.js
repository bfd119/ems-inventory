/* ============================================
   EMS在庫管理システム - アプリケーションロジック
   ============================================ */

// アプリ状態
const state = {
    currentDepartmentId: null,
    currentCategoryId: null,
    currentItemId: null,
    transactionType: 'IN'
};

// DOM要素のキャッシュ
const elements = {};

/**
 * アプリ初期化
 */
function initApp() {
    cacheElements();
    renderDepartmentGrid();
    bindEvents();
}

/**
 * DOM要素をキャッシュ
 */
function cacheElements() {
    elements.screens = {
        departmentSelect: document.getElementById('department-select'),
        dashboard: document.getElementById('dashboard'),
        deptInventory: document.getElementById('dept-inventory'),
        analytics: document.getElementById('analytics')
    };

    elements.departmentGrid = document.getElementById('department-grid');
    elements.categoryGrid = document.getElementById('category-grid');
    elements.departmentName = document.getElementById('current-department-name');

    elements.modals = {
        items: document.getElementById('items-modal'),
        transaction: document.getElementById('transaction-modal'),
        otherDept: document.getElementById('other-dept-modal')
    };

    elements.itemsList = document.getElementById('items-list');
    elements.itemsModalTitle = document.getElementById('items-modal-title');

    elements.transactionModalTitle = document.getElementById('transaction-modal-title');
    elements.currentStockValue = document.getElementById('current-stock-value');
    elements.currentStockUnit = document.getElementById('current-stock-unit');
    elements.transactionQuantity = document.getElementById('transaction-quantity');
    elements.transactionExpiry = document.getElementById('transaction-expiry');
    elements.transactionRemarks = document.getElementById('transaction-remarks');
    elements.expiryGroup = document.getElementById('expiry-group');

    elements.logList = document.getElementById('log-list');
    elements.summaryList = document.getElementById('summary-list');
    elements.budgetTable = document.getElementById('budget-table');
    elements.budgetYear = document.getElementById('budget-year');
    elements.budgetMonth = document.getElementById('budget-month');
}

/**
 * イベントハンドラをバインド
 */
function bindEvents() {
    // 画面遷移
    document.getElementById('back-to-home').addEventListener('click', () => showScreen('departmentSelect'));
    document.getElementById('open-stats').addEventListener('click', () => {
        showScreen('analytics');
        switchTab('summary');
        renderAnalytics();
    });
    document.getElementById('back-to-dashboard').addEventListener('click', () => showScreen('dashboard'));

    // 署所別在庫画面
    document.getElementById('open-dept-inventory').addEventListener('click', () => {
        showScreen('deptInventory');
        renderDepartmentInventory();
    });
    document.getElementById('back-to-dashboard-from-inv').addEventListener('click', () => showScreen('dashboard'));
    document.getElementById('export-dept-csv').addEventListener('click', exportDeptInventoryCSV);

    // 他署所在庫確認モーダル
    document.getElementById('open-other-dept').addEventListener('click', openOtherDeptModal);
    document.getElementById('close-other-dept-modal').addEventListener('click', () => closeModal('otherDept'));
    document.getElementById('other-dept-select').addEventListener('change', renderOtherDeptComparison);

    // モーダル閉じる
    document.getElementById('close-items-modal').addEventListener('click', () => closeModal('items'));
    document.getElementById('close-transaction-modal').addEventListener('click', () => closeModal('transaction'));

    // モーダルオーバーレイクリックで閉じる
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', () => {
            closeModal('items');
            closeModal('transaction');
            closeModal('otherDept');
        });
    });

    // 入出庫タイプ切り替え
    document.getElementById('btn-type-in').addEventListener('click', () => setTransactionType('IN'));
    document.getElementById('btn-type-out').addEventListener('click', () => setTransactionType('OUT'));

    // 数量調整
    document.getElementById('qty-minus').addEventListener('click', () => adjustQuantity(-1));
    document.getElementById('qty-plus').addEventListener('click', () => adjustQuantity(1));

    // 保存
    document.getElementById('save-transaction').addEventListener('click', saveTransaction);

    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 予算レポート
    elements.budgetYear.addEventListener('change', renderBudgetReport);
    elements.budgetMonth.addEventListener('change', renderBudgetReport);
    document.getElementById('export-csv').addEventListener('click', exportCSV);

    // 在庫マトリックスCSVエクスポート
    document.getElementById('export-matrix-csv').addEventListener('click', exportMatrixCSV);
}

/**
 * 画面を切り替え
 */
function showScreen(screenName) {
    Object.values(elements.screens).forEach(screen => screen.classList.remove('active'));
    elements.screens[screenName].classList.add('active');
}

/**
 * モーダルを開く
 */
function openModal(modalName) {
    elements.modals[modalName].classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * モーダルを閉じる
 */
function closeModal(modalName) {
    elements.modals[modalName].classList.remove('active');
    document.body.style.overflow = '';
}

/**
 * 部署選択グリッドを描画
 */
function renderDepartmentGrid() {
    elements.departmentGrid.innerHTML = DEPARTMENTS.map(dept => `
        <button class="department-btn" data-dept-id="${dept.id}">
            ${dept.name}
        </button>
    `).join('');

    // クリックイベント
    elements.departmentGrid.querySelectorAll('.department-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.currentDepartmentId = parseInt(btn.dataset.deptId);
            showDashboard();
        });
    });
}

/**
 * ダッシュボードを表示
 */
function showDashboard() {
    const dept = getDepartment(state.currentDepartmentId);
    elements.departmentName.textContent = `${dept.name} 在庫管理`;

    renderCategoryGrid();
    showScreen('dashboard');
}

/**
 * カテゴリグリッドを描画
 */
function renderCategoryGrid() {
    elements.categoryGrid.innerHTML = CATEGORIES.map(cat => `
        <button class="category-tile" data-cat-id="${cat.id}">
            <span class="category-icon">${cat.icon}</span>
            <span class="category-name">${cat.name}</span>
        </button>
    `).join('');

    // クリックイベント
    elements.categoryGrid.querySelectorAll('.category-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            state.currentCategoryId = parseInt(tile.dataset.catId);
            showItemsModal();
        });
    });
}

/**
 * 用品一覧モーダルを表示
 */
function showItemsModal() {
    const category = getCategory(state.currentCategoryId);
    elements.itemsModalTitle.textContent = category.name;

    const items = getItemsByCategory(state.currentCategoryId);

    if (items.length === 0) {
        elements.itemsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>用品がありません</p>
            </div>
        `;
    } else {
        elements.itemsList.innerHTML = items.map(item => {
            const stock = getStock(state.currentDepartmentId, item.id);
            const quantity = stock ? stock.quantity : 0;
            const expiryDate = stock ? stock.expiryDate : null;
            const expiryStatus = getExpiryStatus(expiryDate);

            let expiryHtml = '';
            if (item.hasExpiry && expiryDate) {
                const expiryClass = expiryStatus === 'expired' ? 'expired' :
                    expiryStatus === 'warning' ? 'warning' : '';
                const expiryLabel = expiryStatus === 'expired' ? '期限切れ' :
                    formatDate(expiryDate);
                expiryHtml = `<div class="item-expiry ${expiryClass}">${expiryLabel}</div>`;
            } else if (!item.hasExpiry) {
                expiryHtml = `<div class="item-expiry">期限なし</div>`;
            }

            return `
                <li class="item-row" data-item-id="${item.id}">
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        ${expiryHtml}
                    </div>
                    <div class="item-stock">${quantity}${item.unit}</div>
                </li>
            `;
        }).join('');

        // クリックイベント
        elements.itemsList.querySelectorAll('.item-row').forEach(row => {
            row.addEventListener('click', () => {
                state.currentItemId = parseInt(row.dataset.itemId);
                showTransactionModal();
            });
        });
    }

    openModal('items');
}

/**
 * 入出庫モーダルを表示
 */
function showTransactionModal() {
    const item = getItem(state.currentItemId);
    const stock = getStock(state.currentDepartmentId, state.currentItemId);
    const quantity = stock ? stock.quantity : 0;

    elements.transactionModalTitle.textContent = item.name;
    elements.currentStockValue.textContent = quantity;
    elements.currentStockUnit.textContent = item.unit;
    elements.transactionQuantity.value = 1;
    elements.transactionRemarks.value = '';

    // 期限入力欄の表示制御
    if (item.hasExpiry) {
        elements.expiryGroup.classList.add('visible');
        // デフォルトで1年後の日付を設定
        const defaultExpiry = new Date();
        defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
        elements.transactionExpiry.value = defaultExpiry.toISOString().split('T')[0];
    } else {
        elements.expiryGroup.classList.remove('visible');
        elements.transactionExpiry.value = '';
    }

    // デフォルトは入庫
    setTransactionType('IN');

    closeModal('items');
    openModal('transaction');
}

/**
 * 入出庫タイプを設定
 */
function setTransactionType(type) {
    state.transactionType = type;

    document.getElementById('btn-type-in').classList.toggle('active', type === 'IN');
    document.getElementById('btn-type-out').classList.toggle('active', type === 'OUT');

    // 期限入力は入庫時のみ表示
    const item = getItem(state.currentItemId);
    if (item && item.hasExpiry) {
        elements.expiryGroup.classList.toggle('visible', type === 'IN');
    }
}

/**
 * 数量を調整
 */
function adjustQuantity(delta) {
    const input = elements.transactionQuantity;
    const newValue = parseInt(input.value) + delta;
    if (newValue >= 1) {
        input.value = newValue;
    }
}

/**
 * 取引を保存
 */
function saveTransaction() {
    const quantity = parseInt(elements.transactionQuantity.value);
    const remarks = elements.transactionRemarks.value.trim();
    const item = getItem(state.currentItemId);

    if (isNaN(quantity) || quantity < 1) {
        alert('数量を正しく入力してください');
        return;
    }

    // 現在の在庫を取得
    const stock = getStock(state.currentDepartmentId, state.currentItemId);
    let currentQuantity = stock ? stock.quantity : 0;
    let expiryDate = stock ? stock.expiryDate : null;

    // 出庫の場合、在庫チェック
    if (state.transactionType === 'OUT' && currentQuantity < quantity) {
        alert('在庫が不足しています');
        return;
    }

    // 新しい在庫数を計算
    const newQuantity = state.transactionType === 'IN'
        ? currentQuantity + quantity
        : currentQuantity - quantity;

    // 入庫時に期限を更新（期限ありの用品のみ）
    if (state.transactionType === 'IN' && item.hasExpiry && elements.transactionExpiry.value) {
        expiryDate = elements.transactionExpiry.value;
    }

    // 在庫を更新
    updateStock(state.currentDepartmentId, state.currentItemId, newQuantity, expiryDate);

    // 取引履歴を追加
    addTransaction({
        departmentId: state.currentDepartmentId,
        itemId: state.currentItemId,
        type: state.transactionType,
        quantity: quantity,
        remarks: remarks || null
    });

    closeModal('transaction');

    // 用品一覧を再表示
    showItemsModal();
}

/**
 * 統計画面を描画
 */
function renderAnalytics() {
    renderLogList();
    renderInventoryMatrix();
    initBudgetControls();
    renderBudgetReport();
}

/**
 * 履歴ログを描画
 */
function renderLogList() {
    const transactions = getTransactions();

    if (transactions.length === 0) {
        elements.logList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <p>履歴がありません</p>
            </div>
        `;
        return;
    }

    // 最新50件を表示
    const recentTransactions = transactions.slice(0, 50);

    elements.logList.innerHTML = recentTransactions.map(tx => {
        const dept = getDepartment(tx.departmentId);
        const item = getItem(tx.itemId);
        const typeClass = tx.type === 'IN' ? 'in' : 'out';
        const typeLabel = tx.type === 'IN' ? '入庫' : '出庫';
        const sign = tx.type === 'IN' ? '+' : '-';

        return `
            <div class="log-item">
                <div class="log-type ${typeClass}">${typeLabel}</div>
                <div class="log-details">
                    <div class="log-item-name">${item ? item.name : '不明'}</div>
                    <div class="log-meta">${dept ? dept.name : '不明'} / ${formatDateTime(tx.timestamp)}</div>
                </div>
                <div class="log-quantity">${sign}${tx.quantity}</div>
            </div>
        `;
    }).join('');
}

/**
 * 在庫マトリックス（アコーディオン形式）を描画
 */
function renderInventoryMatrix() {
    const container = document.getElementById('matrix-accordion');
    const stocks = getStocks();

    // 署所リスト（警防課(ID:1)を除く）
    const stations = DEPARTMENTS.filter(d => d.id !== 1);
    const keibouka = DEPARTMENTS.find(d => d.id === 1);

    // カテゴリごとにアコーディオンを生成
    let html = CATEGORIES.map(category => {
        const categoryItems = getItemsByCategory(category.id);

        return `
            <div class="matrix-accordion-item">
                <div class="matrix-accordion-header" data-category-id="${category.id}">
                    <div class="matrix-accordion-title">
                        <span class="category-icon">${category.icon}</span>
                        <span>${category.name}</span>
                    </div>
                    <span class="accordion-toggle-icon">▼</span>
                </div>
                <div class="matrix-accordion-content">
                    <div class="matrix-table-wrapper">
                        ${renderMatrixTable(categoryItems, stocks, keibouka, stations)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // アコーディオン開閉イベント
    container.querySelectorAll('.matrix-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });
}

/**
 * カテゴリ内のマトリックステーブルを生成（署所が縦軸、用品が横軸）
 */
function renderMatrixTable(items, stocks, keibouka, stations) {
    let html = '<table class="inventory-matrix-table"><thead><tr>';
    html += '<th>署所＼用品</th>';

    // 横軸：各用品
    items.forEach(item => {
        // 長い名前は短縮表示
        const shortName = item.name.length > 10 ? item.name.substring(0, 10) + '...' : item.name;
        html += `<th title="${item.name}">${shortName}</th>`;
    });
    html += '</tr></thead><tbody>';

    // 縦軸：各署所（三次→東城の順）
    stations.forEach(station => {
        html += '<tr>';
        html += `<td>${station.name}</td>`;

        items.forEach(item => {
            const stock = stocks.find(s =>
                s.departmentId === station.id && s.itemId === item.id
            );
            const qty = stock ? stock.quantity : 0;
            html += `<td class="${qty === 0 ? 'stock-zero' : ''}">${qty || '-'}</td>`;
        });

        html += '</tr>';
    });

    // 署所合計行（警防課を除く）
    html += '<tr class="total-row">';
    html += '<td class="total-cell">署所計</td>';
    items.forEach(item => {
        let total = 0;
        stations.forEach(station => {
            const stock = stocks.find(s =>
                s.departmentId === station.id && s.itemId === item.id
            );
            total += stock ? stock.quantity : 0;
        });
        html += `<td class="total-cell">${total}</td>`;
    });
    html += '</tr>';

    // 警防課行
    html += '<tr class="keibouka-row">';
    html += '<td class="keibouka-cell">' + keibouka.name + '</td>';
    items.forEach(item => {
        const stock = stocks.find(s =>
            s.departmentId === keibouka.id && s.itemId === item.id
        );
        const qty = stock ? stock.quantity : 0;
        html += `<td class="keibouka-cell ${qty === 0 ? 'stock-zero' : ''}">${qty || '-'}</td>`;
    });
    html += '</tr>';

    html += '</tbody></table>';
    return html;
}

/**
 * 在庫マトリックスをCSV出力（署所が縦軸、用品が横軸）
 */
function exportMatrixCSV() {
    const stocks = getStocks();
    const stations = DEPARTMENTS.filter(d => d.id !== 1);
    const keibouka = DEPARTMENTS.find(d => d.id === 1);

    let csv = '\ufeff'; // BOM for Excel

    CATEGORIES.forEach((category, catIndex) => {
        const items = getItemsByCategory(category.id);

        // カテゴリヘッダー
        if (catIndex > 0) csv += '\n';
        csv += `【${category.name}】\n`;

        // 用品名ヘッダー
        csv += '署所,' + items.map(i => `"${i.name}"`).join(',') + '\n';

        // 各署所の行
        stations.forEach(station => {
            const values = items.map(item => {
                const stock = stocks.find(s =>
                    s.departmentId === station.id && s.itemId === item.id
                );
                return stock ? stock.quantity : 0;
            });
            csv += station.name + ',' + values.join(',') + '\n';
        });

        // 署所合計行
        const totals = items.map(item => {
            let total = 0;
            stations.forEach(station => {
                const stock = stocks.find(s =>
                    s.departmentId === station.id && s.itemId === item.id
                );
                total += stock ? stock.quantity : 0;
            });
            return total;
        });
        csv += '署所計,' + totals.join(',') + '\n';

        // 警防課行
        const keiboukaValues = items.map(item => {
            const stock = stocks.find(s =>
                s.departmentId === keibouka.id && s.itemId === item.id
            );
            return stock ? stock.quantity : 0;
        });
        csv += keibouka.name + ',' + keiboukaValues.join(',') + '\n';
    });

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    a.download = `EMS在庫一覧_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 予算コントロールを初期化
 */
function initBudgetControls() {
    const transactions = getTransactions();
    const years = new Set();

    transactions.forEach(tx => {
        const year = new Date(tx.timestamp).getFullYear();
        years.add(year);
    });

    // 現在年を追加
    years.add(new Date().getFullYear());

    const sortedYears = Array.from(years).sort((a, b) => b - a);

    elements.budgetYear.innerHTML = sortedYears.map(year =>
        `<option value="${year}">${year}年</option>`
    ).join('');

    // 月オプション
    elements.budgetMonth.innerHTML = `
        <option value="all">全期間</option>
        ${[...Array(12)].map((_, i) =>
        `<option value="${i + 1}">${i + 1}月</option>`
    ).join('')}
    `;
}

/**
 * 予算レポートを描画
 */
function renderBudgetReport() {
    const year = parseInt(elements.budgetYear.value);
    const month = elements.budgetMonth.value;
    const transactions = getTransactions();

    // 出庫のみをフィルタ
    const filtered = transactions.filter(tx => {
        if (tx.type !== 'OUT') return false;
        const date = new Date(tx.timestamp);
        if (date.getFullYear() !== year) return false;
        if (month !== 'all' && date.getMonth() + 1 !== parseInt(month)) return false;
        return true;
    });

    // 部署×用品のマトリクスを作成
    const matrix = {};
    DEPARTMENTS.forEach(dept => {
        matrix[dept.id] = {};
        ITEMS.forEach(item => {
            matrix[dept.id][item.id] = 0;
        });
    });

    filtered.forEach(tx => {
        matrix[tx.departmentId][tx.itemId] += tx.quantity;
    });

    // 使用された用品のみ抽出
    const usedItemIds = new Set();
    filtered.forEach(tx => usedItemIds.add(tx.itemId));
    const usedItems = ITEMS.filter(item => usedItemIds.has(item.id));

    if (usedItems.length === 0) {
        elements.budgetTable.innerHTML = `
            <tr><td colspan="12" style="text-align: center; padding: 2rem;">
                データがありません
            </td></tr>
        `;
        return;
    }

    // テーブルを描画
    let html = '<thead><tr><th>用品</th>';
    DEPARTMENTS.forEach(dept => {
        html += `<th>${dept.name}</th>`;
    });
    html += '<th>合計</th></tr></thead><tbody>';

    usedItems.forEach(item => {
        html += `<tr><td>${item.name}</td>`;
        let rowTotal = 0;
        DEPARTMENTS.forEach(dept => {
            const qty = matrix[dept.id][item.id];
            rowTotal += qty;
            html += `<td>${qty || '-'}</td>`;
        });
        html += `<td><strong>${rowTotal}</strong></td></tr>`;
    });

    html += '</tbody>';
    elements.budgetTable.innerHTML = html;
}

/**
 * CSVエクスポート
 */
function exportCSV() {
    const year = elements.budgetYear.value;
    const month = elements.budgetMonth.value;
    const transactions = getTransactions();

    // 出庫のみをフィルタ
    const filtered = transactions.filter(tx => {
        if (tx.type !== 'OUT') return false;
        const date = new Date(tx.timestamp);
        if (date.getFullYear() !== parseInt(year)) return false;
        if (month !== 'all' && date.getMonth() + 1 !== parseInt(month)) return false;
        return true;
    });

    // CSVヘッダー
    let csv = '\ufeff'; // BOM for Excel
    csv += '用品名,' + DEPARTMENTS.map(d => d.name).join(',') + ',合計\n';

    // 部署×用品のマトリクスを作成
    const matrix = {};
    ITEMS.forEach(item => {
        matrix[item.id] = {};
        DEPARTMENTS.forEach(dept => {
            matrix[item.id][dept.id] = 0;
        });
    });

    filtered.forEach(tx => {
        matrix[tx.itemId][tx.departmentId] += tx.quantity;
    });

    // 使用された用品のみ
    ITEMS.forEach(item => {
        const values = DEPARTMENTS.map(dept => matrix[item.id][dept.id]);
        const total = values.reduce((a, b) => a + b, 0);
        if (total > 0) {
            csv += `"${item.name}",${values.join(',')},${total}\n`;
        }
    });

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EMS在庫使用量_${year}年${month === 'all' ? '' : month + '月'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * タブを切り替え
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}

/**
 * 日付をフォーマット
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 日時をフォーマット
 */
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/* ============================================
   署所別在庫表示機能
   ============================================ */

/**
 * 署所別在庫一覧を描画
 */
function renderDepartmentInventory() {
    const dept = getDepartment(state.currentDepartmentId);
    document.getElementById('dept-inventory-title').textContent = `${dept.name} 在庫一覧`;

    const container = document.getElementById('dept-matrix-accordion');
    const stocks = getStocks();

    // カテゴリごとにアコーディオンを生成
    let html = CATEGORIES.map(category => {
        const categoryItems = getItemsByCategory(category.id);

        return `
            <div class="matrix-accordion-item">
                <div class="matrix-accordion-header" data-category-id="${category.id}">
                    <div class="matrix-accordion-title">
                        <span class="category-icon">${category.icon}</span>
                        <span>${category.name}</span>
                    </div>
                    <span class="accordion-toggle-icon">▼</span>
                </div>
                <div class="matrix-accordion-content">
                    <div class="matrix-table-wrapper">
                        ${renderDeptInventoryTable(categoryItems, stocks, state.currentDepartmentId)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // アコーディオン開閉イベント
    container.querySelectorAll('.matrix-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });
}

/**
 * 署所別在庫テーブルを生成
 */
function renderDeptInventoryTable(items, stocks, departmentId) {
    let html = '<table class="inventory-matrix-table"><thead><tr>';
    html += '<th>用品名</th>';
    html += '<th>現在庫</th>';
    html += '<th>使用期限</th>';
    html += '</tr></thead><tbody>';

    items.forEach(item => {
        const stock = stocks.find(s =>
            s.departmentId === departmentId && s.itemId === item.id
        );
        const qty = stock ? stock.quantity : 0;
        const expiryDate = stock ? stock.expiryDate : null;
        const expiryStatus = getExpiryStatus(expiryDate);

        let expiryText = '-';
        let expiryClass = '';
        if (item.hasExpiry && expiryDate) {
            expiryText = formatDate(expiryDate);
            if (expiryStatus === 'expired') {
                expiryClass = 'stock-low';
                expiryText = '期限切れ';
            } else if (expiryStatus === 'warning') {
                expiryClass = 'stock-low';
            }
        } else if (!item.hasExpiry) {
            expiryText = '期限なし';
        }

        html += '<tr>';
        html += `<td>${item.name}</td>`;
        html += `<td class="${qty === 0 ? 'stock-zero' : ''}">${qty}${item.unit}</td>`;
        html += `<td class="${expiryClass}">${expiryText}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

/**
 * 署所別在庫CSVエクスポート
 */
function exportDeptInventoryCSV() {
    const dept = getDepartment(state.currentDepartmentId);
    const stocks = getStocks();

    let csv = '\ufeff'; // BOM for Excel
    csv += `${dept.name} 在庫一覧\n\n`;

    CATEGORIES.forEach(category => {
        csv += `【${category.name}】\n`;
        csv += '用品名,現在庫,使用期限\n';

        const items = getItemsByCategory(category.id);
        items.forEach(item => {
            const stock = stocks.find(s =>
                s.departmentId === state.currentDepartmentId && s.itemId === item.id
            );
            const qty = stock ? stock.quantity : 0;
            const expiryDate = stock && stock.expiryDate ? stock.expiryDate : '-';

            csv += `"${item.name}",${qty}${item.unit},${expiryDate}\n`;
        });
        csv += '\n';
    });

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    a.download = `${dept.name}_在庫一覧_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ============================================
   他署所在庫確認機能
   ============================================ */

/**
 * 他署所在庫確認モーダルを開く
 */
function openOtherDeptModal() {
    const select = document.getElementById('other-dept-select');

    // 自署所以外の署所をリストに追加
    const otherDepts = DEPARTMENTS.filter(d => d.id !== state.currentDepartmentId);
    select.innerHTML = otherDepts.map(dept =>
        `<option value="${dept.id}">${dept.name}</option>`
    ).join('');

    openModal('otherDept');
    renderOtherDeptComparison();
}

/**
 * 他署所との在庫比較を描画
 */
function renderOtherDeptComparison() {
    const container = document.getElementById('other-dept-accordion');
    const stocks = getStocks();
    const myDeptId = state.currentDepartmentId;
    const otherDeptId = parseInt(document.getElementById('other-dept-select').value);

    const myDept = getDepartment(myDeptId);
    const otherDept = getDepartment(otherDeptId);

    // カテゴリごとにアコーディオンを生成
    let html = CATEGORIES.map(category => {
        const categoryItems = getItemsByCategory(category.id);

        return `
            <div class="matrix-accordion-item open">
                <div class="matrix-accordion-header" data-category-id="${category.id}">
                    <div class="matrix-accordion-title">
                        <span class="category-icon">${category.icon}</span>
                        <span>${category.name}</span>
                    </div>
                    <span class="accordion-toggle-icon">▼</span>
                </div>
                <div class="matrix-accordion-content">
                    <div class="matrix-table-wrapper">
                        ${renderComparisonTable(categoryItems, stocks, myDeptId, otherDeptId, myDept, otherDept)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    // アコーディオン開閉イベント
    container.querySelectorAll('.matrix-accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('open');
        });
    });
}

/**
 * 比較テーブルを生成
 */
function renderComparisonTable(items, stocks, myDeptId, otherDeptId, myDept, otherDept) {
    let html = '<table class="comparison-table"><thead><tr>';
    html += '<th>用品名</th>';
    html += `<th class="my-dept-col">${myDept.name}<br>(自署所)</th>`;
    html += `<th class="other-dept-col">${otherDept.name}</th>`;
    html += '</tr></thead><tbody>';

    items.forEach(item => {
        const myStock = stocks.find(s =>
            s.departmentId === myDeptId && s.itemId === item.id
        );
        const otherStock = stocks.find(s =>
            s.departmentId === otherDeptId && s.itemId === item.id
        );

        const myQty = myStock ? myStock.quantity : 0;
        const otherQty = otherStock ? otherStock.quantity : 0;

        html += '<tr>';
        html += `<td>${item.name}</td>`;
        html += `<td class="my-dept-col ${myQty === 0 ? 'stock-zero' : ''}">${myQty}${item.unit}</td>`;
        html += `<td class="other-dept-col ${otherQty === 0 ? 'stock-zero' : ''}">${otherQty}${item.unit}</td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}

// アプリ起動
document.addEventListener('DOMContentLoaded', initApp);

