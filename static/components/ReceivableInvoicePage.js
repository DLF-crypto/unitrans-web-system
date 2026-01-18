const ReceivableInvoicePage = {
    template: `
    <div class="page-container">
        <!-- 加载遮罩层 -->
        <div v-if="isGenerating" class="modal-overlay" style="z-index: 2000; background: rgba(255,255,255,0.7); flex-direction: column;">
            <div class="loading-spinner"></div>
            <div style="margin-top: 15px; color: var(--primary-dark); font-weight: 600; font-size: 16px;">
                账单正在生成中，请稍候...
            </div>
            <div style="margin-top: 8px; color: var(--text-sub); font-size: 13px;">
                系统正在处理数据并填充 Excel 模板，这可能需要较长时间。
            </div>
        </div>

        <div class="page-header">
            <h2 class="page-title">应收账单管理</h2>
        </div>

        <!-- 搜索区域 -->
        <div class="search-card" style="margin-bottom: 20px; padding: 16px; background: white; border-radius: 8px;">
            <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 250px;">
                    <label>客户名称</label>
                    <select v-model="filters.customer_id" class="form-input">
                        <option value="">全部客户</option>
                        <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.full_name }}</option>
                    </select>
                </div>
                <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 150px; max-width: 200px;">
                    <label>收费类别</label>
                    <select v-model="filters.fee_type" class="form-input">
                        <option value="">全部类别</option>
                        <option value="单号收费">单号收费</option>
                        <option value="头程收费">头程收费</option>
                        <option value="尾程收费">尾程收费</option>
                        <option value="差价收费">差价收费</option>
                    </select>
                </div>
                <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 100px; max-width: 120px;">
                    <label>年份</label>
                    <select v-model="filters.year" class="form-input">
                        <option value="">全部</option>
                        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
                    </select>
                </div>
                <div class="form-field" style="margin-bottom: 0; flex: 1; min-width: 100px; max-width: 120px;">
                    <label>月份</label>
                    <select v-model="filters.month" class="form-input">
                        <option value="">全部</option>
                        <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                    </select>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary" @click="resetFilters">重置</button>
                    <button class="btn btn-primary" @click="fetchInvoices">搜索</button>
                </div>
            </div>
        </div>

        <!-- 功能按钮区域 -->
        <div style="margin-bottom: 16px; display: flex; gap: 12px; align-items: center;">
            <button class="btn btn-primary" @click="showGenerateModal = true" :disabled="isGenerating">
                生成客户账单
            </button>
        </div>

        <!-- 列表区域 -->
        <div class="role-list-card">
            <table class="data-table" style="min-width: 1000px;">
                <thead>
                    <tr>
                        <th style="width: 60px;">序号</th>
                        <th style="width: 120px;">账单周期</th>
                        <th>客户名称</th>
                        <th>收费类别</th>
                        <th style="width: 120px;">账单金额</th>
                        <th style="width: 100px;">状态</th>
                        <th style="width: 80px;">下载</th>
                        <th style="width: 180px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(inv, index) in invoices" :key="inv.id">
                        <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                        <td>{{ inv.year }}年{{ inv.month }}月</td>
                        <td>{{ inv.customer_name }}</td>
                        <td>{{ inv.fee_type }}</td>
                        <td style="color: #2196F3; font-weight: 500;">{{ formatAmount(inv.amount) }}</td>
                        <td>
                            <span v-if="inv.is_paid" style="color: #4caf50; font-weight: 600;">已收款</span>
                            <span v-else style="color: #999;">-</span>
                        </td>
                        <td>
                            <button class="btn-link" @click="downloadInvoice(inv)">下载</button>
                        </td>
                        <td>
                            <button class="btn-link" @click="recalculateInvoice(inv)">重新计算</button>
                            <button class="btn-link btn-danger" @click="deleteInvoice(inv)">删除</button>
                        </td>
                    </tr>
                    <tr v-if="invoices.length === 0">
                        <td colspan="8" style="text-align: center; color: #999; padding: 40px;">暂无数据</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 分页控件 -->
        <div v-if="invoices.length > 0" class="pagination-container">
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
                <span class="page-current">{{ pagination.currentPage }} / {{ pagination.totalPages }}</span>
                <button class="btn-page" :disabled="pagination.currentPage === pagination.totalPages" @click="changePage(pagination.currentPage + 1)">下一页</button>
                <button class="btn-page" :disabled="pagination.currentPage === pagination.totalPages" @click="changePage(pagination.totalPages)">末页</button>
            </div>
        </div>

        <!-- 生成账单弹窗 -->
        <div v-if="showGenerateModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>生成客户账单</h3>
                </div>
                <div class="modal-body">
                    <div class="form-field">
                        <label>年份</label>
                        <select v-model="generateForm.year" class="form-input">
                            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label>月份</label>
                        <select v-model="generateForm.month" class="form-input">
                            <option v-for="m in 12" :key="m" :value="m">{{ m }}月</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="showGenerateModal = false" :disabled="isGenerating">取消</button>
                    <button class="btn btn-primary" @click="confirmGenerate" :disabled="isGenerating">
                        {{ isGenerating ? '正在生成...' : '确定生成' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
    `,
    data() {
        return {
            invoices: [],
            customers: [],
            products: [],
            filters: {
                customer_id: '',
                fee_type: '',
                year: '',
                month: ''
            },
            showGenerateModal: false,
            isGenerating: false,
            currentTaskId: null,
            generateForm: {
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1
            },
            yearOptions: [],
            pagination: {
                total: 0,
                totalPages: 0,
                currentPage: 1,
                perPage: 20
            }
        };
    },
    created() {
        this.initYearOptions();
        this.fetchBaseData();
        this.fetchInvoices();
    },
    methods: {
        initYearOptions() {
            const currentYear = new Date().getFullYear();
            for (let y = currentYear - 2; y <= currentYear + 1; y++) {
                this.yearOptions.push(y);
            }
        },
        async fetchBaseData() {
            try {
                const [custRes, prodRes] = await Promise.all([
                    fetch('/api/customers'),
                    fetch('/api/products')
                ]);
                const custData = await custRes.json();
                const prodData = await prodRes.json();
                if (custData.success) this.customers = custData.customers;
                if (prodData.success) this.products = prodData.products;
            } catch (err) {
                console.error("加载基础资料失败", err);
            }
        },
        async fetchInvoices() {
            const params = new URLSearchParams();
            Object.keys(this.filters).forEach(key => {
                if (this.filters[key]) params.append(key, this.filters[key]);
            });
            params.append('page', this.pagination.currentPage);
            params.append('per_page', this.pagination.perPage);
            
            try {
                const res = await fetch(`/api/invoices?${params}`);
                const data = await res.json();
                if (data.success) {
                    this.invoices = data.invoices;
                    this.pagination.total = data.total;
                    this.pagination.totalPages = data.pages;
                    this.pagination.currentPage = data.current_page;
                }
            } catch (err) {
                alert("加载账单列表失败");
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.fetchInvoices();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.fetchInvoices();
        },
        resetFilters() {
            this.filters = {
                customer_id: '',
                fee_type: '',
                year: '',
                month: ''
            };
            this.pagination.currentPage = 1;
            this.fetchInvoices();
        },
        formatAmount(amt) {
            if (!amt) return '0.00';
            return parseFloat(amt).toFixed(2);
        },
        async downloadInvoice(inv) {
            window.open(`/api/invoices/${inv.id}/download`, '_blank');
        },
        async confirmGenerate() {
            this.isGenerating = true;
            try {
                const res = await fetch('/api/invoices/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.generateForm)
                });
                const data = await res.json();
                if (data.success && data.task_id) {
                    this.currentTaskId = data.task_id;
                    this.showGenerateModal = false;
                    this.isGenerating = false; // 立即关闭加载动画
                    // 立即显示任务已提交的提示
                    alert('账单生成任务已提交，系统正在后台处理。\n处理完成后会自动弹窗通知您，您可以关闭浏览器或处理其他事务。');
                    // 开始轮询任务状态
                    this.pollTaskStatus(data.task_id);
                } else {
                    alert(data.message || "提交失败");
                    this.isGenerating = false;
                }
            } catch (err) {
                alert("生成请求失败");
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
                        alert(data.result_msg || "生成成功");
                        this.fetchInvoices();
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
                // 发生错误也继续轮询几次，防止网络瞬断
                setTimeout(() => this.pollTaskStatus(taskId), 5000);
            }
        },
        async recalculateInvoice(inv) {
            if (!confirm(`确定重新计算 ${inv.customer_name} 在 ${inv.year}年${inv.month}月 的账单吗？`)) return;
            this.isGenerating = true;
            try {
                const res = await fetch(`/api/invoices/${inv.id}/recalculate`, {
                    method: 'POST'
                });
                const data = await res.json();
                if (data.success) {
                    alert("重新计算完成");
                    this.fetchInvoices();
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("请求失败");
            } finally {
                this.isGenerating = false;
            }
        },
        async deleteInvoice(inv) {
            if (!confirm(`确定删除 ${inv.customer_name} 的该条账单记录及文件吗？`)) return;
            try {
                const res = await fetch(`/api/invoices/${inv.id}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    alert("删除成功");
                    this.fetchInvoices();
                } else {
                    // 如果提示账单不存在，说明服务器已经没有该记录了，直接刷新前端列表
                    if (data.message === '账单不存在') {
                        this.fetchInvoices();
                    } else {
                        alert(data.message);
                    }
                }
            } catch (err) {
                alert("删除失败");
            }
        }
    }
};

window.ReceivableInvoicePage = ReceivableInvoicePage;
