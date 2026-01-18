const PayableInvoicePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">应付账单管理</h2>
            </div>

            <!-- 搜索区域 -->
            <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 200px; max-width: 300px;">
                        <label>供应商名称</label>
                        <select class="form-input" v-model="searchForm.supplier_id">
                            <option value="">全部供应商</option>
                            <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.full_name }}</option>
                        </select>
                    </div>
                    
                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 120px; max-width: 150px;">
                        <label>年份</label>
                        <select class="form-input" v-model="searchForm.year">
                            <option value="">全部</option>
                            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                        </select>
                    </div>

                    <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 100px; max-width: 120px;">
                        <label>月份</label>
                        <select class="form-input" v-model="searchForm.month">
                            <option value="">全部</option>
                            <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary" @click="resetSearch">重置</button>
                        <button class="btn btn-primary" @click="searchInvoices">搜索</button>
                    </div>
                </div>
            </div>

            <!-- 功能区 -->
            <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
                <button class="btn btn-primary" @click="openGenerateModal">生成供应商对账单</button>
            </div>

            <!-- 表格显示区 -->
            <div class="role-list-card" style="overflow: auto;">
                <table class="data-table" style="min-width: 1000px; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="width: 60px;">序号</th>
                            <th style="width: 120px;">账单周期</th>
                            <th>供应商名称</th>
                            <th style="width: 150px;">账单金额</th>
                            <th style="width: 100px;">状态</th>
                            <th style="width: 150px;">下载</th>
                            <th style="width: 200px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="invoices.length === 0">
                            <td colspan="7" style="text-align: center; color: #999; padding: 40px;">暂无账单数据</td>
                        </tr>
                        <tr v-for="(inv, index) in invoices" :key="inv.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ inv.period }}</td>
                            <td>{{ inv.supplier_name }}</td>
                            <td style="color: #f44336; font-weight: 600;">{{ formatAmount(inv.amount) }}</td>
                            <td>
                                <span v-if="inv.is_paid" style="color: #4caf50; font-weight: 600;">已付款</span>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>
                                <button class="btn-link" @click="downloadInvoice(inv)">
                                    下载
                                </button>
                            </td>
                            <td>
                                <button class="btn-link" @click="recalculateInvoice(inv)">重新计算</button>
                                <button class="btn-link btn-danger" @click="deleteInvoice(inv)">删除</button>
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

            <!-- 生成账单弹窗 -->
            <div v-if="showGenerateModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h3 class="modal-title">生成供应商对账单</h3>
                        <button class="modal-close" @click="showGenerateModal = false">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
                            请选择要生成的账单月份。系统将自动汇总该月份所有供应商的成本数据并生成/覆盖 Excel 账单。
                        </p>
                        <div class="form-row">
                            <div class="form-field">
                                <label>年份</label>
                                <select class="form-input" v-model="generateForm.year">
                                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label>月份</label>
                                <select class="form-input" v-model="generateForm.month">
                                    <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                                </select>
                            </div>
                        </div>
                        <div v-if="isGenerating" style="text-align: center; margin-top: 20px;">
                            <div class="loading-spinner" style="margin: 0 auto 10px;"></div>
                            <div style="font-size: 14px; color: var(--primary);">正在生成中，请稍候...</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" @click="showGenerateModal = false" :disabled="isGenerating">取消</button>
                        <button class="btn btn-primary" @click="submitGenerate" :disabled="isGenerating">
                            {{ isGenerating ? '生成中...' : '开始生成' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        const now = new Date();
        return {
            invoices: [],
            suppliers: [],
            pagination: {
                total: 0,
                totalPages: 0,
                currentPage: 1,
                perPage: 20
            },
            searchForm: {
                supplier_id: "",
                year: "",
                month: ""
            },
            showGenerateModal: false,
            isGenerating: false,
            currentTaskId: null,
            generateForm: {
                year: now.getFullYear(),
                month: now.getMonth() + 1
            },
            yearOptions: []
        };
    },
    mounted() {
        this.initYearOptions();
        this.fetchSuppliers();
        this.loadInvoices();
    },
    methods: {
        async fetchSuppliers() {
            try {
                const res = await fetch("/api/suppliers");
                const data = await res.json();
                if (data.success) {
                    this.suppliers = data.suppliers;
                }
            } catch (e) {
                console.error("加载供应商失败", e);
            }
        },
        initYearOptions() {
            const currentYear = new Date().getFullYear();
            for (let y = currentYear; y >= currentYear - 5; y--) {
                this.yearOptions.push(y);
            }
        },
        async loadInvoices() {
            try {
                const params = new URLSearchParams({
                    page: this.pagination.currentPage,
                    per_page: this.pagination.perPage,
                    supplier_id: this.searchForm.supplier_id,
                    year: this.searchForm.year,
                    month: this.searchForm.month
                });
                const res = await fetch(`/api/supplier-invoices?${params}`);
                const data = await res.json();
                if (data.success) {
                    this.invoices = data.invoices;
                    this.pagination.total = data.pagination.total;
                    this.pagination.totalPages = data.pagination.pages;
                    this.pagination.currentPage = data.pagination.current_page;
                }
            } catch (e) {
                console.error("加载应付账单失败", e);
            }
        },
        searchInvoices() {
            this.pagination.currentPage = 1;
            this.loadInvoices();
        },
        resetSearch() {
            this.searchForm = {
                supplier_id: "",
                year: "",
                month: ""
            };
            this.pagination.currentPage = 1;
            this.loadInvoices();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadInvoices();
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadInvoices();
        },
        formatAmount(amt) {
            return parseFloat(amt).toFixed(2);
        },
        openGenerateModal() {
            this.showGenerateModal = true;
            this.isGenerating = false;
        },
        async submitGenerate() {
            this.isGenerating = true;
            try {
                const res = await fetch("/api/supplier-invoices/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(this.generateForm)
                });
                const data = await res.json();
                if (data.success && data.task_id) {
                    this.currentTaskId = data.task_id;
                    this.isGenerating = false; // 立即关闭加载动画
                    // 立即显示任务已提交的提示
                    alert('供应商账单生成任务已提交，系统正在后台处理。\n处理完成后会自动弹窗通知您。');
                    this.pollTaskStatus(data.task_id);
                } else {
                    alert("提交失败：" + data.message);
                    this.isGenerating = false;
                }
            } catch (e) {
                alert("请求失败");
                this.isGenerating = false;
            }
        },
        async pollTaskStatus(taskId) {
            try {
                const res = await fetch(`/api/tasks/status/${taskId}`);
                const data = await res.json();
                
                if (data.success) {
                    if (data.status === 'SUCCESS') {
                        this.currentTaskId = null;
                        this.showGenerateModal = false;
                        alert(data.result_msg || "生成成功");
                        this.loadInvoices();
                    } else if (data.status === 'FAILURE') {
                        this.currentTaskId = null;
                        alert("生成失败: " + data.result_msg);
                    } else {
                        // 还在处理中，3秒后再次轮询
                        setTimeout(() => this.pollTaskStatus(taskId), 3000);
                    }
                } else {
                    this.currentTaskId = null;
                    alert("查询任务状态失败: " + data.message);
                }
            } catch (err) {
                console.error("轮询错误", err);
                setTimeout(() => this.pollTaskStatus(taskId), 5000);
            }
        },
        async recalculateInvoice(inv) {
            if (!confirm(`确定要重新计算供应商 ${inv.supplier_name} ${inv.period} 的账单吗？`)) return;
            try {
                const res = await fetch(`/api/supplier-invoices/${inv.id}/recalculate`, { method: "POST" });
                const data = await res.json();
                if (data.success) {
                    alert(data.message);
                    this.loadInvoices();
                } else {
                    alert("操作失败：" + data.message);
                }
            } catch (e) {
                alert("请求失败");
            }
        },
        async deleteInvoice(inv) {
            if (!confirm(`确定要删除供应商 ${inv.supplier_name} ${inv.period} 的账单记录及文件吗？`)) return;
            try {
                const res = await fetch(`/api/supplier-invoices/${inv.id}`, { method: "DELETE" });
                const data = await res.json();
                if (data.success) {
                    this.loadInvoices();
                } else {
                    if (data.message === '账单不存在') {
                        this.loadInvoices();
                    } else {
                        alert("删除失败：" + data.message);
                    }
                }
            } catch (e) {
                alert("请求失败");
            }
        },
        downloadInvoice(inv) {
            window.location.href = `/api/supplier-invoices/${inv.id}/download`;
        }
    }
};
