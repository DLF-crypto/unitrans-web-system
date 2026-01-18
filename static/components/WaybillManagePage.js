const WaybillManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">运单数据管理</h2>
            </div>

            <!-- 搜索区域 -->
            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>客户（通过简称搜索）</label>
                        <input 
                            type="text" 
                            class="form-input" 
                            v-model="searchForm.customer_search"
                            @input="filterCustomers"
                            @focus="showCustomerDropdown = true; filterCustomers()"
                            @dblclick="showAllCustomers"
                            @blur="hideCustomerDropdown"
                            placeholder="双击显示所有客户或输入简称搜索"
                        />
                        <div v-if="showCustomerDropdown && filteredCustomerList.length > 0" 
                             style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div v-for="customer in filteredCustomerList" 
                                 :key="customer.id"
                                 @mousedown="selectCustomer(customer)"
                                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;"
                                 :style="{ background: searchForm.customer_id === customer.id ? '#f0f9ff' : 'white' }"
                                 @mouseenter="$event.target.style.background='#f0f9ff'"
                                 @mouseleave="$event.target.style.background=(searchForm.customer_id === customer.id ? '#f0f9ff' : 'white')">
                                <div style="font-weight: 500;">{{ customer.short_name }}</div>
                                <div style="font-size: 12px; color: #666; margin-top: 2px;">{{ customer.full_name }}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>供应商（通过简称搜索）</label>
                        <input 
                            type="text" 
                            class="form-input" 
                            v-model="searchForm.supplier_search"
                            @input="filterSuppliers"
                            @focus="showSupplierDropdown = true; filterSuppliers()"
                            @dblclick="showAllSuppliers"
                            @blur="hideSupplierDropdown"
                            placeholder="双击显示所有供应商或输入简称搜索"
                        />
                        <div v-if="showSupplierDropdown && filteredSupplierList.length > 0" 
                             style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div v-for="supplier in filteredSupplierList" 
                                 :key="supplier.id"
                                 @mousedown="selectSupplier(supplier)"
                                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;"
                                 :style="{ background: searchForm.supplier_id === supplier.id ? '#f0f9ff' : 'white' }"
                                 @mouseenter="$event.target.style.background='#f0f9ff'"
                                 @mouseleave="$event.target.style.background=(searchForm.supplier_id === supplier.id ? '#f0f9ff' : 'white')">
                                <div style="font-weight: 500;">{{ supplier.short_name }}</div>
                                <div style="font-size: 12px; color: #666; margin-top: 2px;">{{ supplier.full_name }}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 200px;">
                        <label>产品</label>
                        <select class="form-input" v-model="searchForm.product_id">
                            <option value="">全部产品</option>
                            <option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }}</option>
                        </select>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>下单时间起始</label>
                        <input type="date" class="form-input" v-model="searchForm.order_time_start" />
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>下单时间结束</label>
                        <input type="date" class="form-input" v-model="searchForm.order_time_end" />
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" @click="resetSearch">重置</button>
                        <button class="btn btn-primary" @click="searchWaybills">搜索</button>
                    </div>
                </div>
                
                <!-- 新增：多单号搜索区域 -->
                <div style="display: flex; gap: 12px; margin-top: 12px; width: 100%;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 300px; max-width: 400px;">
                        <label>订单号搜索 (双击输入框可展开/收起多行输入)</label>
                        <textarea 
                            class="form-input" 
                            v-model="searchForm.order_nos"
                            :rows="isOrderNosExpanded ? 10 : 1"
                            @dblclick="isOrderNosExpanded = !isOrderNosExpanded"
                            placeholder="输入订单号，多个请换行（支持多达9.9万单查询）"
                            style="resize: vertical; min-height: 38px; font-family: inherit;"
                        ></textarea>
                    </div>
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 300px; max-width: 400px;">
                        <label>转单号搜索 (双击输入框可展开/收起多行输入)</label>
                        <textarea 
                            class="form-input" 
                            v-model="searchForm.transfer_nos"
                            :rows="isTransferNosExpanded ? 10 : 1"
                            @dblclick="isTransferNosExpanded = !isTransferNosExpanded"
                            placeholder="输入转单号，多个请换行（支持多达9.9万单查询）"
                            style="resize: vertical; min-height: 38px; font-family: inherit;"
                        ></textarea>
                    </div>
                </div>
            </div>

            <!-- 功能区 -->
            <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
                <button class="btn btn-primary" @click="openImportModal">导入</button>
                <button class="btn btn-secondary" @click="exportWaybills">导出</button>
                <button class="btn btn-secondary" @click="recalculateFees" :disabled="recalculating">
                    {{ recalculating ? '重算中...' : '费用重算' }}
                </button>
                <button class="btn btn-secondary" disabled>导入其他收费</button>
                <button class="btn btn-secondary" disabled>导入备注</button>
                <button class="btn" @click="deleteSelected" style="background: #e57373; color: white; border: none;" :disabled="!hasSelected">
                    删除
                </button>
            </div>

            <!-- 表格显示区 -->
            <div class="table-scroll-container" style="width: 100%; overflow: auto; background: white; border: 1px solid var(--border-color); border-radius: 10px; max-height: calc(100vh - 360px); position: relative; display: block;">
                <table class="data-table" style="min-width: 1800px; width: 100%; border-collapse: collapse; table-layout: auto;">
                        <thead style="position: sticky; top: 0; z-index: 10; background: #f9fbf9;">
                        <tr>
                            <th rowspan="2" style="width: 50px; vertical-align: middle; border: 1px solid #c5ddd3;">
                                <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
                            </th>
                            <th rowspan="2" style="width: 60px; vertical-align: middle; border: 1px solid #c5ddd3;">序号</th>
                            <th rowspan="2" style="width: 120px; vertical-align: middle; border: 1px solid #c5ddd3;">订单号</th>
                            <th rowspan="2" style="width: 120px; vertical-align: middle; border: 1px solid #c5ddd3;">转单号</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">重量(kg)</th>
                            <th rowspan="2" style="width: 140px; vertical-align: middle; border: 1px solid #c5ddd3;">下单时间</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">产品</th>
                            <th colspan="4" style="font-weight: 600; border: 1px solid #c5ddd3;">客户信息</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">供应商</th>
                            <th colspan="4" style="font-weight: 600; border: 1px solid #c5ddd3;">应收费用</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">供应商成本</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">专线处理费</th>
                            <th rowspan="2" style="width: 100px; vertical-align: middle; border: 1px solid #c5ddd3;">其他费用</th>
                            <th rowspan="2" style="width: 150px; vertical-align: middle; border: 1px solid #c5ddd3;">备注</th>
                        </tr>
                        <tr>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">单号客户</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">头程客户</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">尾程客户</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">差价客户</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">单号收费</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">头程收费</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">尾程收费</th>
                            <th style="width: 90px; border: 1px solid #c5ddd3;">差价收费</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="waybills.length === 0">
                            <td colspan="20" style="text-align: center; color: #999; padding: 40px; border: 1px solid var(--border-color);">暂无数据</td>
                        </tr>
                        <tr v-for="(waybill, index) in waybills" :key="waybill.id">
                            <td style="border: 1px solid #e0e0e0;">
                                <input type="checkbox" v-model="waybill.selected" />
                            </td>
                            <td style="border: 1px solid #e0e0e0;">{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.order_no }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.transfer_no }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.weight.toFixed(3) }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ formatDateTime(waybill.order_time) }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.product_name }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.unit_customer_name }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.first_leg_customer_name }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.last_leg_customer_name }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.differential_customer_name }}</td>
                            <td style="border: 1px solid #e0e0e0;">{{ waybill.supplier_name }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #2196F3; font-weight: 500;">{{ formatFee(waybill.unit_fee) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #2196F3; font-weight: 500;">{{ formatFee(waybill.first_leg_fee) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #2196F3; font-weight: 500;">{{ formatFee(waybill.last_leg_fee) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #2196F3; font-weight: 500;">{{ formatFee(waybill.differential_fee) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #f44336; font-weight: 500;">{{ formatFee(waybill.supplier_cost) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #4CAF50; font-weight: 500;">{{ formatFee(waybill.dedicated_line_fee) }}</td>
                            <td style="border: 1px solid #e0e0e0; color: #2196F3; font-weight: 500;">{{ formatFee(waybill.other_fee) }}</td>
                            <td style="max-width: 200px; white-space: normal; overflow: hidden; text-overflow: ellipsis; text-align: left; border: 1px solid #e0e0e0;" :title="waybill.remark">{{ waybill.remark }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页控件 -->
            <div class="pagination-container" v-if="pagination.total > 0">
                <div class="pagination-info">
                    共 {{ pagination.total }} 条记录，每页
                    <select v-model="pagination.perPage" @change="handlePageSizeChange" class="page-size-select">
                        <option :value="200">200</option>
                        <option :value="500">500</option>
                        <option :value="1000">1000</option>
                    </select>
                    条
                </div>
                <div class="pagination-buttons">
                    <button class="btn-page" :disabled="pagination.currentPage === 1" @click="changePage(1)">首页</button>
                    <button class="btn-page" :disabled="pagination.currentPage === 1" @click="changePage(pagination.currentPage - 1)">上一页</button>
                    <span class="page-current">{{ pagination.currentPage }} / {{ pagination.pages }}</span>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.pages" @click="changePage(pagination.currentPage + 1)">下一页</button>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.pages" @click="changePage(pagination.pages)">末页</button>
                </div>
            </div>

            <!-- 导入弹窗 -->
            <div v-if="showImportModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">导入运单数据</h3>
                        <button class="modal-close" @click="closeImportModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <label class="form-field" style="display: block; margin-bottom: 12px;">
                                <span style="font-size: 13px; color: var(--text-sub); margin-bottom: 8px; display: block;">选择Excel文件：</span>
                                <input 
                                    type="file" 
                                    ref="fileInput"
                                    @change="handleFileSelect" 
                                    accept=".xlsx,.xls"
                                    style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 8px;"
                                />
                            </label>
                            <div v-if="selectedFile" style="font-size: 13px; color: var(--text-sub); margin-top: 8px;">
                                已选择：{{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})
                            </div>
                        </div>

                        <div style="margin-bottom: 20px; padding: 16px; background: var(--primary-soft); border-radius: 8px;">
                            <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--text-main); font-weight: 500;">注意事项：</p>
                            <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: var(--text-sub); line-height: 1.8;">
                                <li>请下载并使用模板文件，保持表头格式不变</li>
                                <li>订单号和转单号必须唯一</li>
                                <li>下单时间格式：2026-1-5 12:15:00</li>
                                <li>客户和供应商填写简称</li>
                                <li>最大支持20万条数据</li>
                                <li>如果任意一条数据错误，整个导入将失败</li>
                            </ul>
                        </div>

                        <div v-if="importErrors && importErrors.length > 0" style="max-height: 300px; overflow-y: auto; margin-bottom: 16px;">
                            <div style="padding: 12px; background: #fff3f3; border-left: 3px solid #e57373; border-radius: 4px;">
                                <p style="margin: 0 0 8px 0; font-size: 13px; color: #c62828; font-weight: 500;">发现 {{ importErrors.length }} 行数据错误：</p>
                                <div v-for="error in importErrors.slice(0, 10)" :key="error.row" style="margin-bottom: 8px; font-size: 12px;">
                                    <div style="color: #d32f2f; font-weight: 500;">第 {{ error.row }} 行：</div>
                                    <ul style="margin: 4px 0 0 20px; padding: 0; color: #666;">
                                        <li v-for="(err, idx) in error.errors" :key="idx">{{ err }}</li>
                                    </ul>
                                </div>
                                <div v-if="importErrors.length > 10" style="font-size: 12px; color: #999; margin-top: 8px;">
                                    ...还有 {{ importErrors.length - 10 }} 行错误
                                </div>
                            </div>
                        </div>

                        <div v-if="importing" style="text-align: center; padding: 20px;">
                            <div style="font-size: 14px; color: var(--primary);">正在导入中，请稍候...</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="downloadTemplate" :disabled="importing">下载模板</button>
                        <button class="btn btn-secondary" @click="closeImportModal" :disabled="importing">取消</button>
                        <button class="btn btn-primary" @click="submitImport" :disabled="!selectedFile || importing">
                            {{ importing ? '导入中...' : '开始导入' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            waybills: [],
            customers: [],
            suppliers: [],
            products: [],
            searchForm: {
                customer_id: "",
                customer_search: "",
                supplier_id: "",
                supplier_search: "",
                product_id: "",
                order_time_start: "",
                order_time_end: "",
                order_nos: "",
                transfer_nos: ""
            },
            isOrderNosExpanded: false,
            isTransferNosExpanded: false,
            showCustomerDropdown: false,
            filteredCustomerList: [],
            showSupplierDropdown: false,
            filteredSupplierList: [],
            selectAll: false,
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 200
            },
            showImportModal: false,
            selectedFile: null,
            importing: false,
            importErrors: null,
            recalculating: false
        };
    },
    mounted() {
        this.loadCustomers();
        this.loadSuppliers();
        this.loadProducts();
        this.loadWaybills();
    },
    computed: {
        hasSelected() {
            return this.waybills.some(w => w.selected);
        }
    },
    methods: {
        async loadCustomers() {
            try {
                const res = await fetch("/api/customers");
                const data = await res.json();
                if (data.success) this.customers = data.customers;
            } catch (e) {
                console.error("加载客户列表失败", e);
            }
        },
        async loadSuppliers() {
            try {
                const res = await fetch("/api/suppliers");
                const data = await res.json();
                if (data.success) this.suppliers = data.suppliers;
            } catch (e) {
                console.error("加载供应商列表失败", e);
            }
        },
        async loadProducts() {
            try {
                const res = await fetch("/api/products");
                const data = await res.json();
                if (data.success) this.products = data.products;
            } catch (e) {
                console.error("加载产品列表失败", e);
            }
        },
        async loadWaybills() {
            try {
                // 使用 POST 请求以支持大量单号查询
                const res = await fetch("/api/waybills", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...this.searchForm,
                        page: this.pagination.currentPage,
                        page_size: this.pagination.perPage
                    })
                });
                const data = await res.json();
                if (data.success) {
                    this.waybills = data.waybills.map(w => ({ ...w, selected: false }));
                    this.pagination.total = data.total;
                    this.pagination.pages = data.total_pages;
                    this.selectAll = false;
                }
            } catch (e) {
                console.error("加载运单列表失败", e);
            }
        },
        searchWaybills() {
            this.pagination.currentPage = 1;
            this.loadWaybills();
        },
        resetSearch() {
            this.searchForm = {
                customer_id: "",
                customer_search: "",
                supplier_id: "",
                supplier_search: "",
                product_id: "",
                order_time_start: "",
                order_time_end: "",
                order_nos: "",
                transfer_nos: ""
            };
            this.isOrderNosExpanded = false;
            this.isTransferNosExpanded = false;
            this.pagination.currentPage = 1;
            this.loadWaybills();
        },
        filterCustomers() {
            const search = this.searchForm.customer_search.toLowerCase();
            if (search) {
                this.filteredCustomerList = this.customers.filter(c => 
                    c.short_name.toLowerCase().includes(search) || 
                    c.full_name.toLowerCase().includes(search)
                );
            } else {
                this.filteredCustomerList = this.customers;
            }
            this.showCustomerDropdown = true;
        },
        showAllCustomers() {
            this.filteredCustomerList = this.customers;
            this.showCustomerDropdown = true;
        },
        selectCustomer(customer) {
            this.searchForm.customer_id = customer.id;
            this.searchForm.customer_search = customer.short_name;
            this.showCustomerDropdown = false;
        },
        hideCustomerDropdown() {
            setTimeout(() => {
                this.showCustomerDropdown = false;
            }, 200);
        },
        filterSuppliers() {
            const search = this.searchForm.supplier_search.toLowerCase();
            if (search) {
                this.filteredSupplierList = this.suppliers.filter(s => 
                    s.short_name.toLowerCase().includes(search) || 
                    s.full_name.toLowerCase().includes(search)
                );
            } else {
                this.filteredSupplierList = this.suppliers;
            }
            this.showSupplierDropdown = true;
        },
        showAllSuppliers() {
            this.filteredSupplierList = this.suppliers;
            this.showSupplierDropdown = true;
        },
        selectSupplier(supplier) {
            this.searchForm.supplier_id = supplier.id;
            this.searchForm.supplier_search = supplier.short_name;
            this.showSupplierDropdown = false;
        },
        hideSupplierDropdown() {
            setTimeout(() => {
                this.showSupplierDropdown = false;
            }, 200);
        },
        formatDateTime(dateStr) {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            return d.toLocaleString("zh-CN", { 
                year: "numeric", 
                month: "2-digit", 
                day: "2-digit", 
                hour: "2-digit", 
                minute: "2-digit" 
            });
        },
        formatFee(fee) {
            // 如果费用为0，返回空字符串（不显示）
            if (!fee || parseFloat(fee) === 0) {
                return '';
            }
            return parseFloat(fee).toFixed(2);
        },
        toggleSelectAll() {
            this.waybills.forEach(w => {
                w.selected = this.selectAll;
            });
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadWaybills();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadWaybills();
        },
        async exportWaybills() {
            try {
                // 使用 POST 请求以支持大量单号导出
                const res = await fetch("/api/waybills/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.searchForm)
                });
                
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    
                    // 格式化文件名：YY/MM/DD HH:MM:SS 运单数据表格
                    // 注意：文件名不能包含 / 和 :，所以转换为安全格式
                    const now = new Date();
                    const pad = (num) => String(num).padStart(2, '0');
                    const yy = String(now.getFullYear()).slice(-2);
                    const mm = pad(now.getMonth() + 1);
                    const dd = pad(now.getDate());
                    const hh = pad(now.getHours());
                    const min = pad(now.getMinutes());
                    const ss = pad(now.getSeconds());
                    
                    // 使用 - 和 . 代替非法字符，以便在 Windows 下正常保存
                    const fileName = `${yy}-${mm}-${dd} ${hh}.${min}.${ss} 运单数据表格.xlsx`;
                    
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    alert('导出失败');
                }
            } catch (e) {
                console.error('导出异常', e);
                alert('导出失败：' + e.message);
            }
        },
        async recalculateFees() {
            if (!confirm('确定要重算当前查询结果中所有运单的费用吗？这将根据最新的报价重新计算所有应收费用和供应商成本。')) {
                return;
            }
            
            this.recalculating = true;
            try {
                const res = await fetch("/api/waybills/recalculate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.searchForm)
                });
                
                const data = await res.json();
                if (data.success) {
                    let msg = data.message;
                    if (data.error_count > 0) {
                        msg += `\n注意：有 ${data.error_count} 条数据因缺少报价或其他原因未能更新。`;
                    }
                    alert(msg);
                    this.loadWaybills(); // 刷新列表
                } else {
                    alert('重算失败：' + data.message);
                }
            } catch (e) {
                console.error('重算费用失败', e);
                alert('操作异常：' + e.message);
            } finally {
                this.recalculating = false;
            }
        },
        async deleteSelected() {
            const selectedWaybills = this.waybills.filter(w => w.selected);
            if (selectedWaybills.length === 0) {
                alert('请选择要删除的运单');
                return;
            }
            
            const orderNos = selectedWaybills.map(w => w.order_no).join('\n');
            const confirmed = confirm(`确认要删除以下 ${selectedWaybills.length} 条运单吗？

${orderNos}

此操作不可恢复！`);
            
            if (!confirmed) return;
            
            try {
                const ids = selectedWaybills.map(w => w.id);
                const res = await fetch('/api/waybills/batch-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids })
                });
                
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    this.loadWaybills();
                } else {
                    alert('删除失败：' + data.message);
                }
            } catch (e) {
                console.error('删除运单失败', e);
                alert('删除失败：' + e.message);
            }
        },
        openImportModal() {
            this.showImportModal = true;
            this.selectedFile = null;
            this.importing = false;
            this.importErrors = null;
        },
        closeImportModal() {
            this.showImportModal = false;
            this.selectedFile = null;
            this.importing = false;
            this.importErrors = null;
            if (this.$refs.fileInput) {
                this.$refs.fileInput.value = '';
            }
        },
        handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                this.selectedFile = file;
                this.importErrors = null;
            }
        },
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        async downloadTemplate() {
            try {
                const res = await fetch('/api/waybills/download-template');
                if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    a.download = `运单导入模板_${date}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else {
                    alert('下载模板失败');
                }
            } catch (e) {
                console.error('下载模板失败', e);
                alert('下载模板失败：' + e.message);
            }
        },
        async submitImport() {
            if (!this.selectedFile) {
                alert('请选择文件');
                return;
            }
            
            this.importing = true;
            this.importErrors = null;
            
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            
            try {
                const res = await fetch('/api/waybills/import', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await res.json();
                
                if (data.success) {
                    alert(data.message);
                    this.closeImportModal();
                    this.loadWaybills();
                } else {
                    if (data.errors && data.errors.length > 0) {
                        this.importErrors = data.errors;
                    }
                    alert(data.message);
                }
            } catch (e) {
                console.error('导入失败', e);
                alert('导入失败：' + e.message);
            } finally {
                this.importing = false;
            }
        }
    }
};
