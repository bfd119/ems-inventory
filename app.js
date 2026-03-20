// ============================================
// Date Picker Logic
// ============================================


var DatePicker = {
    state: {
        currentDate: new Date(), // for navigation
        selectedDate: null,
        view: 'day', // 'day' or 'month-year'
        onSelect: null,
        targetInput: null
    },
    elements: {}, // Will be populated in init()


    open(targetInputId) {
        console.log('DatePicker.open called for:', targetInputId);
        const target = document.getElementById(targetInputId);
        if (!target) {
            console.error('Target input not found:', targetInputId);
            return;
        }
        this.state.targetInput = target;

        if (!this.elements.modal) {
            console.error('DatePicker modal element not found!');
            return;
        }


        // Parse existing value or use today
        let initDate = new Date();
        if (target.value) {
            const parts = target.value.split('-');
            if (parts.length === 3) {
                initDate = new Date(parts[0], parts[1] - 1, parts[2]);
            }
        }
        this.state.selectedDate = new Date(initDate);
        this.state.currentDate = new Date(initDate);
        this.state.view = 'day';

        this.render();
        this.elements.modal.classList.add('active');
    },

    close() {
        this.elements.modal.classList.remove('active');
    },

    setView(view) {
        this.state.view = view;
        this.render();
    },

    prevMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() - 1);
        this.render();
    },

    nextMonth() {
        this.state.currentDate.setMonth(this.state.currentDate.getMonth() + 1);
        this.render();
    },

    prevYear() {
        this.state.currentDate.setFullYear(this.state.currentDate.getFullYear() - 1);
        this.render();
    },

    nextYear() {
        this.state.currentDate.setFullYear(this.state.currentDate.getFullYear() + 1);
        this.render();
    },

    selectMonth(monthIndex) {
        this.state.currentDate.setMonth(monthIndex);
        this.setView('day');
    },

    selectDate(year, month, day) {
        const date = new Date(year, month, day);
        // Adjust to local date string YYYY-MM-DD
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const val = `${y}-${m}-${d}`;

        if (this.state.targetInput) {
            this.state.targetInput.value = val;
            // Trigger change event if needed
            this.state.targetInput.dispatchEvent(new Event('change'));
            this.state.targetInput.dispatchEvent(new Event('input'));
        }
        this.close();
    },

    render() {
        const { currentDate, selectedDate, view } = this.state;
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Header
        this.elements.currentYearMonth.textContent = `${year}年 ${month + 1}月`;
        this.elements.selectingYear.textContent = `${year}年`;

        // View Toggling
        if (view === 'day') {
            this.elements.dayView.style.display = 'block';
            this.elements.monthYearView.style.display = 'none';
            this.renderDayGrid(year, month);
        } else {
            this.elements.dayView.style.display = 'none';
            this.elements.monthYearView.style.display = 'block';
            this.renderMonthsGrid(month);
        }
    },

    renderDayGrid(year, month) {
        const grid = this.elements.grid;
        grid.innerHTML = '';

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0(Sun) - 6(Sat)

        // Empty cells for prev month
        for (let i = 0; i < startDayOfWeek; i++) {
            grid.appendChild(document.createElement('div'));
        }

        const today = new Date();
        const isTodayMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let d = 1; d <= daysInMonth; d++) {
            const el = document.createElement('div');
            el.className = 'dp-day';
            el.textContent = d;

            if (isTodayMonth && today.getDate() === d) el.classList.add('today');

            // Check selected
            if (this.state.selectedDate &&
                this.state.selectedDate.getFullYear() === year &&
                this.state.selectedDate.getMonth() === month &&
                this.state.selectedDate.getDate() === d) {
                el.classList.add('selected');
            }

            el.onclick = () => this.selectDate(year, month, d);
            grid.appendChild(el);
        }
    },

    renderMonthsGrid(currentMonth) {
        const grid = this.elements.monthsGrid;
        grid.innerHTML = '';
        for (let m = 0; m < 12; m++) {
            const el = document.createElement('div');
            el.className = 'dp-month-item';
            el.textContent = `${m + 1}月`;
            if (m === currentMonth) el.classList.add('selected');
            el.onclick = () => this.selectMonth(m);
            grid.appendChild(el);
        }
    },

    init() {
        // Cache elements
        this.elements = {
            modal: document.getElementById('datepicker-modal'),
            titleWrapper: document.getElementById('dp-title-wrapper'),
            currentYearMonth: document.getElementById('dp-current-year-month'),
            grid: document.getElementById('dp-grid'),
            dayView: document.getElementById('dp-day-view'),
            monthYearView: document.getElementById('dp-month-year-view'),
            selectingYear: document.getElementById('dp-selecting-year'),
            monthsGrid: document.getElementById('dp-months-grid')
        };

        // Bind navigations
        document.getElementById('dp-prev-month').onclick = () => this.prevMonth();
        document.getElementById('dp-next-month').onclick = () => this.nextMonth();
        document.getElementById('dp-prev-year').onclick = () => this.prevYear();
        document.getElementById('dp-next-year').onclick = () => this.nextYear();
        document.getElementById('dp-title-wrapper').onclick = () => this.setView('month-year');
        document.getElementById('dp-cancel-selection').onclick = () => this.setView('day');

        // Bind modal overlay
        document.querySelector('#datepicker-modal .modal-overlay').onclick = () => this.close();

        // Bind inputs
        const bindInput = (id) => {
            const wrapper = document.getElementById(id + '-wrapper');
            if (wrapper) {
                wrapper.onclick = () => this.open(id);
            }
        };

        bindInput('transaction-expiry');
        bindInput('transaction-date');
        bindInput('new-expiry-date');
    }
};

// ============================================
// Supabase 設定
// ============================================
const SUPABASE_URL = 'https://aacntdoacjjssspoctul.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhY250ZG9hY2pqc3NzcG9jdHVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDA5OTcsImV4cCI6MjA4MzQ3Njk5N30.oBliHP_Jd9NOSSK1XFcO9egQWPzVhxn_KM0OTgaR8TQ';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ICONS = [
    'medication', 'vaccines', 'medical_services', 'bloodtype',
    'sick', 'checkroom', 'clean_hands', 'healing',
    'sanitizer', 'inventory_2', 'monitor_heart', 'ambulance', 'edit_note', 'content_cut'
];
const ICON_COLORS = {
    'medication': '#E91E63', 'vaccines': '#03A9F4', 'medical_services': '#3F51B5',
    'bloodtype': '#F44336', 'sick': '#4CAF50', 'checkroom': '#FF9800',
    'clean_hands': '#009688', 'healing': '#FFC107', 'sanitizer': '#00BCD4',
    'inventory_2': '#607D8B', 'monitor_heart': '#9C27B0', 'ambulance': '#FBC02D',
    'edit_note': '#795548', 'content_cut': '#607D8B'
};
// 部署マスター（固定）
const DEPARTMENTS = [
    { id: 1, name: "警防課" }, { id: 2, name: "三次" }, { id: 3, name: "作木" },
    { id: 4, name: "吉舎" }, { id: 5, name: "三和" }, { id: 6, name: "口和" },
    { id: 7, name: "甲奴" }, { id: 8, name: "庄原" }, { id: 9, name: "西城" },
    { id: 10, name: "高野" }, { id: 11, name: "東城" }
];
let CATEGORIES = [], ITEMS = [];
const state = { deptId: null, catId: null, itemId: null, txType: 'IN', stocks: [], transactions: [], selectedLot: null, editingCategoryId: null, editingItemId: null, settingsCatId: null };
const $ = id => document.getElementById(id);
const el = {};

// Initialize Application
function initializeApp() {
    cacheElements();
    bindEvents();
    loadData();
    if (typeof DatePicker !== 'undefined') DatePicker.init();

    // QRコードの生成
    const qrImg = document.getElementById('app-qr-code');
    if (qrImg) {
        // 現在のURL（ファイルパスまたはWebURL）を取得しエンコード
        const currentUrl = encodeURIComponent(window.location.href);
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${currentUrl}`;
    }
}

// Bootstrapping
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function cacheElements() {
    el.loading = $('loading');
    if (!el.loading) el.loading = document.getElementById('loading');

    el.screens = {
        home: $('department-select'),
        dashboard: $('dashboard'),
        analytics: $('analytics'),
        settings: $('settings')
    };
    el.deptSelect = $('department-select');
    el.deptGrid = $('department-grid');
    el.deptName = $('current-department-name');
    el.categoryGrid = $('category-grid');
    el.catGrid = el.categoryGrid; // alias for renderCatGrid compatibility
    el.itemsModal = $('items-modal');
    el.itemsModalTitle = $('items-modal-title');
    el.itemsList = $('items-list');
    el.txModal = $('transaction-modal');
    el.txTitle = $('transaction-title');
    el.txDate = $('transaction-date');
    el.txDateLabel = $('transaction-date-label');
    el.txItemName = $('transaction-modal-title');
    el.txStock = $('current-stock-value');
    el.txQty = $('transaction-quantity');
    el.txExpiry = $('transaction-expiry');
    el.expiryInputGroup = $('expiry-input-group');
    el.lotSelectGroup = $('lot-select-group');
    el.lotList = $('lot-list');
    el.txRemarks = $('transaction-remarks');
    el.saveBtn = $('save-transaction');
    el.settingsContainer = $('settings-container');
    el.newCategoryIconGrid = $('new-category-icon-grid');
    el.newCategoryIconInput = $('new-category-icon');
    el.addCategoryModalTitle = $('add-category-modal-title');
    el.addItemModalTitle = $('add-item-modal-title');
    el.editExpiryModal = $('edit-expiry-modal');
    el.newExpiryDate = $('new-expiry-date');
    el.currentExpiryDisplay = $('current-expiry-display');

    // Log & Summary & Budget elements
    el.summaryList = $('summary-list');
    el.logList = $('log-list');
    el.budgetTable = $('budget-table');
    el.budgetYear = $('budget-year');
    el.budgetMonth = $('budget-month');
    el.periodType = $('period-type');
    el.periodYmSelectors = $('period-ym-selectors');
    el.combinedListView = $('combined-list-view');
    el.combinedSummaryView = $('combined-summary-view');

    // モーダルのキャッシュ
    el.modals = {
        items: el.itemsModal,
        transaction: el.txModal,
        addCategory: $('add-category-modal'),
        addItem: $('add-item-modal'),
        editExpiry: el.editExpiryModal
    };

    // エイリアス（showTxModal互換性のため）
    el.stockValue = el.txStock;
    el.stockUnit = $('current-stock-unit');
    el.txModalTitle = el.txItemName;
}

function bindEvents() {
    $('back-to-home').onclick = () => showScreen('home');
    $('open-dept-inventory').onclick = () => {
        showScreen('analytics');
        switchTab('results');
        renderAnalytics();
    };
    $('open-stats').onclick = () => {
        state.deptId = null; // 全体集計
        showScreen('analytics');
        switchTab('results');
        renderAnalytics();
    };
    $('open-analytics-top').onclick = () => {
        state.deptId = null; // 全体集計
        showScreen('analytics');
        switchTab('results');
        renderAnalytics();
    };
    $('back-to-dashboard').onclick = () => {
        if (state.deptId) showScreen('dashboard');
        else showScreen('home');
    };
    $('open-settings').onclick = () => {
        const pw = prompt('設定画面にアクセスするにはパスワードを入力してください:');
        if (pw === null) return;
        if (pw !== 'keibouka') {
            alert('パスワードが正しくありません。');
            return;
        }
        showScreen('settings');
        renderSettings();
    };
    $('back-to-home-from-settings').onclick = () => showScreen('home');

    $('close-items-modal').onclick = () => el.itemsModal.classList.remove('active');

    // トランザクションモーダルを閉じるとき、カテゴリIDがあればリストに戻る
    $('close-transaction-modal').onclick = () => {
        el.txModal.classList.remove('active');
        if (state.catId) {
            showItemsModal();
        }
    };

    // カテゴリ追加モーダル
    $('close-add-category-modal').onclick = () => $('add-category-modal').classList.remove('active');
    $('save-new-category').onclick = saveNewCategory;

    // 用品追加モーダル
    $('close-add-item-modal').onclick = () => $('add-item-modal').classList.remove('active');

    // 期限編集モーダル
    $('close-edit-expiry-modal').onclick = () => el.editExpiryModal.classList.remove('active');
    $('cancel-edit-expiry').onclick = () => el.editExpiryModal.classList.remove('active');
    $('save-edit-expiry').onclick = saveLotExpiry;

    // Generic modal overlay close (for all modals)
    document.querySelectorAll('.modal-overlay').forEach(o => o.onclick = (e) => {
        // Find the parent modal and close it
        const modal = e.target.closest('.modal');
        if (modal) {
            modal.classList.remove('active');
            // トランザクションモーダルだった場合、リストに戻る
            if (modal.id === 'transaction-modal' && state.catId) {
                showItemsModal();
            }
        }
    });

    $('btn-type-out-use').onclick = () => setTxType('OUT_USE');
    $('btn-type-out-give').onclick = () => setTxType('OUT_GIVE');
    $('btn-type-in-buy').onclick = () => setTxType('IN_BUY');
    $('btn-type-in-get').onclick = () => setTxType('IN_GET');

    $('qty-minus').onclick = () => { el.txQty.value = Math.max(1, (+el.txQty.value || 0) - 1); };
    $('qty-plus').onclick = () => { el.txQty.value = (+el.txQty.value || 0) + 1; };

    $('save-transaction').onclick = saveTx;

    document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.onclick = () => {
        switchTab(b.dataset.tab);
        // 入力履歴タブに切り替えた時にリスト描画
        if (b.dataset.tab === 'history') renderCombined();
    });

    // 実績タブ内のイベント
    if (el.periodType) {
        el.periodType.onchange = () => {
            if (el.periodType.value === 'year_month') el.periodYmSelectors.style.display = 'inline';
            else el.periodYmSelectors.style.display = 'none';
            renderCombined();
        };
    }
    if ($('budget-year')) $('budget-year').onchange = renderCombined;
    if ($('budget-month')) $('budget-month').onchange = renderCombined;

    document.querySelectorAll('.tx-type-filter').forEach(cb => cb.onchange = renderCombined);
    document.querySelectorAll('.history-type-filter').forEach(cb => cb.onchange = renderCombined);

    if ($('export-csv')) $('export-csv').onclick = exportCSV;

    $('save-new-item').onclick = saveNewItem;

    // 検索機能
    $('item-search').oninput = handleSearchInput;
    $('search-clear').onclick = clearSearch;
    $('new-item-name').oninput = handleNewItemSearch;
}

// ============================================
// Supabase API
// ============================================

async function fsGetCategories() {
    const { data, error } = await db.from('categories').select('*').order('id');
    if (error) throw error;
    // データ整形: department_id は数値化
    return data.map(c => ({ ...c, departmentId: c.department_id ? +c.department_id : null }));
}

async function fsGetItems() {
    const { data: items, error: itemsError } = await db.from('items').select('*').order('id');
    if (itemsError) throw itemsError;

    // M2M対応: item_categoriesテーブルを取得してみる
    let links = [];
    try {
        const { data, error } = await db.from('item_categories').select('*');
        if (!error && data) links = data;
    } catch (e) {
        console.warn('item_categories read error (migration might be needed):', e);
    }

    // リンク情報がない場合は後方互換モード（移行前）
    if (links.length === 0) {
        return items.map(r => ({
            id: +r.id, categoryId: +r.category_id, name: r.name, unit: r.unit,
            hasExpiry: r.has_expiry, minStock: +r.min_stock, unitPrice: +r.unit_price || 0
        }));
    }

    // M2Mモード: リンク情報に基づいてアイテムを展開
    const itemMap = new Map(items.map(i => [i.id, i]));
    const result = [];

    links.forEach(l => {
        const item = itemMap.get(l.item_id);
        if (item) {
            result.push({
                id: +item.id,
                categoryId: +l.category_id, // リンク情報のカテゴリIDを使用
                name: item.name,
                unit: item.unit,
                hasExpiry: item.has_expiry,
                minStock: +item.min_stock,
                unitPrice: +item.unit_price || 0,
                sortOrder: l.sort_order != null ? +l.sort_order : 0
            });
        }
    });

    // リンクがない孤立アイテムも念のため(category_idカラムがあれば)救済する場合はここにロジック追加可
    // 今回は移行スクリプトで全itemがitem_categoriesに入っている前提とする

    return result;
}

async function fsUpdateItemUnitPrice(itemId, price) {
    const { error } = await db.from('items')
        .update({ unit_price: price || 0 })
        .eq('id', itemId);
    if (error) throw error;
}

async function fsGetStocks() {
    let allData = [];
    let offset = 0;
    while (true) {
        const { data, error } = await db.from('stocks').select('*').range(offset, offset + 999);
        if (error) throw error;
        allData = allData.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return allData.map(r => ({
        departmentId: +r.department_id, itemId: +r.item_id,
        expiryDate: r.expiry_date, quantity: +r.quantity, id: r.id
    }));
}

async function fsGetTransactions(limit = 10000) {
    let allData = [];
    let offset = 0;
    const batchSize = 1000;
    while (allData.length < limit) {
        const fetchCount = Math.min(batchSize, limit - allData.length);
        const { data, error } = await db.from('transactions')
            .select('*')
            .order('timestamp', { ascending: false })
            .range(offset, offset + fetchCount - 1);
        if (error) throw error;
        allData = allData.concat(data);
        if (data.length < fetchCount) break;
        offset += fetchCount;
    }
    return allData.map(r => ({
        id: r.id, departmentId: +r.department_id, itemId: +r.item_id,
        type: r.type, quantity: +r.quantity, expiryDate: r.expiry_date,
        remarks: r.remarks, timestamp: r.timestamp,
        targetDepartmentId: r.target_department_id ? +r.target_department_id : null
    }));
}

async function fsAddCategory(name, icon, type = 'system', departmentId = null) {
    const { data, error } = await db.from('categories')
        .insert({ name, icon: icon || 'inventory_2', type, department_id: departmentId }).select().single();
    if (error) throw error;
    return { ...data, departmentId: data.department_id ? +data.department_id : null };
}

async function fsUpdateCategory(id, name, icon) {
    const { data, error } = await db.from('categories')
        .update({ name, icon: icon || 'inventory_2' }).eq('id', id).select().single();
    if (error) throw error;
    return data;
}

async function fsDeleteCategory(id) {
    // カテゴリ削除: 用品自体(items)は削除しない（他カテゴリで共有される可能性があるため）
    // item_categoriesのリンクとレガシーのitems.category_id参照をクリーンアップしてから削除

    // 1. item_categoriesテーブルのリンクを削除
    await db.from('item_categories').delete().eq('category_id', id);

    // 2. レガシーのitems.category_idをクリア（FK制約回避）
    await db.from('items').update({ category_id: null }).eq('category_id', id);

    // 3. カテゴリを削除
    const { error } = await db.from('categories').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
}

async function fsAddItem(categoryId, name, unit, hasExpiry, minStock, existingItemId = null) {
    let itemId = existingItemId;

    if (!itemId) {
        // 新規用品作成
        // category_idカラムは後方互換あるいはNOT NULL制約回避のため一応指定するが、
        // 将来的にはNULL許容または廃止。とりあえず指定しておく。
        const { data, error } = await db.from('items')
            .insert({ category_id: categoryId, name, unit: unit || '個', has_expiry: !!hasExpiry, min_stock: minStock || 0 })
            .select().single();
        if (error) throw error;
        itemId = data.id;
    } else {
        // 既存用品の場合、プロパティ更新（任意）
        // ここでは名前などを更新せず、リンクだけ作る方針
    }

    // リンク作成 (item_categories)
    // 重複エラー回避 (ON CONFLICT DO NOTHINGがあればいいが、insertでエラーになるかもなので)
    const { error: linkError } = await db.from('item_categories')
        .insert({ item_id: itemId, category_id: categoryId });

    // すでに存在する場合のエラーは無視してよいが、握りつぶしすぎも危険。
    // 23505 (unique_violation) ならOK
    if (linkError && linkError.code !== '23505') {
        // テーブルがない場合(42P01)は、旧仕様として無視するかエラーにするか。
        // ここではエラーログ出して続行（itemsには入ってるので）
        console.warn('Failed to insert into item_categories', linkError);
    }

    return { id: itemId, categoryId: categoryId, name, unit, hasExpiry, minStock };
}

async function fsUpdateItem(id, oldCategoryId, newCategoryId, name, unit, hasExpiry, minStock) {
    // 用品自体の更新
    const { data, error } = await db.from('items')
        .update({ name, unit: unit || '個', has_expiry: !!hasExpiry, min_stock: minStock || 0 })
        .eq('id', id).select().single();
    if (error) throw error;

    // カテゴリ変更があった場合、リンクを更新
    if (oldCategoryId && newCategoryId && oldCategoryId !== newCategoryId) {
        // 既存のリンクを更新 (旧カテゴリ -> 新カテゴリ)
        // 重複チェック: 新カテゴリに既にリンクがある場合は、旧リンクを削除するだけでよい（統合）
        // しかし「移動」なので、統合されると元のコンテキストが消える。
        // まぁ「移動先に既にある」なら「移動」＝「そっちに合流」でOK。

        const { data: existing } = await db.from('item_categories')
            .select('id').match({ item_id: id, category_id: newCategoryId }).maybeSingle();

        if (existing) {
            // 移動先にもうある -> 旧リンクを削除
            await db.from('item_categories').delete().match({ item_id: id, category_id: oldCategoryId });
        } else {
            // 移動先にない -> リンクのカテゴリIDを更新
            await db.from('item_categories')
                .update({ category_id: newCategoryId })
                .match({ item_id: id, category_id: oldCategoryId });
        }

        // Legacy column update (optional, keeps last used category)
        await db.from('items').update({ category_id: newCategoryId }).eq('id', id);
    }

    return { id: data.id, categoryId: newCategoryId || oldCategoryId, name: data.name, unit: data.unit, hasExpiry: data.has_expiry, minStock: data.min_stock };
}

async function fsDeleteItem(id) {
    // 関連する取引履歴と在庫を先に削除
    await db.from('transactions').delete().eq('item_id', id);
    await db.from('stocks').delete().eq('item_id', id);

    // 用品を削除
    const { error } = await db.from('items').delete().eq('id', id);
    if (error) throw error;
    return { success: true };
}

async function fsStockIn(deptId, itemId, expiryDate, quantity, remarks, transactionDate) {
    // upsert_stock RPC でアトミックに在庫を加算（重複防止）
    const { error: rpcError } = await db.rpc('upsert_stock', {
        p_department_id: deptId,
        p_item_id:       itemId,
        p_expiry_date:   expiryDate || null,
        p_delta:         quantity
    });
    if (rpcError) throw rpcError;
    return fsAddTransaction(deptId, itemId, 'IN', quantity, expiryDate, remarks, transactionDate);
}

async function fsStockOut(deptId, itemId, expiryDate, quantity, remarks, transactionDate) {
    let query = db.from('stocks')
        .select('*')
        .eq('department_id', deptId)
        .eq('item_id', itemId);

    if (expiryDate) {
        query = query.eq('expiry_date', expiryDate);
    } else {
        query = query.is('expiry_date', null);
    }

    const { data: records, error } = await query.order('id', { ascending: true });

    if (error || !records || records.length === 0) {
        throw new Error('在庫不足');
    }

    const totalStock = records.reduce((sum, r) => sum + r.quantity, 0);
    if (totalStock < quantity) {
        console.error('在庫不足エラー詳細:', { deptId, itemId, expiryDate, quantity, records, error });
        // デバッグ用アラートは削除し、本来のエラーのみスロー
        throw new Error('在庫不足');
    }

    let remain = quantity;
    for (const rec of records) {
        if (remain <= 0) break;
        if (rec.quantity <= remain) {
            await db.from('stocks').delete().eq('id', rec.id);
            remain -= rec.quantity;
        } else {
            await db.from('stocks').update({ quantity: rec.quantity - remain }).eq('id', rec.id);
            remain = 0;
        }
    }
    return fsAddTransaction(deptId, itemId, 'OUT', quantity, expiryDate, remarks, transactionDate);
}

async function fsAddTransaction(deptId, itemId, type, quantity, expiryDate, remarks, transactionDate) {
    const ts = transactionDate ? new Date(transactionDate) : new Date();
    const { data, error } = await db.from('transactions')
        .insert({ department_id: deptId, item_id: itemId, type, quantity, expiry_date: expiryDate || null, remarks: remarks || '', timestamp: ts.toISOString() })
        .select().single();
    if (error) throw error;
    return { id: data.id, departmentId: +data.department_id, itemId: +data.item_id, type: data.type, quantity: +data.quantity, expiryDate: data.expiry_date, remarks: data.remarks, timestamp: data.timestamp };
}

// トランザクション削除（在庫ロールバック付き）
async function fsDeleteTransaction(txId) {
    // 1. トランザクション取得
    const { data: tx, error: fetchError } = await db.from('transactions')
        .select('*').eq('id', txId).single();
    if (fetchError) throw fetchError;

    const deptId = tx.department_id;
    const itemId = tx.item_id;
    const expiryDate = tx.expiry_date;
    const qty = tx.quantity;
    const isOut = tx.type === 'OUT' || tx.type.startsWith('OUT_');

    // 2. 在庫ロールバック
    let stockQuery = db.from('stocks')
        .select('*')
        .eq('department_id', deptId)
        .eq('item_id', itemId);

    if (expiryDate) {
        stockQuery = stockQuery.eq('expiry_date', expiryDate);
    } else {
        stockQuery = stockQuery.is('expiry_date', null);
    }

    const { data: stockRecords } = await stockQuery;

    if (isOut) {
        // 出庫の取り消し → upsert_stock で在庫を加算（アトミック）
        const { error: rpcError } = await db.rpc('upsert_stock', {
            p_department_id: deptId,
            p_item_id:       itemId,
            p_expiry_date:   expiryDate || null,
            p_delta:         qty
        });
        if (rpcError) throw rpcError;
    } else {
        // 入庫の取り消し → 在庫を減算
        if (stockRecords && stockRecords.length > 0) {
            const newQty = stockRecords[0].quantity - qty;
            if (newQty <= 0) {
                await db.from('stocks').delete().eq('id', stockRecords[0].id);
            } else {
                await db.from('stocks')
                    .update({ quantity: newQty })
                    .eq('id', stockRecords[0].id);
            }
        }
        // レコードがなければ在庫0のまま（既に0なので何もしない）
    }

    // 3. トランザクションを削除
    const { error: deleteError } = await db.from('transactions').delete().eq('id', txId);
    if (deleteError) throw deleteError;

    return tx;
}

async function fsUpdateStockExpiry(deptId, itemId, oldExpiry, newExpiry) {
    let query = db.from('stocks')
        .select('*')
        .eq('department_id', deptId)
        .eq('item_id', itemId);

    if (oldExpiry) {
        query = query.eq('expiry_date', oldExpiry);
    } else {
        query = query.is('expiry_date', null);
    }

    const { data: existing, error } = await query.limit(1).maybeSingle();

    if (error || !existing) {
        throw new Error('該当する在庫ロットが見つかりません');
    }

    await db.from('stocks').update({ expiry_date: newExpiry || null }).eq('id', existing.id);
    return { success: true };
}

const CACHE_KEY = 'ems_inventory_cache';

async function loadData() {
    showLoading(true);

    // キャッシュから即座に表示
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const c = JSON.parse(cached);
            CATEGORIES = c.categories || [];
            ITEMS = c.items || [];
            state.stocks = c.stocks || [];
            state.transactions = c.transactions || [];
            renderDeptGrid();
            initBudget();
        } catch (e) {
            console.warn('キャッシュ読込失敗', e);
        }
    }

    // Supabaseから最新データを取得
    try {
        // タイムアウト付きでデータを取得
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('タイムアウト: データの読み込みに時間がかかっています')), 10000));

        const dataPromise = Promise.all([
            fsGetCategories(),
            fsGetItems(),
            fsGetStocks(),
            fsGetTransactions(10000)
        ]);

        [CATEGORIES, ITEMS, state.stocks, state.transactions] = await Promise.race([dataPromise, timeoutPromise]);

        // キャッシュ更新
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            categories: CATEGORIES, items: ITEMS,
            stocks: state.stocks, transactions: state.transactions,
            timestamp: Date.now()
        }));

        renderDeptGrid();
        initCombined();
    } catch (e) {
        console.error('Data loading error:', e);
        if (!cached) {
            handleError(e);
            alert('データの読み込みに失敗しました。再読み込みしてください。\n' + (e.message || e));
        }
    } finally {
        showLoading(false);
    }
}

function showScreen(n) { Object.values(el.screens).forEach(s => s.classList.remove('active')); el.screens[n].classList.add('active'); }
function openModal(n) { el.modals[n].classList.add('active'); }
function closeModal(n) { el.modals[n].classList.remove('active'); }
function showLoading(s) { el.loading.classList.toggle('hidden', !s); }

function renderDeptGrid() {
    el.deptGrid.innerHTML = DEPARTMENTS.map(d => `<button class="department-btn" data-id="${d.id}">${d.name}</button>`).join('');
    el.deptGrid.querySelectorAll('.department-btn').forEach(b => b.onclick = () => { state.deptId = +b.dataset.id; showDashboard(); });
}

function showDashboard() {
    const d = DEPARTMENTS.find(x => x.id === state.deptId);
    el.deptName.textContent = d.name + ' 在庫管理';
    renderCatGrid();
    showScreen('dashboard');
    renderCatGrid();
    showScreen('dashboard');
    // 検索バーは常時表示のため非表示リセットしない
    // $('search-bar').style.display = 'none';
    $('item-search').value = '';
    $('search-suggestions').innerHTML = '';

    // 在庫不足リストの表示（自署の場合のみ）
    const catGrid = $('category-grid');
    // 既存のリストがあれば削除
    const existingList = document.querySelector('.shortage-list-section');
    if (existingList) existingList.remove();

    if (state.deptId) {
        // 在庫不足数割れ
        const shortageItems = ITEMS.filter(item => {
            const lots = getLots(state.deptId, item.id);
            const total = lots.reduce((a, l) => a + l.quantity, 0);
            return item.minStock > 0 && total < item.minStock;
        });

        // 期限切れ・期限間近（60日以内）
        const now = new Date();
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + 60);

        const nearExpiryItems = ITEMS.filter(item => {
            if (!item.hasExpiry) return false;
            const lots = getLots(state.deptId, item.id);
            if (lots.length === 0) return false;
            // 在庫不足リストに既に含まれている場合は重複表示しない？→いや、理由は別なので表示してもよいが、今回は分ける
            // 期限に関する警告があるか
            return lots.some(l => {
                if (!l.expiryDate) return false;
                const d = new Date(l.expiryDate);
                return d < threshold;
            });
        });

        // リストセクションの作成（アラートがない場合も「異常なし」を表示）
        const section = document.createElement('div');
        section.className = 'shortage-list-section';
        let html = '';

        if (shortageItems.length > 0 || nearExpiryItems.length > 0) {
            // アラートがある場合

            // 1. 在庫不足リスト
            if (shortageItems.length > 0) {
                html += `
                        <div class="shortage-list-header">
                            <span class="material-symbols-outlined">warning</span>
                            <span>在庫不足の用品があります（基準数割れ）</span>
                        </div>
                        <div class="shortage-items" style="margin-bottom: 1rem;">
                            ${shortageItems.map(item => {
                    const lots = getLots(state.deptId, item.id);
                    const total = lots.reduce((a, l) => a + l.quantity, 0);
                    return `<div class="shortage-item-row" onclick="state.catId=${item.categoryId};state.itemId=${item.id};showTxModal()">
                                    <span style="font-weight:500">${item.name}</span>
                                    <span style="color:var(--color-danger);font-weight:700">現在: ${total}${item.unit} (基準: ${item.minStock})</span>
                                </div>`;
                }).join('')}
                        </div>`;
            }

            // 2. 期限切れ・間近リスト
            if (nearExpiryItems.length > 0) {
                html += `
                        <div class="shortage-list-header" style="${shortageItems.length > 0 ? 'margin-top:0.5rem;border-top:1px dashed #fecaca;padding-top:0.5rem;' : ''}">
                            <span class="material-symbols-outlined">event_busy</span>
                            <span>期限切れ・期限間近の用品があります</span>
                        </div>
                        <div class="shortage-items">
                            ${nearExpiryItems.map(item => {
                    const lots = getLots(state.deptId, item.id);
                    // フィルタ済みだが念のため再取得
                    const alertLots = lots.filter(l => {
                        if (!l.expiryDate) return false;
                        return new Date(l.expiryDate) < threshold;
                    }).sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

                    const lotText = alertLots.map(l => {
                        const isExp = getExpStatus(l.expiryDate) === 'expired';
                        return `<span style="${isExp ? 'color:red;font-weight:bold;' : ''}">${l.expiryDate}(${l.quantity})</span>`;
                    }).join(', ');

                    return `<div class="shortage-item-row" onclick="state.catId=${item.categoryId};state.itemId=${item.id};showTxModal()">
                                    <span style="font-weight:500">${item.name}</span>
                                    <span style="font-size:0.85rem; color:var(--color-text-secondary)">${lotText}</span>
                                </div>`;
                }).join('')}
                        </div>`;
            }
        } else {
            // 異常なし（Good状態）
            section.style.background = '#f0fff4'; // 薄い緑背景
            section.style.borderColor = '#9ae6b4'; // 緑ボーダー
            html = `
                        <div class="shortage-list-header" style="color: #276749; margin-bottom: 0;">
                            <span class="material-symbols-outlined">check_circle</span>
                            <span>在庫状況は良好です（不足・期限切れ間近なし）</span>
                        </div>`;
        }

        section.innerHTML = html;
        catGrid.insertAdjacentElement('afterend', section);
    }
}

// 検索機能
// 検索機能
// function toggleSearchBar() { ... } // 常時表示のため廃止


function handleSearchInput(e) {
    const query = normalizeForCheck(e.target.value.trim());
    const clearBtn = $('search-clear');
    clearBtn.classList.toggle('visible', query.length > 0);

    if (query.length === 0) {
        $('search-suggestions').innerHTML = '';
        return;
    }

    // 用品を検索
    const matches = ITEMS.filter(item => {
        const iName = normalizeForCheck(item.name);
        return iName.includes(query);
    }).slice(0, 10); // 最大10件

    renderSearchSuggestions(matches);
}

function renderSearchSuggestions(items) {
    const container = $('search-suggestions');
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:1rem;">該当する用品がありません</p>';
        return;
    }

    container.innerHTML = items.map(item => {
        const cat = CATEGORIES.find(c => c.id === item.categoryId);
        const catName = cat ? cat.name : '';
        const lots = getLots(state.deptId, item.id);
        const total = lots.reduce((a, l) => a + l.quantity, 0);
        return `<div class="suggestion-item" data-item-id="${item.id}" data-cat-id="${item.categoryId}">
                    <div>
                        <div class="suggestion-item-name">${item.name}</div>
                        <div class="suggestion-item-category">${catName}</div>
                    </div>
                    <div class="suggestion-item-stock">${total}${item.unit}</div>
                </div>`;
    }).join('');

    // クリックイベント
    container.querySelectorAll('.suggestion-item').forEach(el => {
        el.onclick = () => {
            const itemId = +el.dataset.itemId;
            const catId = +el.dataset.catId;
            state.catId = catId;
            state.itemId = itemId;
            showTxModal();
            clearSearch();
        };
    });
}

function clearSearch() {
    $('item-search').value = '';
    $('search-suggestions').innerHTML = '';
    $('search-clear').classList.remove('visible');
}

function renderCatGrid() {
    let html = '';

    // 統合グリッド表示 (System + User)
    if (CATEGORIES.length === 0) {
        html += '<p style="color:var(--color-text-muted); padding:1rem;">カテゴリがありません</p>';
    } else {
        // フィルタリング: 共通(departmentId==null) または 現在の署所(departmentId==state.deptId)
        const visibleCategories = CATEGORIES.filter(c => {
            if (!c.departmentId) return true; // 共通
            return c.departmentId === state.deptId; // 自署所のみ
        });

        if (visibleCategories.length === 0) {
            html += '<p style="color:var(--color-text-muted); padding:1rem;">カテゴリがありません</p>';
        } else {
            html += visibleCategories.map(c => {
                const isUser = c.type === 'user';
                // UserSetの場合はスタイルを変更: 白背景、枠維持、アイコンオレンジ
                // 背景色は card (white) に変更、ボーダーは accent (orange)
                const style = isUser ? 'border-color:var(--color-accent-primary); background:#ffffff;' : '';
                const iconColor = isUser ? 'var(--color-accent-primary)' : (ICON_COLORS[c.icon] || '');
                const labelHtml = isUser ? '<span class="fav-set-label">お気に入りセット</span>' : '';

                return `
                        <button class="category-tile" data-id="${c.id}" style="${style}">
                            <span class="category-icon">
                                <span class="material-symbols-outlined" style="color: ${iconColor}">${c.icon}</span>
                            </span>
                            <span class="category-name">${c.name}</span>
                            ${labelHtml}
                        </button>`;
            }).join('');
        }
    }


    // 統一された追加ボタン（警防課のみ）
    if (state.deptId === 1) {
        html += `<button class="category-tile add-tile" onclick="openAddCategoryModal()">
                            <span class="add-icon">+</span>
                            <span class="category-name">追加</span>
                        </button>`;
    }

    el.catGrid.innerHTML = html;

    // イベントリスナー設定
    el.catGrid.querySelectorAll('.category-tile:not(.add-tile)').forEach(t => t.onclick = () => { state.catId = +t.dataset.id; showItemsModal(); });
}

function openAddItemModal(categoryId) {
    // Check if this is a "user" category (Favorite Set)
    const cat = CATEGORIES.find(c => c.id === categoryId);
    const isFavSet = cat && cat.type === 'user';

    // Reset UI
    $('new-item-category').innerHTML = CATEGORIES.map(c =>
        `<option value="${c.id}" ${c.id === categoryId ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    // If it's a fav set, lock the category selection to current
    if (isFavSet) {
        $('new-item-category').innerHTML = `<option value="${cat.id}" selected>${cat.name}</option>`;
        $('new-item-category').disabled = true;
    } else {
        $('new-item-category').disabled = false;
    }

    $('new-item-name').value = '';
    $('new-item-unit').value = '個';
    $('new-item-has-expiry').checked = false;
    $('new-item-min-stock').value = 0;
    $('new-item-existing-id').value = '';

    // Layout based on Type
    const detailsDiv = $('new-item-details');
    const restrictionMsg = $('fav-set-restriction-msg');
    // const helperText = $('new-item-helper-text'); // Removed

    if (isFavSet) {
        // Restrictions for Favorite Set
        detailsDiv.style.display = 'none'; // Hide new item creation fields
        restrictionMsg.style.display = 'block';
        // helperText.textContent = '追加したい既存の用品名を検索して選択してください'; // Removed
    } else {
        // Normal behavior
        detailsDiv.style.display = 'block';
        restrictionMsg.style.display = 'none';
        // helperText.textContent = '新しい用品名を入力するか、既存の用品を選択してください'; // Removed
    }

    $('existing-item-info').style.display = 'none';
    $('new-item-suggestions').style.display = 'none';

    openModal('addItem');
}

function toggleCategoryTypeHelp() {
    const isSet = document.querySelector('input[name="cat-type"][value="user"]').checked;
    const help = $('set-help-text');
    const nameInput = $('new-category-name');

    if (isSet) {
        help.style.display = 'block';
        nameInput.placeholder = '例: 救急セットA';
    } else {
        help.style.display = 'none';
        nameInput.placeholder = '例: 輸液';
    }
}

function openAddSetModal() {
    state.addingCategoryType = 'user';
    el.addCategoryModalTitle.textContent = '新しいセットを作成';
    $('new-category-name').placeholder = '例: 救急セットA';
    openModal('addCategory');
}

function showItemsModal() {
    const c = CATEGORIES.find(x => x.id === state.catId);
    el.itemsModalTitle.textContent = c.name;
    const items = ITEMS.filter(i => i.categoryId === state.catId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    let html = '';
    if (items.length === 0) {
        html = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>用品がありません</p></div>';
    } else {
        html = items.map(item => {
            const lots = getLots(state.deptId, item.id);
            const total = lots.reduce((a, l) => a + l.quantity, 0);
            const hasExpired = lots.some(l => getExpStatus(l.expiryDate) === 'expired');

            let lotInfoHtml = '';
            if (item.hasExpiry && lots.length > 0) {
                const sortedLots = [...lots].sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
                lotInfoHtml = `<div class="lot-tags">` +
                    sortedLots.map(l => {
                        const isExp = getExpStatus(l.expiryDate) === 'expired';
                        return `<span class="lot-tag ${isExp ? 'expired' : ''}">${l.expiryDate || '期限なし'}: ${l.quantity}</span>`;
                    }).join('') + `</div>`;
            }

            // 在庫不足判定
            const isShortage = item.minStock > 0 && total < item.minStock;

            // 期限切れ・期限間近判定（60日以内）
            let hasNearExpiry = false;
            if (item.hasExpiry && lots.length > 0) {
                const now = new Date();
                const threshold = new Date();
                threshold.setDate(threshold.getDate() + 60); // 60日以内

                hasNearExpiry = lots.some(l => {
                    if (!l.expiryDate) return false;
                    const d = new Date(l.expiryDate);
                    return d < threshold; // 期限切れまたは60日以内
                });
            }

            // アラート発動（在庫不足 または 期限警告）
            const isAlert = isShortage || hasNearExpiry;
            // アラートメッセージの作成
            const alerts = [];
            if (hasExpired) alerts.push('⚠️期限切れあり');
            else if (hasNearExpiry) alerts.push('⚠️期限間近');

            if (isShortage) alerts.push('⚠️在庫不足');

            const alertText = alerts.join(' / ');
            const hasAnyAlert = alerts.length > 0;

            const unitPriceHtml = (item.unitPrice && item.unitPrice > 0)
                ? `<span style="font-size:0.75rem; color:var(--color-text-secondary); margin-left:8px; font-weight:normal;">(¥${item.unitPrice.toLocaleString()})</span>`
                : '';

            return `<li class="item-row" data-id="${item.id}">
                        <div class="item-info">
                            <div class="item-name">${item.name}${unitPriceHtml}</div>
                            ${lotInfoHtml}
                            ${hasAnyAlert ? `<div style="margin-top:4px;"><span class="item-alert-label">${alertText}</span></div>` : ''}
                        </div>
                        <div class="item-stock" style="${isShortage ? 'color:var(--color-danger); font-weight:bold;' : ''}">${total}${item.unit}</div>
                    </li>`;
        }).join('');
    }
    // 追加ボタン（警防課のみ）
    if (state.deptId === 1) {
        html += `<li class="item-row add-item-row" onclick="openAddItemModal(${state.catId})"><div class="add-item-icon">+</div><div class="add-item-text">用品を追加</div></li>`;
    }

    el.itemsList.innerHTML = html;
    el.itemsList.querySelectorAll('.item-row:not(.add-item-row)').forEach(r => r.onclick = () => { state.itemId = +r.dataset.id; showTxModal(); });
    openModal('items');
}

function showTxModal() {
    const item = ITEMS.find(i => i.id === state.itemId);
    const lots = getLots(state.deptId, state.itemId);
    const total = lots.reduce((a, l) => a + l.quantity, 0);
    el.txModalTitle.textContent = item.name;
    el.stockValue.textContent = total;
    el.stockUnit.textContent = item.unit;
    el.txQty.value = 1;
    el.txRemarks.value = '';
    el.txDate.value = new Date().toISOString().split('T')[0];
    state.selectedLot = null;
    setTxType('OUT_USE');
    closeModal('items');
    openModal('transaction');
}

function setTxType(t) {
    state.txType = t;
    $('btn-type-out-use').classList.toggle('active', t === 'OUT_USE');
    $('btn-type-out-give').classList.toggle('active', t === 'OUT_GIVE');
    $('btn-type-in-buy').classList.toggle('active', t === 'IN_BUY');
    $('btn-type-in-get').classList.toggle('active', t === 'IN_GET');

    const isInbound = (t === 'IN_BUY' || t === 'IN_GET');
    const isOutbound = (t === 'OUT_USE' || t === 'OUT_GIVE');

    if ($('tx-group-out')) $('tx-group-out').classList.toggle('active-out', isOutbound);
    if ($('tx-group-in')) $('tx-group-in').classList.toggle('active-in', isInbound);

    if (t === 'OUT_USE') el.txDateLabel.textContent = '使用日';
    else if (t === 'OUT_GIVE') el.txDateLabel.textContent = 'あげた日';
    else if (t === 'IN_BUY') el.txDateLabel.textContent = '購入日';
    else if (t === 'IN_GET') el.txDateLabel.textContent = 'もらった日';

    const item = ITEMS.find(i => i.id === state.itemId);
    const lots = getLots(state.deptId, state.itemId);
    const lotLabel = el.lotSelectGroup.querySelector('label');

    const unitPriceGroup = document.getElementById('unit-price-group');
    if (t === 'IN_BUY') {
        if (unitPriceGroup) unitPriceGroup.style.display = 'block';
        document.getElementById('transaction-unit-price').value = item.unitPrice || '';
    } else {
        if (unitPriceGroup) unitPriceGroup.style.display = 'none';
    }

    if (isInbound && item.hasExpiry) {
        el.expiryInputGroup.style.display = 'block';
        el.lotSelectGroup.style.display = 'none'; // 入庫時は期限選択グループ(lot-select-group)は隠す

        // プルダウンに既存の期限をセット
        if (lots.length > 0) {
            const uniqueExps = [...new Set(lots.map(l => l.expiryDate).filter(d => d))].sort();
            let optionsHtml = '<option value="">（新規追加）</option>';
            uniqueExps.forEach(exp => {
                optionsHtml += `<option value="${exp}">${exp}</option>`;
            });
            $('transaction-expiry-select').innerHTML = optionsHtml;
            $('transaction-expiry-select').style.display = 'block';

            // プルダウンの変更イベント処理
            $('transaction-expiry-select').onchange = (e) => {
                const v = e.target.value;
                if (v) {
                    el.txExpiry.value = v; // 選択した期限をセット
                    $('transaction-expiry-wrapper').style.display = 'none'; // 新規追加入力欄を隠す
                } else {
                    $('transaction-expiry-wrapper').style.display = 'flex'; // 新規追加入力欄を表示
                    const def = new Date(); def.setFullYear(def.getFullYear() + 1);
                    el.txExpiry.value = def.toISOString().split('T')[0];
                }
            };
            // 初期状態: プルダウン未選択で新規追加扱い
            $('transaction-expiry-select').value = "";
            $('transaction-expiry-wrapper').style.display = 'flex';
        } else {
            $('transaction-expiry-select').style.display = 'none';
            $('transaction-expiry-wrapper').style.display = 'flex';
        }

        if (!$('transaction-expiry-select').value) {
            const def = new Date(); def.setFullYear(def.getFullYear() + 1);
            el.txExpiry.value = def.toISOString().split('T')[0];
        }
    } else if (isOutbound && item.hasExpiry && lots.length > 0) {
        el.expiryInputGroup.style.display = 'none';
        el.lotSelectGroup.style.display = 'block';
        if (lotLabel) lotLabel.textContent = 'どれを使う？（期限えらび）:';
        renderLotList(lots);
    } else {
        el.expiryInputGroup.style.display = 'none';
        el.lotSelectGroup.style.display = 'none';
    }

    if (t === 'OUT_GIVE' || t === 'IN_GET') {
        $('partner-dept-group').style.display = 'block';
        $('partner-dept-label').textContent = t === 'OUT_GIVE' ? 'どこにあげた？' : 'どこからもらった？';
        const otherDepts = DEPARTMENTS.filter(d => d.id !== state.deptId);
        $('partner-dept').innerHTML = otherDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } else {
        $('partner-dept-group').style.display = 'none';
    }
}

function renderLotList(lots) {
    lots.sort((a, b) => new Date(a.expiryDate || '9999') - new Date(b.expiryDate || '9999'));
    // IN時はクリックでコピー、OUT時は選択
    const isIn = state.txType === 'IN';

    el.lotList.innerHTML = lots.map((l, i) => `
                <div class="lot-item ${getExpStatus(l.expiryDate) === 'expired' ? 'expired' : ''}" data-idx="${i}" title="${isIn ? 'クリックして期限をコピー' : '出庫するロットを選択'}">
                    <span>${l.expiryDate || '期限なし'}</span>
                    <span>${l.quantity}個</span>
                    <button class="edit-expiry-btn" onclick="event.stopPropagation();editLotExpiry('${l.expiryDate || ''}', ${l.quantity})">📅</button>
                </div>`).join('');

    state.selectedLot = null;
    el.lotList.querySelectorAll('.lot-item').forEach(li => li.onclick = () => {
        const lot = lots[+li.dataset.idx];

        if (isIn) {
            // 入庫時は期限をコピー
            if (lot.expiryDate) {
                el.txExpiry.value = lot.expiryDate;
                // フィードバック（一瞬背景色を変えるなど）
                li.style.backgroundColor = '#dbeafe'; // 薄い青
                setTimeout(() => li.style.backgroundColor = '', 200);
            }
        } else {
            // 出庫時は選択状態にする
            el.lotList.querySelectorAll('.lot-item').forEach(x => x.classList.remove('selected'));
            li.classList.add('selected');
            state.selectedLot = lot;
        }
    });
}

function editLotExpiry(oldExpiry, qty) {
    state.editingLot = { oldExpiry, qty };
    el.currentExpiryDisplay.textContent = oldExpiry || '期限なし';
    el.newExpiryDate.value = oldExpiry || '';
    el.editExpiryModal.classList.add('active');
}

async function saveLotExpiry() {
    const newExpiry = el.newExpiryDate.value;
    // 変更がない、またはキャンセル相当の場合は閉じる
    if (newExpiry === state.editingLot.oldExpiry) {
        el.editExpiryModal.classList.remove('active');
        return;
    }
    if (!newExpiry) {
        if (!confirm('期限を「なし」にしますか？')) return;
    }

    const { oldExpiry, qty } = state.editingLot;

    showLoading(true);
    try {
        await fsUpdateStockExpiry(state.deptId, state.itemId, oldExpiry || '', newExpiry || '');
        state.stocks = await fsGetStocks();
        const lots = getLots(state.deptId, state.itemId);
        renderLotList(lots);
        // alert('使用期限を更新しました'); // 邪魔なので削除またはトースト通知へ
        el.editExpiryModal.classList.remove('active');
    } catch (e) { handleError(e); }
    showLoading(false);
}

async function saveTx() {
    const qty = +el.txQty.value;
    const remarks = el.txRemarks.value.trim();
    const item = ITEMS.find(i => i.id === state.itemId);
    if (isNaN(qty) || qty < 1) { alert('数量を入力してください'); return; }

    const isInbound = (state.txType === 'IN_BUY' || state.txType === 'IN_GET');
    const isOutbound = (state.txType === 'OUT_USE' || state.txType === 'OUT_GIVE');

    let expiry = null;
    if (isInbound && item.hasExpiry) expiry = el.txExpiry.value || null;
    else if (isOutbound && item.hasExpiry) {
        if (!state.selectedLot) { alert('ロットを選択してください'); return; }
        if (state.selectedLot.quantity < qty) { alert('数がたりないよ！'); return; }
        expiry = state.selectedLot.expiryDate;
    }

    const isTransfer = (state.txType === 'OUT_GIVE' || state.txType === 'IN_GET');
    const partnerDeptId = isTransfer ? +$('partner-dept').value : null;

    el.saveBtn.disabled = true;
    showLoading(true);
    try {
        // 日付が今日なら現在時刻を使用
        let txDate = el.txDate.value || new Date().toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (txDate === today) {
            txDate = new Date().toISOString();
        }

        if (isTransfer) {
            // 署所間移動の場合
            const partnerDeptName = DEPARTMENTS.find(d => d.id === partnerDeptId)?.name;
            const myDeptName = DEPARTMENTS.find(d => d.id === state.deptId)?.name;
            const finalRemarks = remarks || (state.txType === 'OUT_GIVE' ? `${partnerDeptName}にあげた` : `${partnerDeptName}からもらった`);

            if (state.txType === 'OUT_GIVE') {
                // 自分から出庫
                await fsStockOut(state.deptId, state.itemId, expiry, qty, finalRemarks, txDate);
                // 相手へ入庫
                await fsStockIn(partnerDeptId, state.itemId, expiry, qty, remarks || `${myDeptName}からもらった`, txDate);
                alert(`${partnerDeptName}の在庫にも自動で反映されています！\n（${partnerDeptName}の人は何も入力しなくて大丈夫です）`);
            } else if (state.txType === 'IN_GET') {
                // 相手から出庫
                await fsStockOut(partnerDeptId, state.itemId, expiry, qty, remarks || `${myDeptName}にあげた`, txDate);
                // 自分へ入庫
                await fsStockIn(state.deptId, state.itemId, expiry, qty, finalRemarks, txDate);
                alert(`${partnerDeptName}の在庫にも自動で反映されています！\n（${partnerDeptName}の人は何も入力しなくて大丈夫です）`);
            }
        } else {
            // 通常の入出庫
            const finalRemarks = remarks || (state.txType === 'IN_BUY' ? '購入した' : '使った（廃棄した）');
            if (isInbound) {
                await fsStockIn(state.deptId, state.itemId, expiry, qty, finalRemarks, txDate);
                // 購入時で単価が入力されていれば保存
                if (state.txType === 'IN_BUY') {
                    const unitPriceParams = document.getElementById('transaction-unit-price').value;
                    if (unitPriceParams !== '') {
                        const newPrice = +unitPriceParams;
                        await fsUpdateItemUnitPrice(state.itemId, newPrice);
                        // メモリ上のITEMSも更新
                        const idx = ITEMS.findIndex(i => i.id === state.itemId);
                        if (idx !== -1) ITEMS[idx].unitPrice = newPrice;
                    }
                }
            } else {
                await fsStockOut(state.deptId, state.itemId, expiry, qty, finalRemarks, txDate);
            }
        }

        state.stocks = await fsGetStocks();
        renderAnalytics(); // 全体画面更新
        closeModal('transaction');
        showItemsModal();
    } catch (e) { handleError(e); }
    el.saveBtn.disabled = false;
    showLoading(false);
}

async function renderAnalytics() {
    showLoading(true);
    // ヘッダーのタイトルを更新
    const analyticsTitle = document.querySelector('#analytics .department-name');
    if (state.deptId) {
        const dept = DEPARTMENTS.find(d => d.id === state.deptId);
        analyticsTitle.textContent = `${dept?.name || ''} 統計・分析`;
    } else {
        analyticsTitle.textContent = '全体統計・分析';
    }
    try {
        state.transactions = await fsGetTransactions(10000); // 全件取得（集計の正確性のため）
        renderSummary();
        initCombined();
        renderCombined();
    } catch (e) { handleError(e); }
    showLoading(false);
}

function renderSummary() {
    // 特定部署の場合：カテゴリ別在庫を表示
    if (state.deptId) {
        renderSummaryByCategory(state.deptId);
    } else {
        // 全体表示：在庫マトリックス表示
        renderInventoryMatrix();
    }
}

// ------------------------------------------------------------------
// 在庫マトリックス表示
// ------------------------------------------------------------------
function renderInventoryMatrix() {
    const container = el.summaryList;

    // CSVダウンロードボタン
    let html = `
                <div class="matrix-controls">
                    <button class="export-btn" style="width: auto; padding: 8px 16px;" onclick="exportMatrixCSV()">
                        <span class="material-symbols-outlined">download</span>CSVエクスポート
                    </button>
                </div>
                <div class="matrix-accordion">
            `;

    CATEGORIES.forEach(cat => {
        // このカテゴリに属する用品があるか確認
        const catItems = ITEMS.filter(i => i.categoryId === cat.id);
        if (catItems.length === 0) return;

        html += `
                    <div class="matrix-accordion-item" id="accordion-${cat.id}">
                        <div class="matrix-accordion-header" onclick="toggleMatrixAccordion(${cat.id})">
                            <div class="matrix-accordion-title">
                                <span class="matrix-category-icon material-symbols-outlined" style="color: ${ICON_COLORS[cat.icon] || ''}">${cat.icon}</span>
                                <span>${cat.name}</span>
                            </div>
                            <span class="material-symbols-outlined accordion-toggle-icon">expand_more</span>
                        </div>
                        <div class="matrix-accordion-content">
                            ${renderMatrixTable(catItems)}
                        </div>
                    </div>
                `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function renderMatrixTable(items) {
    // 署所リスト: 各署所(ID順) -> 署所計 -> 警防課
    // 警防課IDは1、その他は2〜10
    const keibouka = DEPARTMENTS.find(d => d.id === 1);
    const otherDepts = DEPARTMENTS.filter(d => d.id !== 1).sort((a, b) => a.id - b.id);

    let html = `
                <div class="matrix-table-wrapper">
                    <table class="inventory-matrix-table">
                        <thead>
                            <tr>
                                <th>用品名</th>
                                ${otherDepts.map(d => `<th>${d.name}</th>`).join('')}
                                <th class="total-col-header">署所計</th>
                                <th class="keibouka-col-header">警防課</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

    items.forEach(item => {
        const lots = getLots(null, item.id);
        // 期限ロット情報の収集
        const lotsByExp = {};
        // 有効な期限を持つロットを抽出
        lots.forEach(l => {
            // データによっては expiryDate だったり expirationDate だったりする
            const expDate = l.expiryDate || l.expirationDate;
            if (expDate && expDate !== '9999-12-31' && expDate.trim() !== '') {
                if (!lotsByExp[expDate]) lotsByExp[expDate] = [];
                lotsByExp[expDate].push(l);
            }
        });
        const hasExpiry = Object.keys(lotsByExp).length > 0;

        // 全体行の計算
        // 各署所の在庫とロット内訳
        const deptQtys = {};
        const deptLotDetails = {}; // 署所ごとのロット詳細 HTML

        let subTotal = 0; // 警防課以外の合計
        otherDepts.forEach(d => {
            const deptLots = lots.filter(l => l.departmentId === d.id && l.quantity > 0);
            const q = deptLots.reduce((a, b) => a + b.quantity, 0);
            deptQtys[d.id] = q;
            subTotal += q;

            // ロット内訳生成
            if (q > 0 && hasExpiry) {
                // 期限順にソート
                deptLots.sort((a, b) => {
                    const dateA = a.expiryDate || a.expirationDate || '9999';
                    const dateB = b.expiryDate || b.expirationDate || '9999';
                    return dateA.localeCompare(dateB);
                });

                let detailsHtml = '<div class="lot-breakdown">';
                deptLots.forEach(l => {
                    const expDate = l.expiryDate || l.expirationDate;
                    if (expDate && expDate !== '9999-12-31') {
                        // 日付を短縮 (YYYY-MM-DD -> YY/MM/DD)
                        const shortDate = expDate.substring(2).replace(/-/g, '/');
                        // 期限切れチェック
                        const isExp = getExpStatus(expDate) === 'expired';
                        detailsHtml += `<span class="lot-item-matrix ${isExp ? 'expired-lot' : ''}">${shortDate}: ${l.quantity}</span>`;
                    }
                });
                detailsHtml += '</div>';
                // 内訳がある場合のみセット
                if (deptLots.some(l => {
                    const d = l.expiryDate || l.expirationDate;
                    return d && d !== '9999-12-31';
                })) {
                    deptLotDetails[d.id] = detailsHtml;
                }
            }
        });

        // 警防課の在庫とロット内訳
        let keiboukaQty = 0;
        let keiboukaDetailsHtml = '';
        if (keibouka) {
            const kLots = lots.filter(l => l.departmentId === keibouka.id && l.quantity > 0);
            keiboukaQty = kLots.reduce((a, b) => a + b.quantity, 0);

            if (keiboukaQty > 0 && hasExpiry) {
                kLots.sort((a, b) => {
                    const dateA = a.expiryDate || a.expirationDate || '9999';
                    const dateB = b.expiryDate || b.expirationDate || '9999';
                    return dateA.localeCompare(dateB);
                });

                keiboukaDetailsHtml = '<div class="lot-breakdown">';
                kLots.forEach(l => {
                    const expDate = l.expiryDate || l.expirationDate;
                    if (expDate && expDate !== '9999-12-31') {
                        const shortDate = expDate.substring(2).replace(/-/g, '/');
                        const isExp = getExpStatus(expDate) === 'expired';
                        keiboukaDetailsHtml += `<span class="lot-item-matrix ${isExp ? 'expired-lot' : ''}">${shortDate}: ${l.quantity}</span>`;
                    }
                });
                keiboukaDetailsHtml += '</div>';
                // 有効な期限表示がなければ空にする
                if (!kLots.some(l => {
                    const d = l.expiryDate || l.expirationDate;
                    return d && d !== '9999-12-31';
                })) {
                    keiboukaDetailsHtml = '';
                }
            }
        }

        // メイン行描画
        html += `<tr class="matrix-item-row">
                    <td class="item-name-cell">
                        <div class="item-name">${item.name}</div>
                        <div class="item-unit">${item.unit}</div>
                    </td>`;

        // 各署所列
        otherDepts.forEach(d => {
            const q = deptQtys[d.id];
            const details = deptLotDetails[d.id] || '';
            html += `<td>
                        ${q > 0 ? `<div class="cell-qty">${q}</div>` : '-'}
                        ${details}
                    </td>`;
        });

        // 署所計
        html += `<td class="total-col">${subTotal > 0 ? `<div class="cell-qty">${subTotal}</div>` : '-'}</td>`;

        // 警防課
        html += `<td class="keibouka-col">
                    ${keiboukaQty > 0 ? `<div class="cell-qty">${keiboukaQty}</div>` : '-'}
                    ${keiboukaDetailsHtml}
                </td>`;
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

function toggleMatrixAccordion(catId) {
    const item = document.getElementById(`accordion-${catId}`);
    if (item) {
        item.classList.toggle('open');
    }
}

function exportMatrixCSV() {
    // CSV生成ロジック
    // ヘッダー: 用品ID, カテゴリ, 用品名, 単位, 三次...東城, 署所計, 警防課
    const keibouka = DEPARTMENTS.find(d => d.id === 1);
    const otherDepts = DEPARTMENTS.filter(d => d.id !== 1).sort((a, b) => a.id - b.id);

    let csv = '\uFEFF'; // BOM

    // ヘッダー行
    const header = ['カテゴリ', '用品名', '単位', ...otherDepts.map(d => d.name), '署所計', '警防課'];
    csv += header.join(',') + '\n';

    // データ行
    ITEMS.forEach(item => {
        const cat = CATEGORIES.find(c => c.id === item.categoryId);
        const lots = getLots(null, item.id);

        const row = [
            cat ? cat.name : '',
            item.name,
            item.unit
        ];

        let subTotal = 0;
        // 各署所
        otherDepts.forEach(d => {
            const qty = lots.filter(l => l.departmentId === d.id).reduce((a, l) => a + l.quantity, 0);
            row.push(qty === 0 ? '' : qty);
            subTotal += qty;
        });

        // 署所計
        row.push(subTotal === 0 ? '' : subTotal);

        // 警防課
        const keiboukaQty = keibouka ? lots.filter(l => l.departmentId === keibouka.id).reduce((a, l) => a + l.quantity, 0) : 0;
        row.push(keiboukaQty === 0 ? '' : keiboukaQty);

        csv += row.join(',') + '\n';
    });

    // ダウンロード
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `救急用在庫管理表_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
}




// ============================================
// Settings & Reminder Logic
// ============================================
async function fsGetSettings() {
    try {
        const { data, error } = await db.from('system_settings').select('*').eq('key', 'reminder_config').single();
        if (error && error.code !== 'PGRST116') throw error;
        return data ? data.value : null;
    } catch (e) {
        console.warn('Settings read error:', e);
        return null;
    }
}

async function fsUpdateSettings(config) {
    const { error } = await db.from('system_settings').upsert({ key: 'reminder_config', value: config });
    if (error) throw error;
}



// トランザクション削除ハンドラ
async function deleteTransaction(txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) { alert('該当する履歴が見つかりません'); return; }

    const item = ITEMS.find(i => i.id === tx.itemId);
    const dept = DEPARTMENTS.find(d => d.id === tx.departmentId);
    const isOut = tx.type === 'OUT' || tx.type.startsWith('OUT_');

    const typeLabels = {
        'IN_BUY': '購入', 'IN_GET': '受取', 'IN_RETURN': '返戻',
        'OUT_USE': '使用・廃棄', 'OUT_GIVE': '譲渡', 'OUT_ADJUST': '調整', 'IN': '入庫', 'OUT': '出庫'
    };
    const typeLabel = typeLabels[tx.type] || tx.type;
    const d = new Date(tx.timestamp);
    const dateStr = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;

    const msg = `この入力を取り消しますか？\n\n` +
        `種別: ${typeLabel}\n` +
        `用品: ${item?.name || '不明'}\n` +
        `数量: ${isOut ? '-' : '+'}${tx.quantity}\n` +
        `署所: ${dept?.name || '不明'}\n` +
        `日付: ${dateStr}\n\n` +
        `※在庫数も自動で修正されます`;

    if (!confirm(msg)) return;

    showLoading(true);
    try {
        await fsDeleteTransaction(txId);

        // ローカルのstate更新
        state.transactions = state.transactions.filter(t => t.id !== txId);
        state.stocks = await fsGetStocks();

        // キャッシュ更新
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            categories: CATEGORIES, items: ITEMS,
            stocks: state.stocks, transactions: state.transactions,
            timestamp: Date.now()
        }));

        // 画面再描画
        renderCombined();
        renderSummary();

        // トーストの代わりにアラート
        alert('入力を取り消しました。在庫数も修正済みです。');
    } catch (e) {
        handleError(e);
    }
    showLoading(false);
}

// グローバルスコープに関数追加（onclick属性のため）
window.toggleMatrixAccordion = toggleMatrixAccordion;
window.exportMatrixCSV = exportMatrixCSV;
window.deleteTransaction = deleteTransaction;
window.openAddCategoryModal = openAddCategoryModal; // 既存のグローバル関数も念のため再宣言

// 署所別×カテゴリ別の在庫一覧を表示（削除予定だったが既存ロジック互換のため一応残すが使用しない）
function unused_renderSummaryByDepartment() { return; }

// 特定部署のカテゴリ別在庫を表示
function renderSummaryByCategory(deptId) {
    const catData = {};
    CATEGORIES.forEach(c => { catData[c.id] = { category: c, items: [] }; });

    ITEMS.forEach(item => {
        if (!catData[item.categoryId]) return;

        const itemStocks = state.stocks.filter(s => s.departmentId === deptId && s.itemId === item.id && s.quantity > 0);
        const totalQty = itemStocks.reduce((sum, s) => sum + s.quantity, 0);

        const itemData = {
            item: item,
            qty: totalQty,
            lowStock: item.minStock && totalQty < item.minStock,
            lots: itemStocks
        };
        catData[item.categoryId].items.push(itemData);
    });

    const catsWithItems = Object.values(catData).filter(c => c.items.length > 0);

    if (catsWithItems.length === 0) {
        el.summaryList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>用品が登録されていません</p></div>';
        return;
    }

    let html = '<div class="matrix-accordion">';

    catsWithItems.forEach(c => {
        const catColor = ICON_COLORS[c.category.icon] || '#607D8B';

        const itemsHtml = c.items.map(s => {
            const lowClass = s.lowStock ? 'low-stock' : '';
            const minLabel = s.item.minStock ? `<span class="min-stock-label">最低:${s.item.minStock}</span>` : '';

            let lotInfoHtml = '';
            if (s.item.hasExpiry && s.lots.length > 0) {
                const sortedLots = [...s.lots].sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
                lotInfoHtml = `<div class="lot-tags">` +
                    sortedLots.map(l => {
                        const isExp = getExpStatus(l.expiryDate) === 'expired';
                        return `<span class="lot-tag ${isExp ? 'expired' : ''}">${l.expiryDate || '期限なし'}: ${l.quantity}</span>`;
                    }).join('') + `</div>`;
            }

            return `<div class="summary-item ${lowClass}">
                        <div class="summary-item-header">
                            <div>
                                <span class="summary-item-name">${s.item.name} ${minLabel}</span>
                                ${lotInfoHtml}
                            </div>
                            <span class="summary-item-total">${s.qty}${s.item.unit}</span>
                        </div>
                    </div>`;
        }).join('');

        html += `
                    <div class="matrix-accordion-item" id="dept-accordion-${c.category.id}" style="border-left: 4px solid ${catColor};">
                        <div class="matrix-accordion-header" onclick="document.getElementById('dept-accordion-${c.category.id}').classList.toggle('open')">
                            <div class="matrix-accordion-title">
                                <span class="matrix-category-icon material-symbols-outlined" style="color:${catColor}">${c.category.icon}</span>
                                <span style="font-weight: 600;">${c.category.name}</span>
                            </div>
                            <span class="material-symbols-outlined accordion-toggle-icon">expand_more</span>
                        </div>
                        <div class="matrix-accordion-content">
                            <div style="padding: 16px; display: flex; flex-direction: column; gap: 8px;">
                                ${itemsHtml}
                            </div>
                        </div>
                    </div>
                `;
    });

    html += '</div>';
    el.summaryList.innerHTML = html;
}

function initCombined() {
    const yrs = new Set();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentNendo = currentMonth <= 3 ? currentYear - 1 : currentYear;

    state.transactions.forEach(t => {
        const year = new Date(t.timestamp).getFullYear();
        // 過去の年、かつ現在の年度以下の年を対象にする
        if (!isNaN(year) && year > 2000) {
            const m = new Date(t.timestamp).getMonth() + 1;
            const nendo = m <= 3 ? year - 1 : year;
            if (nendo <= currentNendo) {
                yrs.add(nendo);
            }
        }
    });
    yrs.add(currentNendo);

    if (el.budgetYear) el.budgetYear.innerHTML = [...yrs].sort((a, b) => b - a).map(y => `<option value="${y}">${y}年度</option>`).join('');
    if (el.budgetMonth) el.budgetMonth.innerHTML = '<option value="all">通期</option>' + [...Array(12)].map((_, i) => {
        const m = i < 9 ? i + 4 : i - 8; // 4月から始まる配列
        return `<option value="${m}">${m}月</option>`;
    }).join('');
}

function renderCombined() {
    const periodType = el.periodType ? el.periodType.value : 'all';
    const yr = el.budgetYear ? +el.budgetYear.value : new Date().getFullYear();
    const mo = el.budgetMonth ? el.budgetMonth.value : 'all';

    // チェックされているトランザクション種別を取得（ラジオボタンなので1つ）
    const checkedTypes = Array.from(document.querySelectorAll('.tx-type-filter:checked')).map(cb => cb.value);

    // ベースとなるフィルタリング（旧バージョンの IN/OUT タグも考慮）
    let flt = state.transactions.filter(t => {
        if (checkedTypes.includes(t.type)) return true;
        if (t.type === 'OUT' && checkedTypes.includes('OUT_USE')) return true;
        // 古い IN データは購入・もらったとして扱う
        if (t.type === 'IN' && (checkedTypes.includes('IN_BUY') || checkedTypes.includes('IN_GET'))) return true;
        return false;
    });

    // 期間フィルタリング
    if (periodType === 'year_month') {
        flt = flt.filter(t => {
            const date = new Date(t.timestamp);
            const tYear = date.getFullYear();
            const tMonth = date.getMonth() + 1;
            // 年度判定 (4月〜翌3月)
            const nendo = (tMonth <= 3) ? tYear - 1 : tYear;

            if (nendo !== yr) return false;
            if (mo !== 'all' && tMonth !== +mo) return false;
            return true;
        });
    }

    // 部署フィルタ
    if (state.deptId) {
        flt = flt.filter(t => t.departmentId === state.deptId || t.targetDepartmentId === state.deptId);
    }

    // ----------------------------------------------------
    // リスト（明細）表示のレンダリング（入力履歴タブ）
    // 入力履歴タブは専用のフィルタで制御（実績タブのフィルタとは独立）
    // ----------------------------------------------------
    const historyFilter = document.querySelector('.history-type-filter:checked');
    const historyFilterValue = historyFilter ? historyFilter.value : 'all';

    // 入力履歴用のフィルタ: 部署フィルタのみ適用（実績の種別フィルタは使わない）
    let historyFlt = state.transactions;
    if (state.deptId) {
        historyFlt = historyFlt.filter(t => t.departmentId === state.deptId || t.targetDepartmentId === state.deptId);
    }
    // 入庫/出庫フィルタ
    if (historyFilterValue === 'in') {
        historyFlt = historyFlt.filter(t => t.type === 'IN' || t.type === 'IN_BUY' || t.type === 'IN_GET' || t.type === 'IN_RETURN');
    } else if (historyFilterValue === 'out') {
        historyFlt = historyFlt.filter(t => t.type === 'OUT' || t.type.startsWith('OUT_'));
    }

    if (historyFlt.length === 0) {
        el.logList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p>該当する履歴がありません</p></div>';
    } else {
        el.logList.innerHTML = historyFlt.map(t => {
            const item = ITEMS.find(i => i.id === t.itemId);
            const dept = DEPARTMENTS.find(d => d.id === t.departmentId);
            if (!item || !dept) return '';

            const isOut = t.type.startsWith('OUT');
            const isTransfer = t.type === 'OUT_GIVE' || t.type === 'IN_GET';

            const typeLabels = {
                'IN_BUY': '購入', 'IN_GET': '受取', 'IN_RETURN': '返戻',
                'OUT_USE': '使・廃', 'OUT_GIVE': '譲渡', 'OUT_ADJUST': '調整', 'IN': '入庫', 'OUT': '出庫'
            };
            const typeLabel = typeLabels[t.type] || t.type;

            const d = new Date(t.timestamp);
            const dateStr = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

            return `<div class="log-item">
                        <div class="log-type ${isOut ? 'out' : 'in'}">${typeLabel}</div>
                        <div class="log-details">
                            <div class="log-item-name">${item.name}</div>
                            <div class="log-meta">
                                ${dateStr} • ${dept.name}
                                ${t.remarks ? ` • <span style="color:#666">💬 ${t.remarks}</span>` : ''}
                                ${t.expiryDate && t.expiryDate !== '9999-12-31' ? ` • <span style="color:#e65100">期限: ${t.expiryDate}</span>` : ''}
                            </div>
                        </div>
                        <div class="log-quantity ${isOut ? 'out' : 'in'}" style="color: ${isOut ? 'var(--color-out)' : 'var(--color-in)'}">
                            ${isOut ? '-' : '+'}${t.quantity}${item.unit}
                        </div>
                        <button class="log-delete-btn" onclick="event.stopPropagation();deleteTransaction(${t.id})" title="この入力を取り消す">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>`;
        }).join('');
    }

    // ----------------------------------------------------
    // 集計（サマリー）表示のレンダリング
    // ----------------------------------------------------
    if (state.deptId) {
        // 部署別表示: シンプルなリスト形式
        const mx = {}; const uniqueItems = ITEMS.filter((item, idx, arr) => arr.findIndex(i => i.id === item.id) === idx).sort((a, b) => { const ca = CATEGORIES.findIndex(c => c.id === a.categoryId); const cb = CATEGORIES.findIndex(c => c.id === b.categoryId); if (ca !== cb) return ca - cb; return a.name.localeCompare(b.name, 'ja'); }); uniqueItems.forEach(i => { mx[i.id] = 0; });
        flt.forEach(t => { mx[t.itemId] = (mx[t.itemId] || 0) + (t.type.startsWith('OUT') ? t.quantity : t.quantity); }); // ここはOUT/INに関わらず絶対値を集計（項目ごとに確認したい場合用）
        const used = uniqueItems.filter(i => mx[i.id] > 0);
        if (used.length === 0) {
            el.budgetTable.innerHTML = '<tr><td colspan="2" style="padding:2rem;text-align:center">データなし</td></tr>';
        } else {
            let h = '<thead><tr><th>用品</th><th>集計数</th></tr></thead><tbody>';
            used.forEach(i => { h += `<tr><td>${i.name}</td><td><b>${mx[i.id]}</b></td></tr>`; });
            h += '</tbody>'; el.budgetTable.innerHTML = h;
        }
    } else {
        // 全体表示: 部署別クロス集計
        const mx = {}; const uniqueItems = ITEMS.filter((item, idx, arr) => arr.findIndex(i => i.id === item.id) === idx).sort((a, b) => { const ca = CATEGORIES.findIndex(c => c.id === a.categoryId); const cb = CATEGORIES.findIndex(c => c.id === b.categoryId); if (ca !== cb) return ca - cb; return a.name.localeCompare(b.name, 'ja'); }); DEPARTMENTS.forEach(d => { mx[d.id] = {}; uniqueItems.forEach(i => { mx[d.id][i.id] = 0; }); });
        flt.forEach(t => { if (mx[t.departmentId]) mx[t.departmentId][t.itemId] = (mx[t.departmentId][t.itemId] || 0) + t.quantity; });
        const used = uniqueItems.filter(i => flt.some(t => t.itemId === i.id));
        if (used.length === 0) {
            el.budgetTable.innerHTML = '<tr><td colspan="12" style="padding:2rem;text-align:center">データなし</td></tr>';
        } else {
            // 列のクラスマッピング
            const colClassMap = {
                '三次': { bg: 'bt-col-miyoshi', header: 'bt-col-miyoshi-header', border: 'bt-border-left' },
                '庄原': { bg: 'bt-col-shobara', header: 'bt-col-shobara-header', border: 'bt-border-left' },
                '東城': { bg: 'bt-col-tojo', header: 'bt-col-tojo-header', border: 'bt-border-left bt-border-right' }
            };
            // 警防課列の右側（＝三次の左側）で太い罫線
            const keiboukaIdx = DEPARTMENTS.findIndex(d => d.name === '警防課');

            let h = '<thead><tr><th>用品</th>' + DEPARTMENTS.map((d, idx) => {
                const cc = colClassMap[d.name];
                let cls = cc ? cc.header + ' ' + (cc.border || '') : '';
                // 警防課の左側（用品列の右境界として扱うため、警防課自体に左太罫線）
                if (d.name === '警防課') cls += ' bt-border-left';
                return `<th class="${cls.trim()}">${d.name}</th>`;
            }).join('') + '<th>計</th></tr></thead><tbody>';
            used.forEach(i => {
                h += `<tr><td>${i.name}</td>`;
                let rt = 0;
                DEPARTMENTS.forEach((d, idx) => {
                    const q = mx[d.id][i.id] || 0; rt += q;
                    const cc = colClassMap[d.name];
                    let cls = cc ? cc.bg + ' ' + (cc.border || '') : '';
                    if (d.name === '警防課') cls += ' bt-border-left';
                    h += `<td class="${cls.trim()}">${q || '-'}</td>`;
                });
                h += `<td><b>${rt}</b></td></tr>`;
            });
            h += '</tbody>'; el.budgetTable.innerHTML = h;
        }
    }
}

function exportCSV() {
    const periodType = el.periodType ? el.periodType.value : 'all';
    const yr = el.budgetYear ? el.budgetYear.value : new Date().getFullYear();
    const mo = el.budgetMonth ? el.budgetMonth.value : 'all';

    // チェックされているトランザクション種別を取得
    const checkedTypes = Array.from(document.querySelectorAll('.tx-type-filter:checked')).map(cb => cb.value);

    // 旧データを考慮したフィルタリング
    let flt = state.transactions.filter(t => {
        if (checkedTypes.includes(t.type)) return true;
        if (t.type === 'OUT' && checkedTypes.includes('OUT_USE')) return true;
        if (t.type === 'IN' && (checkedTypes.includes('IN_BUY') || checkedTypes.includes('IN_GET'))) return true;
        return false;
    });

    // 期間フィルタリング
    let periodText = '全期間';
    if (periodType === 'year_month') {
        periodText = `${yr}年度${mo === 'all' ? '通期' : mo + '月'}`;
        flt = flt.filter(t => {
            const date = new Date(t.timestamp);
            const tYear = date.getFullYear();
            const tMonth = date.getMonth() + 1;
            const nendo = (tMonth <= 3) ? tYear - 1 : tYear;

            if (nendo !== +yr) return false;
            if (mo !== 'all' && tMonth !== +mo) return false;
            return true;
        });
    }

    if (state.deptId) {
        flt = flt.filter(t => t.departmentId === state.deptId || t.targetDepartmentId === state.deptId);
        const dept = DEPARTMENTS.find(d => d.id === state.deptId);
        const mx = {}; ITEMS.forEach(i => { mx[i.id] = 0; });
        flt.forEach(t => { mx[t.itemId] = (mx[t.itemId] || 0) + (t.type.startsWith('OUT') ? t.quantity : t.quantity); });
        let csv = '\ufeff用品名,実績数\n';
        ITEMS.forEach(i => { csv += `"${i.name}",${mx[i.id] === 0 ? '' : mx[i.id]}\n`; });
        const b = new Blob([csv], { type: 'text/csv;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = `${dept?.name || '部署'}_実績_${periodText}.csv`; a.click(); URL.revokeObjectURL(u);
    } else {
        const mx = {}; ITEMS.forEach(i => { mx[i.id] = {}; DEPARTMENTS.forEach(d => { mx[i.id][d.id] = 0; }); });
        flt.forEach(t => {
            if (mx[t.itemId] && mx[t.itemId][t.departmentId] !== undefined) {
                mx[t.itemId][t.departmentId] += (t.type.startsWith('OUT') ? t.quantity : t.quantity);
            }
        });
        let csv = '\ufeff用品名,' + DEPARTMENTS.map(d => d.name).join(',') + ',合計\n';
        ITEMS.forEach(i => { const vs = DEPARTMENTS.map(d => mx[i.id][d.id]); const t = vs.reduce((a, b) => a + b, 0); csv += `"${i.name}",${vs.map(v => v === 0 ? '' : v).join(',')},${t === 0 ? '' : t}\n`; });

        const b = new Blob([csv], { type: 'text/csv;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = `EMS実績_${periodText}.csv`; a.click(); URL.revokeObjectURL(u);
    }
}

function switchTab(id) { document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id)); document.querySelectorAll('.tab-content').forEach(c => { const isActive = c.id === 'tab-' + id; c.classList.toggle('active', isActive); c.style.display = isActive ? '' : 'none'; }); }

function renderSettings() {
    if (state.settingsCatId) {
        renderSettingsItems(state.settingsCatId);
    } else {
        renderSettingsCategories();
    }
}

async function renderSettingsCategories() {
    // 1. 通知設定セクション
    let h = `
                <div class="settings-section" style="margin-bottom: 2rem; padding: 1rem; background: var(--color-bg-card); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem;">通知設定</h3>
                    <div class="form-group toggle-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                        <label class="toggle-label" style="margin-bottom: 0;">リマインドメール通知</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="setting-reminder-enabled">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="form-group" id="reminder-schedule-group" style="display:none; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
                        <label style="display: block; margin-bottom: 1rem; font-weight: bold; color: var(--color-text-secondary);">通知タイミング</label>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <span style="font-weight: 500;">期限の30日前</span>
                                    <div style="font-size: 0.8rem; color: var(--color-text-muted);">翌月の交換準備用</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" class="reminder-schedule" value="30">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <span style="font-weight: 500;">期限の10日前</span>
                                    <div style="font-size: 0.8rem; color: var(--color-text-muted);">直前の最終確認用</div>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" class="reminder-schedule" value="10">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>

                        </div>
                    </div>
                    <button class="save-btn" id="save-settings" style="margin-top:1.5rem; width: 100%;">設定を保存</button>
                    <!-- Loading state for settings -->
                    <div id="settings-loading-overlay" style="display:none; position:absolute; inset:0; background:rgba(255,255,255,0.7); align-items:center; justify-content:center;">Reading...</div>
                </div>
            `;

    // 2. カテゴリ一覧セクション (フィルタリング適用)
    const visibleCategories = CATEGORIES.filter(c => {
        // 設定画面でも、自署所で操作可能なもののみ表示すべきか？
        // Systemカテゴリ(共通)は全員編集可能とするか、管理者のみか？
        // 現状: 共通カテゴリ + 自署所カテゴリを表示し、編集可能とする
        if (!c.departmentId) return true;
        return c.departmentId === state.deptId;
    });

    h += '<div class="settings-section"><h3 class="section-title">カテゴリ一覧 <button class="settings-add-btn" onclick="openAddCategoryModal()">＋追加</button></h3><div class="settings-list">';
    if (visibleCategories.length === 0) h += '<p style="color:var(--color-text-muted)">カテゴリがありません</p>';
    else {
        h += visibleCategories.map(c => `
                    <div class="settings-item" onclick="state.settingsCatId=${c.id};renderSettings()" style="${c.type === 'user' ? 'border: 2px solid var(--color-accent-primary); background: #fffaf0;' : ''}">
                        <span class="settings-item-name"><span class="material-symbols-outlined" style="color: ${ICON_COLORS[c.icon] || ''}">${c.icon}</span> ${c.name} ${c.departmentId ? '<small>(自署所用)</small>' : ''}${c.type === 'user' ? '<span style="font-size:0.7rem; color:var(--color-accent-primary); opacity:0.7; margin-left:8px;">お気に入りセット</span>' : ''}</span>
                        <div class="settings-actions">
                            <button class="icon-btn" onclick="event.stopPropagation();editCategory(${c.id})"><span class="material-symbols-outlined">edit</span></button>
                            <button class="delete-btn" onclick="event.stopPropagation();deleteCategory(${c.id})">×</button>
                        </div>
                    </div>`).join('');
    }
    h += '</div></div>';
    el.settingsContainer.innerHTML = h;

    // 3. 設定値の読み込みとバインド
    try {
        // showLoading(true); // Don't block whole UI, just this section ideally, but use fsGetSettings async
        const config = await fsGetSettings() || { enabled: true, schedule_days: [1, 25] };

        const enabledParams = config.enabled;
        const schedule = config.schedule_days || [];

        const enabledInput = document.getElementById('setting-reminder-enabled');
        if (enabledInput) {
            enabledInput.checked = enabledParams;
            document.getElementById('reminder-schedule-group').style.display = enabledParams ? 'block' : 'none';

            enabledInput.onchange = () => {
                document.getElementById('reminder-schedule-group').style.display = enabledInput.checked ? 'block' : 'none';
            };
        }

        document.querySelectorAll('.reminder-schedule').forEach(cb => {
            cb.checked = schedule.includes(parseInt(cb.value));
        });

        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const enabled = document.getElementById('setting-reminder-enabled').checked;
                const schedule = Array.from(document.querySelectorAll('.reminder-schedule:checked')).map(cb => parseInt(cb.value));

                try {
                    showLoading(true);
                    await fsUpdateSettings({ enabled, schedule_days: schedule });
                    alert('設定を保存しました');
                } catch (e) {
                    console.error(e);
                    alert('保存に失敗しました');
                } finally {
                    showLoading(false);
                }
            };
        }

    } catch (e) {
        console.warn('Settings load failed', e);
    }
}

function renderSettingsItems(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) { state.settingsCatId = null; renderSettings(); return; }
    const items = ITEMS.filter(i => i.categoryId === catId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const isFavSet = cat.type === 'user';
    let h = `<div class="settings-section">
                <div style="display:flex;align-items:center;margin-bottom:1rem;">
                    <button class="back-btn" onclick="state.settingsCatId=null;renderSettings()" style="margin-right:1rem;font-size:1.2rem;">←</button>
                    <h3 class="section-title" style="margin:0"><span class="material-symbols-outlined" style="color:${ICON_COLORS[cat.icon] || ''};vertical-align:bottom;">${cat.icon}</span> ${cat.name}</h3>
                </div>
                <div style="margin-bottom:1rem;text-align:right;"><button class="btn-sm" onclick="openAddItemModal(${catId})">＋このカテゴリに用品追加</button></div>
                <div class="settings-list">`;

    if (items.length === 0) h += '<p style="color:var(--color-text-muted)">用品がありません</p>';
    else {
        h += items.map((i, idx) => {
            const sortBtns = isFavSet ? `
                        <button class="btn-sm" style="padding:2px 6px;font-size:0.9rem;" onclick="event.stopPropagation();moveItemSort(${catId},${i.id},-1)" ${idx === 0 ? 'disabled style="opacity:0.3;padding:2px 6px;font-size:0.9rem;"' : ''}>▲</button>
                        <button class="btn-sm" style="padding:2px 6px;font-size:0.9rem;" onclick="event.stopPropagation();moveItemSort(${catId},${i.id},1)" ${idx === items.length - 1 ? 'disabled style="opacity:0.3;padding:2px 6px;font-size:0.9rem;"' : ''}>▼</button>
                    ` : '';
            return `
                    <div class="settings-item" onclick="editItem(${i.id}, ${catId})">
                        <span class="settings-item-name">${i.name}</span>
                        <div class="settings-actions">
                             ${sortBtns}
                             <button class="delete-btn" onclick="event.stopPropagation();deleteItemSetting(${i.id})">×</button>
                             <button class="btn-sm" style="margin-left:8px;" onclick="event.stopPropagation();editItem(${i.id}, ${catId})">移動</button>
                        </div>
                    </div>`;
        }).join('');
    }
    h += '</div></div>';
    el.settingsContainer.innerHTML = h;
}

async function moveItemSort(catId, itemId, direction) {
    // direction: -1 = 上へ, 1 = 下へ
    const items = ITEMS.filter(i => i.categoryId === catId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const idx = items.findIndex(i => i.id === itemId);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const itemA = items[idx];
    const itemB = items[swapIdx];
    const tmpSort = itemA.sortOrder;
    itemA.sortOrder = itemB.sortOrder;
    itemB.sortOrder = tmpSort;

    // ITEMS配列も更新
    ITEMS.forEach(i => {
        if (i.id === itemA.id && i.categoryId === catId) i.sortOrder = itemA.sortOrder;
        if (i.id === itemB.id && i.categoryId === catId) i.sortOrder = itemB.sortOrder;
    });

    // DB更新
    try {
        await fsSwapSortOrder(catId, itemA.id, itemA.sortOrder, itemB.id, itemB.sortOrder);
    } catch (e) {
        console.error('Sort order update failed:', e);
    }

    renderSettings();
}

async function fsSwapSortOrder(catId, itemId1, sortOrder1, itemId2, sortOrder2) {
    await db.from('item_categories').update({ sort_order: sortOrder1 }).eq('category_id', catId).eq('item_id', itemId1);
    await db.from('item_categories').update({ sort_order: sortOrder2 }).eq('category_id', catId).eq('item_id', itemId2);
}

function openAddCategoryModal() {
    state.editingCategoryId = null;
    el.addCategoryModalTitle.textContent = 'カテゴリ追加';
    $('new-category-name').value = '';
    $('new-category-icon').value = ICONS[0];

    // 権限チェック: 警防課(id=1)以外はSystemカテゴリ作成不可
    const isKeibouka = state.deptId === 1;
    const systemRadio = document.querySelector('input[name="cat-type"][value="system"]');
    const userRadio = document.querySelector('input[name="cat-type"][value="user"]');

    if (isKeibouka) {
        systemRadio.disabled = false;
        systemRadio.parentElement.style.opacity = '1';
        systemRadio.checked = true; // Default
    } else {
        systemRadio.disabled = true;
        systemRadio.parentElement.style.opacity = '0.5';
        userRadio.checked = true; // Force User type
    }
    toggleCategoryTypeHelp(); // Update help text visibility

    renderIconGrid();
    openModal('addCategory');
}

function toggleCategoryTypeHelp() {
    const isUser = document.querySelector('input[name="cat-type"][value="user"]').checked;
    const help = document.getElementById('set-help-text');
    if (help) help.style.display = isUser ? 'block' : 'none';
}

function openAddItemModal(catId) {
    state.editingItemId = null;
    el.addItemModalTitle.textContent = '用品追加';
    $('save-new-item').textContent = '追加'; // ボタンキャプションを「追加」に
    populateCatSelect();

    // カテゴリIDが指定されている場合、お気に入りセットかどうか判定
    let isFavSet = false;

    // 設定: カテゴリ選択
    if (catId) {
        $('new-item-category').value = catId;
        const cat = CATEGORIES.find(c => c.id === catId);
        if (cat && cat.type === 'user') {
            isFavSet = true;
        }
    } else {
        // デフォルト: 最初のカテゴリ
        if (CATEGORIES.length > 0) $('new-item-category').value = CATEGORIES[0].id;
    }
    $('new-item-category').disabled = false; // 常に変更可能にする

    if (isFavSet) {
        // お気に入りセット用UI表示
        el.addItemModalTitle.textContent = 'お気に入り登録';
        $('save-new-item').textContent = 'お気に入り登録';
        $('fav-set-add-ui').style.display = 'block';
        $('standard-add-ui').style.display = 'none';

        // ソースカテゴリ（Systemのみ）の生成と初期化
        const sysCats = CATEGORIES.filter(c => c.type === 'system');
        $('fav-set-source-category').innerHTML = sysCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        updateFavSetSourceItems();

        // お気に入りセットの場合、追加先のカテゴリ（親画面のコンテキスト）は変更不可
        $('new-item-category').disabled = true;

    } else {
        // 通常UI表示
        el.addItemModalTitle.textContent = '用品追加';
        $('save-new-item').textContent = '追加';
        $('fav-set-add-ui').style.display = 'none';
        $('standard-add-ui').style.display = 'block';
    }

    // リセット
    $('new-item-name').value = '';
    $('new-item-existing-id').value = '';
    $('new-item-suggestions').innerHTML = '';
    $('new-item-suggestions').style.display = 'none';
    $('new-item-details').style.display = 'block';
    $('existing-item-info').style.display = 'none';
    // $('new-item-helper-text').style.display = 'block'; // Removed

    $('new-item-unit').value = '個';
    $('new-item-has-expiry').checked = false;
    $('new-item-min-stock').value = 0;
    openModal('addItem');
}

function updateFavSetSourceItems() {
    const sourceCatId = +$('fav-set-source-category').value;
    const container = $('fav-set-source-item');
    if (!sourceCatId) { container.innerHTML = ''; return; }

    // その設定カテゴリに属するアイテムを取得
    // 重複排除: 既にアイテムが登録されているかどうかはBackend checkに任せるか、ここで除外するか
    // シンプルに全アイテム表示
    const items = ITEMS.filter(i => i.categoryId === sourceCatId);

    if (items.length === 0) {
        container.innerHTML = '<option value="">(用品なし)</option>';
    } else {
        container.innerHTML = items.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    }
}

function editItem(id, catId) {
    // Find item in the specific category context (though id is unique, we want to know current context)
    const i = ITEMS.find(x => x.id === id && x.categoryId === catId) || ITEMS.find(x => x.id === id); // fallback
    if (!i) return;
    state.editingItemId = id;
    state.editingOldCatId = catId || i.categoryId;

    el.addItemModalTitle.textContent = '用品編集';
    $('save-new-item').textContent = '変更を保存'; // ボタンキャプションを「変更を保存」に
    populateCatSelect();
    $('new-item-category').value = state.editingOldCatId;
    $('new-item-category').disabled = false;
    $('new-item-name').value = i.name;
    $('new-item-unit').value = i.unit;
    $('new-item-has-expiry').checked = i.hasExpiry;
    $('new-item-min-stock').value = i.minStock || 0;
    openModal('addItem');
}

function editCategory(id) {
    const c = CATEGORIES.find(x => x.id === id);
    if (!c) return;
    state.editingCategoryId = id;
    el.addCategoryModalTitle.textContent = 'カテゴリ編集';
    $('new-category-name').value = c.name;
    $('new-category-icon').value = c.icon;
    renderIconGrid();
    openModal('addCategory');
}

function renderIconGrid() {
    el.newCategoryIconGrid.innerHTML = ICONS.map(icon => `<div class="icon-option ${icon === el.newCategoryIconInput.value ? 'selected' : ''}" style="color: ${ICON_COLORS[icon] || ''}"><span class="material-symbols-outlined">${icon}</span></div>`).join('');
    el.newCategoryIconGrid.querySelectorAll('.icon-option').forEach(opt => opt.onclick = () => {
        el.newCategoryIconGrid.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        el.newCategoryIconInput.value = opt.querySelector('span').textContent;
    });
}

// ============================================
// Add Item Search Logic
// ============================================
// ============================================
// Add Item Search Logic
// ============================================
// handleNewItemSearch function restored for warnings

function handleNewItemSearch(e) {
    const query = normalizeForCheck(e.target.value.trim());
    const container = $('new-item-suggestions');
    // const currentCatId = +$('new-item-category').value; // Not needed for global search

    if (query.length < 1) {
        container.style.display = 'none';
        return;
    }

    // ユニークな用品名のみ抽出（名前で重複排除）
    const uniqueItems = [];
    const seenNames = new Set();

    // 全アイテムから検索
    ITEMS.forEach(i => {
        const iName = normalizeForCheck(i.name);
        // 名前が一致し、まだリストに出ていない
        if (iName.includes(query) && !seenNames.has(iName)) {
            seenNames.add(iName);
            uniqueItems.push(i);
        }
    });

    if (uniqueItems.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.innerHTML = uniqueItems.slice(0, 5).map(item => `
                <div class="suggestion-item" onclick="alertExistingItem('${item.name}')" style="background:#fff0f0; border-color:#feb2b2;">
                    <div>
                        <div class="suggestion-item-name" style="color:#c53030;">${item.name}</div>
                        <div class="suggestion-item-category" style="font-size:0.75rem;">単位: ${item.unit}</div>
                    </div>
                    <div style="font-size:0.8rem; color:#c53030; font-weight:bold;">× 登録不可（既存）</div>
                </div>
            `).join('');
    container.style.display = 'block';
}

function alertExistingItem(name) {
    alert(`「${name}」は既に登録されています。\n新規登録する場合は別の名前を入力してください。\n\n※既存の用品をお気に入りセットに追加したい場合は、お気に入りセットのメニューから行ってください。`);
    $('new-item-name').value = ''; // 入力をクリア
    $('new-item-suggestions').style.display = 'none';
}

/*
// selectExistingItem and resetItemSelection are kept commented out as we don't allow linking here anymore.
function selectExistingItem(itemId) { ... }
function resetItemSelection() { ... }
*/

function populateCatSelect() { $('new-item-category').innerHTML = CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join(''); }

async function saveNewCategory() {
    const n = $('new-category-name').value.trim();
    // Radioからタイプを取得
    const typeRadio = document.querySelector('input[name="cat-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'system';

    const ic = $('new-category-icon').value || (type === 'user' ? 'star' : 'inventory_2'); // Default icons

    if (!n) { alert('名称を入力してください'); return; }
    showLoading(true);
    try {
        let c;
        if (state.editingCategoryId) {
            // 編集時はタイプ変更不可
            c = await fsUpdateCategory(state.editingCategoryId, n, ic);
            // レスポンスに departmentId が含まれていない場合があるので補完（変更されないため）
            const old = CATEGORIES.find(x => x.id === state.editingCategoryId);
            c.departmentId = old ? old.departmentId : null;

            const idx = CATEGORIES.findIndex(x => x.id === state.editingCategoryId);
            if (idx >= 0) CATEGORIES[idx] = c;
        } else {
            // 新規作成
            // お気に入りセット(user)なら、現在の署所IDをセットする
            // システムカテゴリなら共通(null)とする
            const deptId = (type === 'user' && state.deptId) ? state.deptId : null;
            c = await fsAddCategory(n, ic, type, deptId);
            CATEGORIES.push(c);
        }
        closeModal('addCategory');
        renderSettings();
        renderCatGrid();
        $('new-category-name').value = '';
    } catch (e) { handleError(e); }
    showLoading(false);
}


function normalizeForCheck(s) {
    if (!s) return '';
    // 1. 全角英数字を半角に
    let ret = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); });
    // 2. スペース削除
    ret = ret.replace(/\s+/g, '');
    // 3. 小文字化
    ret = ret.toLowerCase();
    // 4. カタカナをひらがなに変換
    ret = ret.replace(/[\u30a1-\u30f6]/g, function (match) {
        var chr = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chr);
    });
    return ret;
}

async function saveNewItem() {
    const cid = +$('new-item-category').value;

    // モード判定: お気に入りセット追加UIが表示されているか
    const isFavSetMode = $('fav-set-add-ui').style.display !== 'none';

    if (isFavSetMode) {
        // お気に入りセットへの既存用品追加モード
        const sourceItemId = +$('fav-set-source-item').value;
        if (!sourceItemId) { alert('用品を選択してください'); return; }

        showLoading(true);
        try {
            const item = ITEMS.find(i => i.id === sourceItemId);
            if (!item) throw new Error('Item not found');

            const result = await fsAddItem(cid, item.name, item.unit, item.hasExpiry, item.minStock, sourceItemId);

            const exists = ITEMS.some(i => i.id === result.id && i.categoryId === result.categoryId);
            if (!exists) ITEMS.push(result);

            closeModal('addItem');
            renderSettings();
            if (state.catId === cid) showItemsModal();
        } catch (e) { handleError(e); }
        showLoading(false);
        return;
    }

    // --- 以下、通常モード ---
    const n = $('new-item-name').value.trim();
    const u = $('new-item-unit').value.trim() || '個';
    const he = $('new-item-has-expiry').checked;
    const ms = +$('new-item-min-stock').value || 0;
    // 既存ステータスは使用しない（新規追加のみ）
    // const existingId = +$('new-item-existing-id').value || null; 

    if (!n) { alert('用品名を入力してください'); return; }

    // 類似用品チェック
    const normName = normalizeForCheck(n);
    const similarItems = ITEMS.filter(item => {
        // 自分自身は除外（編集時用だが、今は新規追加ダイアログ）
        if (state.editingItemId && item.id === state.editingItemId) return false;

        const iName = normalizeForCheck(item.name);
        return iName === normName;
    });

    // 重複判定（完全に一致するものだけでなく、正規化して一致するもの）
    if (similarItems.length > 0) {
        // カテゴリ名を取得して表示
        const msgList = similarItems.map(i => {
            const c = CATEGORIES.find(cat => cat.id === i.categoryId);
            const cName = c ? c.name : '不明なカテゴリ';
            return `・${cName}: ${i.name}`;
        }).join('\n');

        const confirmMsg = `類似の用品が見つかりました。\n以下の用品が既に登録されています：\n\n${msgList}\n\n本当に登録しますか？`;
        if (!confirm(confirmMsg)) {
            showLoading(false);
            return;
        }
    }

    showLoading(true);
    try {
        let i;
        if (state.editingItemId) {
            i = await fsUpdateItem(state.editingItemId, state.editingOldCatId, cid, n, u, he, ms);

            ITEMS.forEach(item => {
                if (item.id === state.editingItemId) {
                    item.name = n; item.unit = u; item.hasExpiry = he; item.minStock = ms;
                }
            });

            if (state.editingOldCatId !== cid) {
                const oldIdx = ITEMS.findIndex(x => x.id === state.editingItemId && x.categoryId === state.editingOldCatId);
                if (oldIdx >= 0) ITEMS.splice(oldIdx, 1);

                const exists = ITEMS.some(x => x.id === state.editingItemId && x.categoryId === cid);
                if (!exists) {
                    ITEMS.push({ id: state.editingItemId, categoryId: cid, name: n, unit: u, hasExpiry: he, minStock: ms });
                }
            }

        } else {
            // 常に新規作成として扱う
            i = await fsAddItem(cid, n, u, he, ms, null);

            i.id = +i.id;
            i.categoryId = +i.categoryId;
            i.minStock = +i.minStock;
            i.hasExpiry = !!i.hasExpiry;

            // 重複チェックは上記で行ったので、ここでは単純追加
            // ただしIDが重複しないことは保証される（DB採番）
            ITEMS.push(i);
        }
        closeModal('addItem');
        renderSettings();
        if (state.catId === cid) {
            showItemsModal();
        }
        $('new-item-name').value = '';
    } catch (e) { handleError(e); }
    showLoading(false);
}

async function deleteCategory(id) {
    if (!confirm('カテゴリを削除しますか？')) return;
    showLoading(true);
    try {
        await fsDeleteCategory(id);
        CATEGORIES = CATEGORIES.filter(c => c.id !== id);
        ITEMS = ITEMS.filter(i => i.categoryId !== id);
        renderSettings();
        renderCatGrid();
    } catch (e) {
        if (e.message === 'ITEMS_EXIST' || e.message.includes('foreign key constraint')) {
            alert('カテゴリに用品登録があります。用品をすべて削除した後にカテゴリ削除できます。');
        } else {
            handleError(e);
        }
    }
    showLoading(false);
}

async function deleteItemSetting(id) {
    // 在庫チェック
    const lots = getLots(null, id); // 全署所の在庫合計
    const totalStock = lots.reduce((a, l) => a + l.quantity, 0);

    if (totalStock > 0) {
        if (!confirm(`現在 ${totalStock} 個の在庫があります。\n本当に削除しますか？\n（在庫データもすべて削除されます）`)) return;
    } else {
        if (!confirm('用品を削除しますか？')) return;
    }

    showLoading(true);
    try { await fsDeleteItem(id); ITEMS = ITEMS.filter(i => i.id !== id); renderSettings(); } catch (e) { handleError(e); }
    showLoading(false);
}

function getLots(deptId, itemId) { return state.stocks.filter(s => (deptId === null || s.departmentId === deptId) && s.itemId === itemId && s.quantity > 0); }
function getExpStatus(d) { if (!d) return 'none'; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.ceil((new Date(d) - t) / 864e5) < 0 ? 'expired' : 'ok'; }
function fmtDT(s) {
    if (!s) return '-';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDate(s) {
    if (!s) return '';
    // YYYY-MM-DD形式ならそのまま返す
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function handleError(e) { showLoading(false); console.error(e); alert('エラー: ' + (e.message || e)); }