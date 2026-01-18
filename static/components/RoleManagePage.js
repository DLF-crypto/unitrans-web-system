// 角色管理页面组件
const RoleManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">角色管理</h2>
                <button class="btn btn-primary" @click="showModal = true">
                    <span>+ 新增角色</span>
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">序号</th>
                            <th>角色名称</th>
                            <th>角色说明</th>
                            <th style="width: 150px;">创建时间</th>
                            <th style="width: 140px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-sub);">
                                加载中...
                            </td>
                        </tr>
                        <tr v-else-if="roles.length === 0">
                            <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-sub);">
                                暂无角色数据，点击右上角"新增角色"创建
                            </td>
                        </tr>
                        <tr v-else v-for="(role, index) in roles" :key="role.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ role.name }}</td>
                            <td>{{ role.description || '-' }}</td>
                            <td>{{ formatDate(role.created_at) }}</td>
                            <td>
                                <button class="btn-link" @click="editRole(role)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteRole(role)">删除</button>
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

            <!-- 新增/编辑角色弹窗 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑角色' : '新增角色' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitRole" class="modal-body">
                        <div class="form-row">
                            <div class="form-field">
                                <label>角色名称 <span style="color: #e57373;">*</span></label>
                                <input
                                    type="text"
                                    class="form-input"
                                    v-model.trim="roleForm.name"
                                    placeholder="例如：系统管理员、财务审核"
                                />
                                <div v-if="roleErrors.name" class="error-text">{{ roleErrors.name }}</div>
                            </div>

                            <div class="form-field">
                                <label>角色说明</label>
                                <textarea
                                    rows="2"
                                    class="form-input"
                                    v-model.trim="roleForm.description"
                                    placeholder="简要说明该角色负责的业务范围"
                                ></textarea>
                            </div>
                        </div>

                        <div class="form-section">
                            <div class="form-section-title">页面权限配置（按页面细分"查看 / 增 / 改 / 删"权限）</div>
                            <table class="permission-table">
                                <thead>
                                    <tr>
                                        <th style="width: 120px;">所属模块</th>
                                        <th>页面</th>
                                        <th style="width: 60px;">可查看</th>
                                        <th style="width: 60px;">可新增</th>
                                        <th style="width: 60px;">可修改</th>
                                        <th style="width: 60px;">可删除</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="page in rolePages" :key="page.pageKey">
                                        <td class="permission-group">{{ page.group }}</td>
                                        <td>{{ page.title }}</td>
                                        <td><input type="checkbox" v-model="page.canView" /></td>
                                        <td><input type="checkbox" v-model="page.canCreate" /></td>
                                        <td><input type="checkbox" v-model="page.canUpdate" /></td>
                                        <td><input type="checkbox" v-model="page.canDelete" /></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
                            <button type="submit" class="btn btn-primary" :disabled="roleSubmitting">
                                <span v-if="!roleSubmitting">{{ isEdit ? '保存修改' : '立即创建' }}</span>
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
            roles: [],
            loading: false,
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 20
            },
            showModal: false,
            isEdit: false,
            roleForm: { id: null, name: "", description: "" },
            roleErrors: { name: "" },
            roleSubmitting: false,
            rolePages: [
                { pageKey: "dashboard", group: "仪表盘", title: "仪表盘", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.role", group: "基础资料管理", title: "角色管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.user", group: "基础资料管理", title: "用户管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.country", group: "基础资料管理", title: "目的国管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.product", group: "基础资料管理", title: "产品管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.customer", group: "基础资料管理", title: "客户管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "basic.supplier", group: "基础资料管理", title: "供应商管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "waybill.main", group: "运单数据管理", title: "运单数据管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "finance.ar_bill", group: "财务管理", title: "应收账单管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "finance.ap_bill", group: "财务管理", title: "应付账单管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "finance.payment", group: "财务管理", title: "收付款管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "finance.customer_quote", group: "财务管理", title: "客户报价管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
                { pageKey: "finance.supplier_quote", group: "财务管理", title: "供应商报价管理", canView: false, canCreate: false, canUpdate: false, canDelete: false },
            ],
        };
    },
    mounted() {
        this.fetchRoles();
    },
    methods: {
        async fetchRoles() {
            this.loading = true;
            try {
                const res = await fetch(`/api/roles?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await res.json();
                if (data.success) {
                    this.roles = data.roles || [];
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载角色列表失败", e);
            } finally {
                this.loading = false;
            }
        },
        formatDate(dateStr) {
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
        editRole(role) {
            this.isEdit = true;
            this.roleForm.id = role.id;
            this.roleForm.name = role.name;
            this.roleForm.description = role.description || "";
            
            // 重置权限
            this.rolePages.forEach(p => {
                p.canView = false;
                p.canCreate = false;
                p.canUpdate = false;
                p.canDelete = false;
            });
            
            // 加载角色的权限
            if (role.permissions && role.permissions.length > 0) {
                role.permissions.forEach(perm => {
                    const page = this.rolePages.find(p => p.pageKey === perm.page_key);
                    if (page) {
                        page.canView = perm.can_view;
                        page.canCreate = perm.can_create;
                        page.canUpdate = perm.can_update;
                        page.canDelete = perm.can_delete;
                    }
                });
            }
            
            this.showModal = true;
        },
        deleteRole(role) {
            if (!confirm(`确定要删除角色"${role.name}"吗？此操作不可恢复！`)) {
                return;
            }
            
            fetch(`/api/roles/${role.id}`, { method: "DELETE" })
                .then(async res => {
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data.success) {
                        alert(data.message || "删除失败");
                        return;
                    }
                    alert("角色已删除");
                    this.fetchRoles();
                })
                .catch(() => alert("删除失败，请稍后重试"));
        },
        closeModal() {
            this.showModal = false;
            this.isEdit = false;
            this.resetForm();
        },
        resetForm() {
            this.roleForm = { id: null, name: "", description: "" };
            this.roleErrors = { name: "" };
            this.rolePages.forEach(p => {
                p.canView = false;
                p.canCreate = false;
                p.canUpdate = false;
                p.canDelete = false;
            });
        },
        validateForm() {
            this.roleErrors.name = "";
            if (!this.roleForm.name.trim()) {
                this.roleErrors.name = "请输入角色名称";
                return false;
            }
            return true;
        },
        async submitRole() {
            if (!this.validateForm()) return;
            
            this.roleSubmitting = true;
            const url = this.isEdit ? `/api/roles/${this.roleForm.id}` : "/api/roles";
            const method = this.isEdit ? "PUT" : "POST";
            
            try {
                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: this.roleForm.name,
                        description: this.roleForm.description,
                        permissions: this.rolePages.map(p => ({
                            pageKey: p.pageKey,
                            canView: p.canView,
                            canCreate: p.canCreate,
                            canUpdate: p.canUpdate,
                            canDelete: p.canDelete,
                        })),
                    }),
                });
                
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) {
                    alert(data.message || "操作失败");
                    return;
                }
                
                alert(this.isEdit ? "角色已更新" : "角色已创建");
                this.closeModal();
                this.fetchRoles();
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.roleSubmitting = false;
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.fetchRoles();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.fetchRoles();
        },
    },
};

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RoleManagePage };
}
