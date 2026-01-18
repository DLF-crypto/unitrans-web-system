const SupplierManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">供应商管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">
                    + 新增供应商
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>供应商全称</th>
                            <th>供应商简称</th>
                            <th>联系人</th>
                            <th>邮箱</th>
                            <th>备注</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="suppliers.length === 0">
                            <td colspan="7" style="text-align: center; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-for="(supplier, index) in suppliers" :key="supplier.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ supplier.full_name }}</td>
                            <td>{{ supplier.short_name }}</td>
                            <td>
                                <span v-if="supplier.contact_person">{{ supplier.contact_person }}</span>
                                <span v-else style="color: #ccc;">-</span>
                            </td>
                            <td>
                                <span v-if="supplier.email">{{ supplier.email }}</span>
                                <span v-else style="color: #ccc;">-</span>
                            </td>
                            <td>
                                <span v-if="supplier.remark" style="color: #6b8a80; font-size: 13px;">{{ supplier.remark }}</span>
                                <span v-else style="color: #ccc;">-</span>
                            </td>
                            <td>
                                <button class="btn-link" @click="openEditModal(supplier)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteSupplier(supplier)">删除</button>
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

            <!-- 新增/编辑弹窗 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 650px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑供应商' : '新增供应商' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-row" style="margin-bottom: 16px;">
                            <div class="form-field">
                                <label>供应商全称 <span style="color: #e57373;">*</span></label>
                                <input
                                    type="text"
                                    class="form-input"
                                    v-model.trim="form.full_name"
                                    placeholder="请输入供应商全称"
                                />
                                <div v-if="errors.full_name" class="error-text">{{ errors.full_name }}</div>
                            </div>

                            <div class="form-field">
                                <label>供应商简称 <span style="color: #e57373;">*</span></label>
                                <input
                                    type="text"
                                    class="form-input"
                                    v-model.trim="form.short_name"
                                    placeholder="请输入供应商简称"
                                />
                                <div v-if="errors.short_name" class="error-text">{{ errors.short_name }}</div>
                            </div>
                        </div>

                        <div class="form-row" style="margin-bottom: 16px;">
                            <div class="form-field">
                                <label>联系人</label>
                                <input
                                    type="text"
                                    class="form-input"
                                    v-model.trim="form.contact_person"
                                    placeholder="请输入联系人"
                                />
                                <div v-if="errors.contact_person" class="error-text">{{ errors.contact_person }}</div>
                            </div>

                            <div class="form-field">
                                <label>邮箱</label>
                                <input
                                    type="email"
                                    class="form-input"
                                    v-model.trim="form.email"
                                    placeholder="请输入邮箱"
                                />
                                <div v-if="errors.email" class="error-text">{{ errors.email }}</div>
                            </div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>备注</label>
                            <textarea
                                class="form-input"
                                v-model.trim="form.remark"
                                placeholder="请输入备注信息"
                                rows="3"
                                style="resize: vertical;"
                            ></textarea>
                            <div v-if="errors.remark" class="error-text">{{ errors.remark }}</div>
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
            suppliers: [],
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 20
            },
            showModal: false,
            isEdit: false,
            form: {
                id: null,
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            },
            errors: {
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            },
            submitting: false
        };
    },
    mounted() {
        this.loadSuppliers();
    },
    methods: {
        async loadSuppliers() {
            try {
                const res = await fetch(`/api/suppliers?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await res.json();
                if (data.success) {
                    this.suppliers = data.suppliers;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载供应商列表失败", e);
            }
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = {
                id: null,
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
            this.errors = {
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
            this.showModal = true;
        },
        openEditModal(supplier) {
            this.isEdit = true;
            this.form = {
                id: supplier.id,
                full_name: supplier.full_name,
                short_name: supplier.short_name,
                contact_person: supplier.contact_person || "",
                email: supplier.email || "",
                remark: supplier.remark || ""
            };
            this.errors = {
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.form = {
                id: null,
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
            this.errors = {
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
        },
        validateForm() {
            this.errors = {
                full_name: "",
                short_name: "",
                contact_person: "",
                email: "",
                remark: ""
            };
            let valid = true;

            if (!this.form.full_name) {
                this.errors.full_name = "请输入供应商全称";
                valid = false;
            }

            if (!this.form.short_name) {
                this.errors.short_name = "请输入供应商简称";
                valid = false;
            }

            // 验证邮箱格式（如果填写了）
            if (this.form.email) {
                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailPattern.test(this.form.email)) {
                    this.errors.email = "邮箱格式不正确";
                    valid = false;
                }
            }

            return valid;
        },
        async submitForm() {
            if (!this.validateForm()) return;

            this.submitting = true;

            try {
                const url = this.isEdit ? `/api/suppliers/${this.form.id}` : "/api/suppliers";
                const method = this.isEdit ? "PUT" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        full_name: this.form.full_name,
                        short_name: this.form.short_name,
                        contact_person: this.form.contact_person,
                        email: this.form.email,
                        remark: this.form.remark
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
                this.loadSuppliers();
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.submitting = false;
            }
        },
        async deleteSupplier(supplier) {
            if (!confirm(`确定要删除供应商"${supplier.full_name}"吗？`)) {
                return;
            }

            try {
                const res = await fetch(`/api/suppliers/${supplier.id}`, {
                    method: "DELETE"
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    alert(data.message || "删除失败");
                    return;
                }

                alert("删除成功");
                this.loadSuppliers();
            } catch (e) {
                alert("删除失败，请稍后重试");
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadSuppliers();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadSuppliers();
        }
    }
};
