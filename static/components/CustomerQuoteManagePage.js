const CustomerQuoteManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">客户报价管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">+ 新增报价</button>
            </div>

            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px; position: relative;">
                        <label>报价客户（通过简称搜索）</label>
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
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 200px;">
                        <label>报价类别</label>
                        <select class="form-input" v-model="searchForm.quote_type">
                            <option value="">全部类别</option>
                            <option>单号报价</option>
                            <option>头程报价</option>
                            <option>尾程报价</option>
                            <option>专线处理费</option>
                        </select>
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
                            <th>客户名称</th>
                            <th>报价类别</th>
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
                                <div>{{ quote.customer_name }}</div>
                                <div style="font-size: 12px; color: #999;">{{ quote.customer_short_name }}</div>
                            </td>
                            <td><span style="display: inline-block; padding: 2px 8px; background: #e5f4ef; color: #3a8c76; border-radius: 4px; font-size: 12px;">{{ quote.quote_type }}</span></td>
                            <td style="font-size: 13px;">
                                <div v-if="quote.quote_type === '单号报价'">单号费：{{ quote.unit_fee }}元/单</div>
                                <div v-else-if="quote.quote_type === '头程报价'">
                                    空运费：{{ quote.air_freight }}元/kg<br/>
                                    <span style="color: #666; font-size: 12px;">适用产品：{{ quote.product_names || '未选择' }}</span>
                                </div>
                                <div v-else-if="quote.quote_type === '尾程报价'">
                                    快递费：{{ quote.express_fee }}元/kg<br/>挂号费：{{ quote.registration_fee }}元/单<br/>
                                    <span style="color: #666; font-size: 12px;">适用产品：{{ quote.product_names || '未选择' }}</span>
                                </div>
                                <div v-else-if="quote.quote_type === '专线处理费'">
                                    重量收费：{{ quote.dedicated_line_weight_fee }}元/kg<br/>单件收费：{{ quote.dedicated_line_piece_fee }}元/件<br/>
                                    <span style="color: #666; font-size: 12px;">适用产品：{{ quote.product_names || '未选择' }}</span>
                                </div>
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
                <div class="modal-content" style="max-width: 650px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑报价' : '新增报价' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>
                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>报价名称 <span style="color: #e57373;">*</span></label>
                            <input type="text" class="form-input" v-model.trim="form.quote_name" placeholder="请输入报价名称（唯一）"/>
                            <div v-if="errors.quote_name" class="error-text">{{ errors.quote_name }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>报价客户 <span style="color: #e57373;">*</span></label>
                            <select class="form-input" v-model="form.customer_id" @change="onCustomerChange">
                                <option value="">请选择客户</option>
                                <option v-for="customer in customers" :key="customer.id" :value="customer.id">{{ customer.full_name }}</option>
                            </select>
                            <div v-if="errors.customer_id" class="error-text">{{ errors.customer_id }}</div>
                        </div>

                        <div v-if="form.customer_id" class="form-field" style="margin-bottom: 16px;">
                            <label>报价类别 <span style="color: #e57373;">*</span></label>
                            <select class="form-input" v-model="form.quote_type" @change="onQuoteTypeChange">
                                <option value="">请选择报价类别</option>
                                <option v-for="type in availableQuoteTypes" :key="type">{{ type }}</option>
                            </select>
                            <div v-if="errors.quote_type" class="error-text">{{ errors.quote_type }}</div>
                        </div>

                        <div v-if="['头程报价', '尾程报价', '专线处理费'].includes(form.quote_type)" class="form-field" style="margin-bottom: 16px;">
                            <label>选择适用产品 (可多选) <span style="color: #e57373;">*</span></label>
                            <div style="border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; max-height: 150px; overflow-y: auto; background: #fafafa;">
                                <div v-if="form.quote_type === '头程报价'">
                                    <div v-for="product in firstProducts" :key="product.id" style="display: flex; align-items: center; margin-bottom: 6px;">
                                        <input type="checkbox" :id="'p-'+product.id" :value="product.id" v-model="form.product_ids" style="margin-right: 8px;"/>
                                        <label :for="'p-'+product.id" style="margin-bottom: 0; cursor: pointer; font-weight: normal;">{{ product.name }}</label>
                                    </div>
                                    <div v-if="firstProducts.length === 0" style="color: #999; font-size: 12px;">暂无可用的头程产品</div>
                                </div>
                                <div v-else-if="form.quote_type === '尾程报价'">
                                    <div v-for="product in tailProducts" :key="product.id" style="display: flex; align-items: center; margin-bottom: 6px;">
                                        <input type="checkbox" :id="'p-'+product.id" :value="product.id" v-model="form.product_ids" style="margin-right: 8px;"/>
                                        <label :for="'p-'+product.id" style="margin-bottom: 0; cursor: pointer; font-weight: normal;">{{ product.name }}</label>
                                    </div>
                                    <div v-if="tailProducts.length === 0" style="color: #999; font-size: 12px;">暂无可用的尾程产品</div>
                                </div>
                                <div v-else-if="form.quote_type === '专线处理费'">
                                    <div v-for="product in dedicatedProducts" :key="product.id" style="display: flex; align-items: center; margin-bottom: 6px;">
                                        <input type="checkbox" :id="'p-'+product.id" :value="product.id" v-model="form.product_ids" style="margin-right: 8px;"/>
                                        <label :for="'p-'+product.id" style="margin-bottom: 0; cursor: pointer; font-weight: normal;">{{ product.name }}</label>
                                    </div>
                                    <div v-if="dedicatedProducts.length === 0" style="color: #999; font-size: 12px;">暂无可用的差价产品</div>
                                </div>
                            </div>
                            <div v-if="errors.product_ids" class="error-text">{{ errors.product_ids }}</div>
                        </div>

                        <div v-if="form.quote_type === '单号报价'" class="form-field" style="margin-bottom: 16px;">
                            <label>单号费（元/单） <span style="color: #e57373;">*</span></label>
                            <input type="number" step="0.01" class="form-input" v-model.number="form.unit_fee" placeholder="请输入单号费"/>
                            <div v-if="errors.unit_fee" class="error-text">{{ errors.unit_fee }}</div>
                        </div>

                        <div v-if="form.quote_type === '头程报价'" class="form-field" style="margin-bottom: 16px;">
                            <label>空运费（元/kg） <span style="color: #e57373;">*</span></label>
                            <input type="number" step="0.01" class="form-input" v-model.number="form.air_freight" placeholder="请输入空运费"/>
                            <div v-if="errors.air_freight" class="error-text">{{ errors.air_freight }}</div>
                        </div>

                        <div v-if="form.quote_type === '尾程报价'">
                            <div class="form-field" style="margin-bottom: 16px;">
                                <label>快递费（元/kg） <span style="color: #e57373;">*</span></label>
                                <input type="number" step="0.01" class="form-input" v-model.number="form.express_fee" placeholder="请输入快递费"/>
                                <div v-if="errors.express_fee" class="error-text">{{ errors.express_fee }}</div>
                            </div>
                            <div class="form-field" style="margin-bottom: 16px;">
                                <label>挂号费（元/单） <span style="color: #e57373;">*</span></label>
                                <input type="number" step="0.01" class="form-input" v-model.number="form.registration_fee" placeholder="请输入挂号费"/>
                                <div v-if="errors.registration_fee" class="error-text">{{ errors.registration_fee }}</div>
                            </div>
                        </div>

                        <div v-if="form.quote_type === '专线处理费'">
                            <div class="form-field" style="margin-bottom: 16px;">
                                <label>重量收费（元/kg）</label>
                                <input type="number" step="0.01" class="form-input" v-model.number="form.dedicated_line_weight_fee" placeholder="请输入重量收费"/>
                                <div v-if="errors.dedicated_line_weight_fee" class="error-text">{{ errors.dedicated_line_weight_fee }}</div>
                            </div>
                            <div class="form-field" style="margin-bottom: 16px;">
                                <label>单件收费（元/件）</label>
                                <input type="number" step="0.01" class="form-input" v-model.number="form.dedicated_line_piece_fee" placeholder="请输入单件收费"/>
                                <div v-if="errors.dedicated_line_piece_fee" class="error-text">{{ errors.dedicated_line_piece_fee }}</div>
                                <div style="font-size: 12px; color: #6b8a80; margin-top: 4px;">注意：重量收费和单件收费不能同时为0</div>
                            </div>
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
        </div>
    `,
    data() {
        return {
            quotes: [],
            customers: [],
            products: [],
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 20
            },
            searchForm: { customer_id: "", customer_search: "", quote_type: "", valid_date: "", status: "" },
            showModal: false,
            isEdit: false,
            form: { id: null, quote_name: "", customer_id: "", quote_type: "", product_ids: [], unit_fee: "", air_freight: "", express_fee: "", registration_fee: "", dedicated_line_weight_fee: "", dedicated_line_piece_fee: "", valid_from_date: "", valid_to_date: "" },
            errors: {},
            submitting: false,
            availableQuoteTypes: [],
            showCustomerDropdown: false,
            filteredCustomerList: []
        };
    },
    computed: {
        tailProducts() {
            return this.products.filter(p => p.fee_types.includes('尾程收费'));
        },
        firstProducts() {
            return this.products.filter(p => p.fee_types.includes('头程收费'));
        },
        dedicatedProducts() {
            return this.products.filter(p => p.fee_types.includes('差价收费'));
        }
    },
    mounted() {
        this.loadCustomers();
        this.loadProducts();
        this.loadQuotes();
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
                if (this.searchForm.customer_id) params.append("customer_id", this.searchForm.customer_id);
                if (this.searchForm.quote_type) params.append("quote_type", this.searchForm.quote_type);
                if (this.searchForm.valid_date) params.append("valid_date", this.searchForm.valid_date);
                if (this.searchForm.status) params.append("status", this.searchForm.status);
                params.append("page", this.pagination.currentPage);
                params.append("per_page", this.pagination.perPage);
                
                const res = await fetch(`/api/customer-quotes?${params}`);
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
            this.searchForm = { customer_id: "", customer_search: "", quote_type: "", valid_date: "", status: "" };
            this.pagination.currentPage = 1;
            this.loadQuotes();
        },
        filterCustomers() {
            const search = this.searchForm.customer_search.toLowerCase();
            if (search) {
                // 优先通过简称搜索，其次是全称
                this.filteredCustomerList = this.customers.filter(c => 
                    c.short_name.toLowerCase().includes(search) || 
                    c.full_name.toLowerCase().includes(search)
                );
            } else {
                // 如果没有输入，显示所有客户
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
        formatDateTime(dateStr) {
            if (!dateStr) return "-";
            const d = new Date(dateStr);
            return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        },
        openCreateModal() {
            this.isEdit = false;
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            this.form = { id: null, quote_name: "", customer_id: "", quote_type: "", product_ids: [], unit_fee: "", air_freight: "", express_fee: "", registration_fee: "", dedicated_line_weight_fee: "", dedicated_line_piece_fee: "", valid_from_date: todayStr, valid_to_date: todayStr };
            this.errors = {};
            this.availableQuoteTypes = [];
            this.showModal = true;
        },
        openEditModal(quote) {
            this.isEdit = true;
            // 直接从ISO字符串中提取日期部分，避免时区转换
            const validFromDate = quote.valid_from.split('T')[0];
            const validToDate = quote.valid_to.split('T')[0];
            this.form = {
                id: quote.id,
                quote_name: quote.quote_name,
                customer_id: quote.customer_id,
                quote_type: quote.quote_type,
                product_ids: quote.product_ids || [],
                unit_fee: quote.unit_fee || "",
                air_freight: quote.air_freight || "",
                express_fee: quote.express_fee || "",
                registration_fee: quote.registration_fee || "",
                dedicated_line_weight_fee: quote.dedicated_line_weight_fee || "",
                dedicated_line_piece_fee: quote.dedicated_line_piece_fee || "",
                valid_from_date: validFromDate,
                valid_to_date: validToDate
            };
            this.errors = {};
            this.onCustomerChange();
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
        },
        onCustomerChange() {
            const customer = this.customers.find(c => c.id === this.form.customer_id);
            if (!customer) {
                this.availableQuoteTypes = [];
                return;
            }
            const typeMapping = { "单号客户": "单号报价", "头程客户": "头程报价", "尾程客户": "尾程报价", "差价客户": "专线处理费" };
            this.availableQuoteTypes = customer.customer_types.map(t => typeMapping[t]).filter(Boolean);
            if (!this.availableQuoteTypes.includes(this.form.quote_type)) {
                this.form.quote_type = "";
            }
        },
        onQuoteTypeChange() {
            this.form.product_ids = [];
            this.form.unit_fee = "";
            this.form.air_freight = "";
            this.form.express_fee = "";
            this.form.registration_fee = "";
            this.form.dedicated_line_weight_fee = "";
            this.form.dedicated_line_piece_fee = "";
        },
        async submitForm() {
            if (!this.validateForm()) return;
            this.submitting = true;
            try {
                // 将日期转换为本地时间字符串（不带时区）
                const validFromStr = this.form.valid_from_date + 'T00:00:00';
                const validToStr = this.form.valid_to_date + 'T23:59:59';
                
                const url = this.isEdit ? `/api/customer-quotes/${this.form.id}` : "/api/customer-quotes";
                const method = this.isEdit ? "PUT" : "POST";
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        quote_name: this.form.quote_name,
                        customer_id: this.form.customer_id,
                        quote_type: this.form.quote_type,
                        product_ids: this.form.product_ids,
                        unit_fee: this.form.unit_fee,
                        air_freight: this.form.air_freight,
                        express_fee: this.form.express_fee,
                        registration_fee: this.form.registration_fee,
                        dedicated_line_weight_fee: this.form.dedicated_line_weight_fee,
                        dedicated_line_piece_fee: this.form.dedicated_line_piece_fee,
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
            if (!this.form.customer_id) {
                this.errors.customer_id = "请选择报价客户";
                valid = false;
            }
            if (!this.form.quote_type) {
                this.errors.quote_type = "请选择报价类别";
                valid = false;
            }
            if (!this.form.valid_from_date || !this.form.valid_to_date) {
                this.errors.valid_from = "请选择有效期";
                valid = false;
            }
            if (this.form.quote_type === '专线处理费') {
                const w = parseFloat(this.form.dedicated_line_weight_fee) || 0;
                const p = parseFloat(this.form.dedicated_line_piece_fee) || 0;
                if (w === 0 && p === 0) {
                    this.errors.dedicated_line_weight_fee = "重量收费和单件收费不能同时为0";
                    valid = false;
                }
            }
            if (['头程报价', '尾程报价', '专线处理费'].includes(this.form.quote_type)) {
                if (!this.form.product_ids || this.form.product_ids.length === 0) {
                    this.errors.product_ids = "请至少选择一个产品";
                    valid = false;
                }
            }
            return valid;
        },
        async deleteQuote(quote) {
            if (!confirm(`确定要删除报价"${quote.quote_name}"吗？`)) return;
            try {
                const res = await fetch(`/api/customer-quotes/${quote.id}`, { method: "DELETE" });
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
