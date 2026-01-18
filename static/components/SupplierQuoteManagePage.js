const SupplierQuoteManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">供应商报价管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">+ 新增报价</button>
            </div>

            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
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
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>产品</label>
                        <input 
                            type="text" 
                            class="form-input" 
                            v-model="searchForm.product_search"
                            @input="filterProducts"
                            @focus="showProductDropdown = true; filterProducts()"
                            @dblclick="showAllProducts"
                            @blur="hideProductDropdown"
                            placeholder="双击显示所有产品或输入名称搜索"
                        />
                        <div v-if="showProductDropdown && filteredProductList.length > 0" 
                             style="position: absolute; top: 100%; left: 0; right: 0; z-index: 1000; background: white; border: 1px solid var(--border-color); border-radius: 4px; max-height: 200px; overflow-y: auto; margin-top: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div v-for="product in filteredProductList" 
                                 :key="product.id"
                                 @mousedown="selectProduct(product)"
                                 style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0; font-size: 14px;"
                                 :style="{ background: searchForm.product_id === product.id ? '#f0f9ff' : 'white' }"
                                 @mouseenter="$event.target.style.background='#f0f9ff'"
                                 @mouseleave="$event.target.style.background=(searchForm.product_id === product.id ? '#f0f9ff' : 'white')">
                                {{ product.name }}
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 200px;">
                        <label>报价有效期</label>
                        <input type="date" class="form-input" v-model="searchForm.valid_date" />
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 120px; max-width: 150px;">
                        <label>生效状态</label>
                        <select class="form-input" v-model="searchForm.status">
                            <option value="">全部状态</option>
                            <option value="生效中">生效中</option>
                            <option value="已失效">已失效</option>
                        </select>
                    </div>

                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" @click="resetSearch">重置</button>
                        <button class="btn btn-primary" @click="searchQuotes">搜索</button>
                    </div>
                </div>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>报价名称</th>
                            <th>供应商名称</th>
                            <th>产品名称</th>
                            <th>报价明细</th>
                            <th>生效状态</th>
                            <th>有效期起始</th>
                            <th>有效期结束</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="quotes.length === 0">
                            <td colspan="8" style="text-align: center; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-for="(quote, index) in quotes" :key="quote.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ quote.quote_name }}</td>
                            <td>
                                <div>{{ quote.supplier_name }}</div>
                                <div style="font-size: 12px; color: #999;">{{ quote.supplier_short_name }}</div>
                            </td>
                            <td>
                                <div style="color: #3a8c76; font-weight: 500;">{{ quote.product_name }}</div>
                            </td>
                            <td style="font-size: 13px;">
                                <button class="btn-link" @click="openDetailsModal(quote)">点击查看详情</button>
                            </td>
                            <td>
                                <span v-if="quote.is_effective" style="display: inline-block; padding: 2px 8px; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 12px; font-weight: 500;">生效中</span>
                                <span v-else style="display: inline-block; padding: 2px 8px; background: #ffebee; color: #c62828; border-radius: 4px; font-size: 12px; font-weight: 500;">已失效</span>
                            </td>
                            <td>{{ formatDateTime(quote.valid_from) }}</td>
                            <td>{{ formatDateTime(quote.valid_to) }}</td>
                            <td>
                                <button class="btn-link" @click="openEditModal(quote)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteQuote(quote)">删除</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页控件 -->
            <div class="pagination-container" v-if="pagination.total > 0">
                <div class="pagination-info">
                    共 {{ pagination.total }} 条记录，每页
                    <select v-model="pagination.perPage" @change="handlePageSizeChange" class="page-size-select">
                        <option :value="10">10</option>
                        <option :value="20">20</option>
                        <option :value="50">50</option>
                        <option :value="100">100</option>
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

            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 750px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑报价' : '新增报价' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>
                    <form @submit.prevent="submitForm" class="modal-body">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                            <div class="form-field" style="margin-bottom: 0;">
                                <label>报价名称 <span style="color: #e57373;">*</span></label>
                                <input type="text" class="form-input" v-model.trim="form.quote_name" placeholder="请输入报价名称（唯一）"/>
                                <div v-if="errors.quote_name" class="error-text">{{ errors.quote_name }}</div>
                            </div>
                            <div class="form-field" style="margin-bottom: 0;">
                                <label>选择供应商 <span style="color: #e57373;">*</span></label>
                                <select class="form-input" v-model="form.supplier_id">
                                    <option value="">请选择供应商</option>
                                    <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">{{ supplier.full_name }}</option>
                                </select>
                                <div v-if="errors.supplier_id" class="error-text">{{ errors.supplier_id }}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                            <div class="form-field" style="margin-bottom: 0;">
                                <label>选择产品 <span style="color: #e57373;">*</span></label>
                                <select class="form-input" v-model="form.product_id">
                                    <option value="">请选择产品</option>
                                    <option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }}</option>
                                </select>
                                <div v-if="errors.product_id" class="error-text">{{ errors.product_id }}</div>
                            </div>
                            <div class="form-field" style="margin-bottom: 0;">
                                <label>最低计费重量 (kg)</label>
                                <input type="number" step="0.001" class="form-input" v-model.number="form.min_weight" placeholder="0.000"/>
                            </div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span>价格阶梯配置 <span style="color: #e57373;">*</span></span>
                                <button type="button" class="btn btn-secondary btn-sm" @click="addTier" style="padding: 4px 12px; font-size: 12px;">+ 添加阶梯</button>
                            </label>
                            <div style="border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                                <table class="data-table" style="margin-bottom: 0; border: none;">
                                    <thead style="background: #f9fbf9;">
                                        <tr>
                                            <th style="font-size: 12px; padding: 8px;">起始重量 (>)</th>
                                            <th style="font-size: 12px; padding: 8px;">结束重量 (<=)</th>
                                            <th style="font-size: 12px; padding: 8px;">快递费(元/kg)</th>
                                            <th style="font-size: 12px; padding: 8px;">挂号费(元/件)</th>
                                            <th style="font-size: 12px; padding: 8px; width: 60px;">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="(tier, index) in form.price_tiers" :key="index">
                                            <td style="padding: 4px 8px;">
                                                <input type="number" step="0.001" class="form-input" v-model.number="tier.start" style="padding: 6px;"/>
                                            </td>
                                            <td style="padding: 4px 8px;">
                                                <input type="number" step="0.001" class="form-input" v-model.number="tier.end" style="padding: 6px;"/>
                                            </td>
                                            <td style="padding: 4px 8px;">
                                                <input type="number" step="0.01" class="form-input" v-model.number="tier.express" style="padding: 6px;"/>
                                            </td>
                                            <td style="padding: 4px 8px;">
                                                <input type="number" step="0.01" class="form-input" v-model.number="tier.reg" style="padding: 6px;"/>
                                            </td>
                                            <td style="padding: 4px 8px; text-align: center;">
                                                <button type="button" class="btn-link btn-danger" @click="removeTier(index)" :disabled="form.price_tiers.length === 1">删除</button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div v-if="errors.price_tiers" class="error-text">{{ errors.price_tiers }}</div>
                        </div>

                        <div class="form-row" style="margin-bottom: 16px;">
                            <div class="form-field">
                                <label>有效期起始日期 <span style="color: #e57373;">*</span></label>
                                <input type="date" class="form-input" v-model="form.valid_from_date"/>
                                <div style="font-size: 12px; color: #6b8a80; margin-top: 4px;">默认时间：00:00:00</div>
                                <div v-if="errors.valid_from" class="error-text">{{ errors.valid_from }}</div>
                            </div>
                            <div class="form-field">
                                <label>有效期结束日期 <span style="color: #e57373;">*</span></label>
                                <input type="date" class="form-input" v-model="form.valid_to_date"/>
                                <div style="font-size: 12px; color: #6b8a80; margin-top: 4px;">默认时间：23:59:59</div>
                                <div v-if="errors.valid_to" class="error-text">{{ errors.valid_to }}</div>
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
                            <button type="submit" class="btn btn-primary" :disabled="submitting">
                                <span v-if="!submitting">确认{{ isEdit ? '保存' : '新增' }}</span>
                                <span v-else>提交中...</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 详情查看弹窗 -->
            <div v-if="showDetailsModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">报价明细详情</h3>
                        <button class="modal-close" @click="showDetailsModal = false">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 15px; padding: 10px; background: #f9fbf9; border-radius: 6px; font-size: 14px;">
                            <strong>最低计费重量:</strong> {{ selectedQuoteMinWeight }} kg
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>重量区间 (kg)</th>
                                    <th>快递费 (元/kg)</th>
                                    <th>挂号费 (元/单)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(tier, idx) in selectedQuoteTiers" :key="idx">
                                    <td style="text-align: center;">{{ tier.start }} < 重量 <= {{ tier.end }}</td>
                                    <td style="text-align: center; color: #3a8c76; font-weight: 500;">{{ tier.express }}</td>
                                    <td style="text-align: center; color: #2196F3; font-weight: 500;">{{ tier.reg }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showDetailsModal = false">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            quotes: [],
            suppliers: [],
            products: [],
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 20
            },
            searchForm: { supplier_id: "", supplier_search: "", product_id: "", product_search: "", valid_date: "", status: "" },
            showModal: false,
            isEdit: false,
            showDetailsModal: false,
            selectedQuoteTiers: [],
            selectedQuoteMinWeight: 0,
            form: { id: null, quote_name: "", supplier_id: "", product_id: "", min_weight: 0, price_tiers: [], valid_from_date: "", valid_to_date: "" },
            errors: {},
            submitting: false,
            showSupplierDropdown: false,
            filteredSupplierList: [],
            showProductDropdown: false,
            filteredProductList: []
        };
    },
    mounted() {
        this.loadSuppliers();
        this.loadProducts();
        this.loadQuotes();
    },
    methods: {
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
        async loadQuotes() {
            try {
                const params = new URLSearchParams();
                if (this.searchForm.supplier_id) params.append("supplier_id", this.searchForm.supplier_id);
                if (this.searchForm.product_id) params.append("product_id", this.searchForm.product_id);
                if (this.searchForm.valid_date) params.append("valid_date", this.searchForm.valid_date);
                if (this.searchForm.status) params.append("status", this.searchForm.status);
                params.append("page", this.pagination.currentPage);
                params.append("per_page", this.pagination.perPage);
                
                const res = await fetch(`/api/supplier-quotes?${params}`);
                const data = await res.json();
                if (data.success) {
                    this.quotes = data.quotes;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载报价列表失败", e);
            }
        },
        searchQuotes() {
            this.pagination.currentPage = 1;
            this.loadQuotes();
        },
        resetSearch() {
            this.searchForm = { supplier_id: "", supplier_search: "", product_id: "", product_search: "", valid_date: "", status: "" };
            this.pagination.currentPage = 1;
            this.loadQuotes();
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
        filterProducts() {
            const search = this.searchForm.product_search.toLowerCase();
            if (search) {
                this.filteredProductList = this.products.filter(p => 
                    p.name.toLowerCase().includes(search)
                );
            } else {
                this.filteredProductList = this.products;
            }
            this.showProductDropdown = true;
        },
        showAllProducts() {
            this.filteredProductList = this.products;
            this.showProductDropdown = true;
        },
        selectProduct(product) {
            this.searchForm.product_id = product.id;
            this.searchForm.product_search = product.name;
            this.showProductDropdown = false;
        },
        hideProductDropdown() {
            setTimeout(() => {
                this.showProductDropdown = false;
            }, 200);
        },
        formatDateTime(dateStr) {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        },
        openDetailsModal(quote) {
            this.selectedQuoteTiers = quote.price_tiers || [];
            this.selectedQuoteMinWeight = quote.min_weight || 0;
            this.showDetailsModal = true;
        },
        addTier() {
            let start = 0;
            if (this.form.price_tiers.length > 0) {
                start = this.form.price_tiers[this.form.price_tiers.length - 1].end;
            }
            // 不再自动填充结束重量，仅起始重量取上一个阶梯的结束重量
            this.form.price_tiers.push({ start: start, end: "", express: 0, reg: 0 });
        },
        removeTier(index) {
            if (this.form.price_tiers.length > 1) {
                this.form.price_tiers.splice(index, 1);
            }
        },
        openCreateModal() {
            this.isEdit = false;
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            this.form = { 
                id: null, 
                quote_name: "", 
                supplier_id: "", 
                product_id: "", 
                min_weight: 0,
                price_tiers: [{ start: 0, end: "", express: 0, reg: 0 }],
                valid_from_date: todayStr, 
                valid_to_date: todayStr 
            };
            this.errors = {};
            this.showModal = true;
        },
        openEditModal(quote) {
            this.isEdit = true;
            const validFromDate = quote.valid_from.split('T')[0];
            const validToDate = quote.valid_to.split('T')[0];
            this.form = {
                id: quote.id,
                quote_name: quote.quote_name,
                supplier_id: quote.supplier_id,
                product_id: quote.product_id,
                min_weight: quote.min_weight || 0,
                price_tiers: quote.price_tiers ? JSON.parse(JSON.stringify(quote.price_tiers)) : [{ start: 0, end: "", express: 0, reg: 0 }],
                valid_from_date: validFromDate,
                valid_to_date: validToDate
            };
            this.errors = {};
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
        },
        async submitForm() {
            if (!this.validateForm()) return;
            this.submitting = true;
            try {
                const validFromStr = this.form.valid_from_date + 'T00:00:00';
                const validToStr = this.form.valid_to_date + 'T23:59:59';
                
                const url = this.isEdit ? `/api/supplier-quotes/${this.form.id}` : "/api/supplier-quotes";
                const method = this.isEdit ? "PUT" : "POST";
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        quote_name: this.form.quote_name,
                        supplier_id: this.form.supplier_id,
                        product_id: this.form.product_id,
                        min_weight: this.form.min_weight,
                        price_tiers: this.form.price_tiers,
                        valid_from: validFromStr,
                        valid_to: validToStr
                    })
                });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    if (data.field && this.errors[data.field] !== undefined) {
                        this.errors[data.field] = data.message;
                    } else {
                        alert(data.message || "操作失败");
                    }
                    return;
                }
                alert(this.isEdit ? "编辑成功" : "新增成功");
                this.closeModal();
                this.loadQuotes();
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.submitting = false;
            }
        },
        validateForm() {
            this.errors = {};
            let valid = true;
            if (!this.form.quote_name) {
                this.errors.quote_name = "请输入报价名称";
                valid = false;
            }
            if (!this.form.supplier_id) {
                this.errors.supplier_id = "请选择供应商";
                valid = false;
            }
            if (!this.form.product_id) {
                this.errors.product_id = "请选择产品";
                valid = false;
            }
            if (!this.form.price_tiers || this.form.price_tiers.length === 0) {
                this.errors.price_tiers = "请至少添加一个价格阶梯";
                valid = false;
            } else {
                // 验证阶梯合法性
                for (let i = 0; i < this.form.price_tiers.length; i++) {
                    const tier = this.form.price_tiers[i];
                    if (tier.end <= tier.start) {
                        this.errors.price_tiers = `第 ${i+1} 行结束重量必须大于起始重量`;
                        valid = false;
                        break;
                    }
                    if (tier.express < 0 || tier.reg < 0) {
                        this.errors.price_tiers = `第 ${i+1} 行费用不能为负数`;
                        valid = false;
                        break;
                    }
                }
            }
            if (!this.form.valid_from_date || !this.form.valid_to_date) {
                this.errors.valid_from = "请选择有效期";
                valid = false;
            }
            return valid;
        },
        async deleteQuote(quote) {
            if (!confirm(`确定要删除报价"${quote.quote_name}"吗？`)) return;
            try {
                const res = await fetch(`/api/supplier-quotes/${quote.id}`, { method: "DELETE" });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    alert(data.message || "删除失败");
                    return;
                }
                alert("删除成功");
                this.loadQuotes();
            } catch (e) {
                alert("删除失败，请稍后重试");
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadQuotes();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadQuotes();
        }
    }
};
