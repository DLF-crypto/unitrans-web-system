const PaymentManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">收付款管理</h2>
            </div>

            <!-- 搜索区域 -->
            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 250px; max-width: 350px;">
                        <label>收付款对象</label>
                        <select class="form-input" v-model="searchForm.target_key" @change="searchPayments">
                            <option value="">全部对象</option>
                            <optgroup label="客户">
                                <option v-for="c in customers" :key="'c'+c.id" :value="'customer:' + c.id">{{ c.full_name }}</option>
                            </optgroup>
                            <optgroup label="供应商">
                                <option v-for="s in suppliers" :key="'s'+s.id" :value="'supplier:' + s.id">{{ s.full_name }}</option>
                            </optgroup>
                        </select>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>起始日期</label>
                        <input type="date" class="form-input" v-model="searchForm.start_date" @change="searchPayments" />
                    </div>

                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 180px;">
                        <label>结束日期</label>
                        <input type="date" class="form-input" v-model="searchForm.end_date" @change="searchPayments" />
                    </div>

                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 100px; max-width: 120px;">
                        <label>收付款类别</label>
                        <select class="form-input" v-model="searchForm.payment_type" @change="searchPayments">
                            <option value="">全部</option>
                            <option value="收款">收款</option>
                            <option value="付款">付款</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" @click="resetSearch">重置</button>
                        <button class="btn btn-primary" @click="searchPayments">搜索</button>
                    </div>
                </div>
            </div>

            <!-- 功能区 -->
            <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
                <button class="btn btn-primary" @click="openAddModal">新增收付款</button>
            </div>

            <!-- 表格显示区 -->
            <div class="role-list-card" style="overflow: auto;">
                <table class="data-table" style="min-width: 1100px; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="width: 60px;">序号</th>
                            <th>收付款对象</th>
                            <th style="width: 100px;">收付款类别</th>
                            <th style="width: 150px;">收付款日期</th>
                            <th style="width: 130px;">收款金额</th>
                            <th style="width: 130px;">付款金额</th>
                            <th>对应账单</th>
                            <th style="width: 100px;">水单</th>
                            <th>备注</th>
                            <th style="width: 150px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="isLoading">
                            <td colspan="10" style="text-align: center; padding: 40px;">
                                <div class="loading-spinner" style="margin: 0 auto 10px;"></div>
                                <div style="color: var(--primary);">正在加载数据...</div>
                            </td>
                        </tr>
                        <tr v-else-if="payments.length === 0">
                            <td colspan="10" style="text-align: center; color: #999; padding: 40px;">暂无收付款数据</td>
                        </tr>
                        <tr v-for="(p, index) in payments" :key="p.id">
                            <td style="text-align: center;">{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td style="text-align: center;">{{ p.target_name }}</td>
                            <td style="text-align: center;">{{ p.payment_type }}</td>
                            <td style="text-align: center;">{{ p.payment_date }}</td>
                            <td style="color: #2196F3; font-weight: 600; text-align: center;">
                                <template v-if="p.payment_type === '收款'">{{ formatAmount(p.amount) }}</template>
                                <template v-else>-</template>
                            </td>
                            <td style="color: #f44336; font-weight: 600; text-align: center;">
                                <template v-if="p.payment_type === '付款'">{{ formatAmount(p.amount) }}</template>
                                <template v-else>-</template>
                            </td>
                            <td style="text-align: center;">{{ p.linked_invoice || '-' }}</td>
                            <td style="text-align: center;">
                                <div v-if="p.receipt_path" 
                                     style="width: 40px; height: 40px; border: 1px solid #eee; border-radius: 4px; overflow: hidden; cursor: zoom-in; margin: 0 auto;"
                                     @click="viewFullImage(p.receipt_path)" 
                                     title="点击放大查看">
                                    <img :src="p.receipt_path" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                                </div>
                                <span v-else>-</span>
                            </td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;" :title="p.remark">
                                {{ p.remark || '-' }}
                            </td>
                            <td style="text-align: center;">
                                <button class="btn-link" @click="editPayment(p)">编辑</button>
                                <button class="btn-link btn-danger" @click="deletePayment(p)">删除</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页控件 -->
            <div v-if="pagination.total > 0" class="pagination-container">
                <div class="pagination-info">
                    共 {{ pagination.total }} 条记录，每页
                    <select class="page-size-select" v-model.number="pagination.perPage" @change="handlePageSizeChange">
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
                    <span class="page-current">{{ pagination.currentPage }} / {{ pagination.totalPages }}</span>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.totalPages" @click="changePage(pagination.currentPage + 1)">下一页</button>
                    <button class="btn-page" :disabled="pagination.currentPage === pagination.totalPages" @click="changePage(pagination.totalPages)">末页</button>
                </div>
            </div>

            <!-- 新增/编辑弹窗 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑收付款记录' : '新增收付款记录' }}</h3>
                        <button class="modal-close" @click="showModal = false">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>收付款对象 <span style="color: #e57373;">*</span></label>
                            <select class="form-input" v-model="form.target_key" @change="onTargetChange" :disabled="isEdit">
                                <option value="">请选择收付款对象</option>
                                <optgroup label="客户 (仅限收款)">
                                    <option v-for="c in customers" :key="'fc'+c.id" :value="'customer:' + c.id">{{ c.full_name }}</option>
                                </optgroup>
                                <optgroup label="供应商 (仅限付款)">
                                    <option v-for="s in suppliers" :key="'fs'+s.id" :value="'supplier:' + s.id">{{ s.full_name }}</option>
                                </optgroup>
                            </select>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-field">
                                <label>收付款类别</label>
                                <input type="text" class="form-input" v-model="form.payment_type" disabled style="background: #f5f5f5;" />
                            </div>
                            <div class="form-field">
                                <label>收付款日期 <span style="color: #e57373;">*</span></label>
                                <input type="date" class="form-input" v-model="form.payment_date" />
                            </div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>收付款金额 <span style="color: #e57373;">*</span></label>
                            <input type="number" step="0.01" class="form-input" v-model.number="form.amount" placeholder="请输入金额" />
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>选择对应账单</label>
                            <select class="form-input" v-model="form.invoice_id_union">
                                <option value="">无 (不选择账单)</option>
                                <option v-for="inv in unpaidInvoices" :key="inv.id" :value="inv.id">{{ inv.label }}</option>
                            </select>
                            <div style="font-size: 11px; color: #999; margin-top: 4px;">仅显示未核销的账单。选中后该账单将标记为“已收款/已付款”。</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>上传水单</label>
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <div v-if="form.receipt_path" 
                                     style="position: relative; width: 80px; height: 80px; border: 1px solid #ddd; border-radius: 4px; overflow: visible;">
                                    <img :src="form.receipt_path" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px; display: block;" />
                                    <div class="remove-receipt" @click="form.receipt_path = ''" 
                                         style="position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; background: #f44336; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; line-height: 1; z-index: 10;">&times;</div>
                                </div>
                                <div class="upload-btn-box">
                                    <input type="file" ref="fileInput" @change="handleFileUpload" accept="image/*" style="display: none;" />
                                    <button type="button" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" @click="$refs.fileInput.click()" :disabled="isUploading">
                                        {{ isUploading ? '上传中...' : '选择图片' }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="form-field">
                            <label>备注</label>
                            <textarea class="form-input" v-model="form.remark" rows="3" placeholder="输入备注信息"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="showModal = false" :disabled="isSubmitting">取消</button>
                        <button class="btn btn-primary" @click="submitForm" :disabled="isSubmitting">
                            {{ isSubmitting ? '提交中...' : '确定' }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- 图片查看大图弹窗 -->
            <div v-if="previewImageUrl" class="modal-overlay" @click="previewImageUrl = ''" style="background: rgba(0,0,0,0.8); cursor: zoom-out; z-index: 3000;">
                <img :src="previewImageUrl" style="max-width: 90vw; max-height: 90vh; border-radius: 4px; box-shadow: 0 0 20px rgba(0,0,0,0.5);" />
            </div>

            <style>
                .receipt-thumb-box {
                    width: 40px;
                    height: 40px;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    overflow: hidden;
                    cursor: zoom-in;
                    margin: 0 auto;
                }
                .receipt-thumb {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .receipt-preview-box {
                    position: relative;
                    width: 80px;
                    height: 80px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .receipt-preview {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .remove-receipt {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 18px;
                    height: 18px;
                    background: #f44336;
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    cursor: pointer;
                    line-height: 1;
                }
                .upload-btn-box {
                    display: flex;
                    align-items: center;
                    height: 80px;
                }
            </style>
        </div>
    `,
    data() {
        return {
            payments: [],
            customers: [],
            suppliers: [],
            pagination: {
                total: 0,
                totalPages: 0,
                currentPage: 1,
                perPage: 20
            },
            searchForm: {
                target_key: "",
                start_date: "",
                end_date: "",
                payment_type: ""
            },
            showModal: false,
            isEdit: false,
            isSubmitting: false,
            isUploading: false,
            isLoading: false,
            unpaidInvoices: [],
            form: {
                id: null,
                target_key: "",
                payment_type: "",
                payment_date: "",
                amount: null,
                invoice_id_union: "",
                receipt_path: "",
                remark: ""
            },
            previewImageUrl: ""
        };
    },
    mounted() {
        this.fetchBaseData();
        this.loadPayments();
    },
    methods: {
        async fetchBaseData() {
            try {
                const [cRes, sRes] = await Promise.all([
                    fetch("/api/customers"),
                    fetch("/api/suppliers")
                ]);
                const cData = await cRes.json();
                const sData = await sRes.json();
                if (cData.success) this.customers = cData.customers;
                if (sData.success) this.suppliers = sData.suppliers;
            } catch (e) {
                console.error("加载基础资料失败", e);
            }
        },
        async loadPayments() {
            this.isLoading = true;
            try {
                const params = new URLSearchParams({
                    page: this.pagination.currentPage,
                    per_page: this.pagination.perPage,
                    payment_type: this.searchForm.payment_type,
                    start_date: this.searchForm.start_date,
                    end_date: this.searchForm.end_date
                });
                
                if (this.searchForm.target_key) {
                    const [type, id] = this.searchForm.target_key.split(':');
                    params.append('target_type', type);
                    params.append('target_id', id);
                }

                const res = await fetch(`/api/payments?${params}`);
                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP error! status: ${res.status}, body: ${errorText.substring(0, 100)}`);
                }
                const data = await res.json();
                if (data.success) {
                    this.payments = data.payments;
                    this.pagination.total = data.pagination.total;
                    this.pagination.totalPages = data.pagination.pages;
                    this.pagination.currentPage = data.pagination.current_page;
                    this.pagination.perPage = data.pagination.per_page;
                } else {
                    alert("加载失败: " + data.message);
                }
            } catch (e) {
                console.error("加载收付款记录失败", e);
                alert("加载收付款数据出错，请检查网络或联系管理员。详情: " + e.message);
            } finally {
                this.isLoading = false;
            }
        },
        searchPayments() {
            this.pagination.currentPage = 1;
            this.loadPayments();
        },
        resetSearch() {
            this.searchForm = {
                target_key: "",
                start_date: "",
                end_date: "",
                payment_type: ""
            };
            this.pagination.currentPage = 1;
            this.loadPayments();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadPayments();
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadPayments();
        },
        formatAmount(amt) {
            return parseFloat(amt).toFixed(2);
        },
        openAddModal() {
            this.isEdit = false;
            this.unpaidInvoices = [];
            this.form = {
                id: null,
                target_key: "",
                payment_type: "",
                payment_date: new Date().toISOString().substr(0, 10),
                amount: null,
                invoice_id_union: "",
                receipt_path: "",
                remark: ""
            };
            this.showModal = true;
        },
        async onTargetChange() {
            if (!this.form.target_key) {
                this.form.payment_type = "";
                this.unpaidInvoices = [];
                return;
            }
            if (this.form.target_key.startsWith('customer:')) {
                this.form.payment_type = "收款";
            } else {
                this.form.payment_type = "付款";
            }
            
            // 加载该对象的未付账单
            const [type, id] = this.form.target_key.split(':');
            try {
                const res = await fetch(`/api/unpaid-invoices?target_type=${type}&target_id=${id}`);
                const data = await res.json();
                if (data.success) {
                    this.unpaidInvoices = data.invoices;
                }
            } catch (e) {
                console.error("加载未付账单失败", e);
            }
        },
        async handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            this.isUploading = true;
            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch("/api/payments/upload-receipt", {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    this.form.receipt_path = data.url;
                } else {
                    alert("上传失败：" + data.message);
                }
            } catch (e) {
                alert("上传请求失败");
            } finally {
                this.isUploading = false;
                this.$refs.fileInput.value = ""; // 清空 input
            }
        },
        async submitForm() {
            if (!this.form.target_key) return alert("请选择收付款对象");
            if (!this.form.payment_date) return alert("请选择收付款日期");
            if (!this.form.amount || this.form.amount <= 0) return alert("请输入有效金额");

            this.isSubmitting = true;
            const [type, id] = this.form.target_key.split(':');
            const payload = {
                target_type: type,
                target_id: parseInt(id),
                payment_type: this.form.payment_type,
                payment_date: this.form.payment_date,
                amount: this.form.amount,
                invoice_id: type === 'customer' ? this.form.invoice_id_union : null,
                supplier_invoice_id: type === 'supplier' ? this.form.invoice_id_union : null,
                receipt_path: this.form.receipt_path,
                remark: this.form.remark
            };

            try {
                const url = this.isEdit ? `/api/payments/${this.form.id}` : "/api/payments";
                const method = this.isEdit ? "PUT" : "POST";
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.success) {
                    alert(this.isEdit ? "更新成功" : "添加成功");
                    this.showModal = false;
                    this.loadPayments();
                } else {
                    alert("操作失败：" + data.message);
                }
            } catch (e) {
                alert("请求失败");
            } finally {
                this.isSubmitting = false;
            }
        },
        async editPayment(p) {
            this.isEdit = true;
            this.form = {
                id: p.id,
                target_key: `${p.target_type}:${p.target_id}`,
                payment_type: p.payment_type,
                payment_date: p.payment_date,
                amount: p.amount,
                invoice_id_union: p.invoice_id || p.supplier_invoice_id || "",
                receipt_path: p.receipt_path,
                remark: p.remark
            };
            
            // 编辑时也要加载账单列表，且包含当前已绑定的那个
            const [type, id] = this.form.target_key.split(':');
            try {
                const res = await fetch(`/api/unpaid-invoices?target_type=${type}&target_id=${id}`);
                const data = await res.json();
                if (data.success) {
                    this.unpaidInvoices = data.invoices;
                    // 如果有已绑定的账单，且不在列表中（因为它现在 is_paid=True），则需要手动加进去
                    if (this.form.invoice_id_union && !this.unpaidInvoices.find(x => x.id === this.form.invoice_id_union)) {
                        this.unpaidInvoices.push({
                            id: this.form.invoice_id_union,
                            label: p.linked_invoice + " (当前绑定)"
                        });
                    }
                }
            } catch (e) {
                console.error("加载未付账单失败", e);
            }
            
            this.showModal = true;
        },
        async deletePayment(p) {
            if (!confirm(`确定要删除与 ${p.target_name} 的这笔 ${p.payment_type} 记录吗？`)) return;
            try {
                const res = await fetch(`/api/payments/${p.id}`, { method: "DELETE" });
                const data = await res.json();
                if (data.success) {
                    this.loadPayments();
                } else {
                    alert("删除失败：" + data.message);
                }
            } catch (e) {
                alert("请求失败");
            }
        },
        viewFullImage(url) {
            this.previewImageUrl = url;
        }
    }
};
