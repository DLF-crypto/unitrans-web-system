const ProductManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">产品管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">
                    + 新增产品
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>产品名称</th>
                            <th>产品描述</th>
                            <th>收费类别</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="products.length === 0">
                            <td colspan="5" style="text-align: center; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-for="(product, index) in products" :key="product.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ product.name }}</td>
                            <td>
                                <span v-if="product.description" style="color: #6b8a80; font-size: 13px;">
                                    {{ product.description }}
                                </span>
                                <span v-else style="color: #ccc;">-</span>
                            </td>
                            <td>
                                <span v-for="(type, index) in product.fee_types" :key="index" 
                                      style="display: inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; background: #e5f4ef; color: #3a8c76; border-radius: 4px; font-size: 12px;">
                                    {{ type }}
                                </span>
                            </td>
                            <td>
                                <button class="btn-link" @click="openEditModal(product)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteProduct(product)">删除</button>
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
                <div class="modal-content" style="max-width: 550px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑产品' : '新增产品' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-field" style="margin-bottom: 20px;">
                            <label>产品名称 <span style="color: #e57373;">*</span></label>
                            <input
                                type="text"
                                class="form-input"
                                v-model.trim="form.name"
                                placeholder="请输入产品名称"
                            />
                            <div v-if="errors.name" class="error-text">{{ errors.name }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 20px;">
                            <label>产品描述 <span style="color: #6b8a80; font-size: 12px;">(最多100字)</span></label>
                            <textarea
                                class="form-input"
                                v-model.trim="form.description"
                                placeholder="请输入产品描述"
                                rows="3"
                                maxlength="100"
                                style="resize: vertical;"
                            ></textarea>
                            <div style="font-size: 11px; color: #6b8a80; margin-top: 4px; text-align: right;">
                                {{ form.description.length }}/100
                            </div>
                            <div v-if="errors.description" class="error-text">{{ errors.description }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 20px;">
                            <label>收费类别 <span style="color: #e57373;">*</span> <span style="color: #6b8a80; font-size: 12px;">（可多选）</span></label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
                                <label v-for="type in feeTypeOptions" :key="type" 
                                       style="display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; transition: all 0.16s ease;"
                                       :style="{ 
                                           background: form.fee_types.includes(type) ? 'var(--primary-soft)' : '#ffffff',
                                           borderColor: form.fee_types.includes(type) ? 'var(--primary)' : 'var(--border-color)'
                                       }">
                                    <input 
                                        type="checkbox" 
                                        :value="type" 
                                        v-model="form.fee_types"
                                        style="width: 16px; height: 16px; cursor: pointer;"
                                    />
                                    <span style="font-size: 14px;">{{ type }}</span>
                                </label>
                            </div>
                            <div v-if="errors.fee_types" class="error-text" style="margin-top: 4px;">{{ errors.fee_types }}</div>
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
            products: [],
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
                name: "",
                description: "",
                fee_types: []
            },
            errors: {
                name: "",
                description: "",
                fee_types: ""
            },
            submitting: false,
            feeTypeOptions: ["单号收费", "头程收费", "尾程收费", "差价收费"]
        };
    },
    mounted() {
        this.loadProducts();
    },
    methods: {
        async loadProducts() {
            try {
                const res = await fetch(`/api/products?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await res.json();
                if (data.success) {
                    this.products = data.products;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载产品列表失败", e);
            }
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = { id: null, name: "", description: "", fee_types: [] };
            this.errors = { name: "", description: "", fee_types: "" };
            this.showModal = true;
        },
        openEditModal(product) {
            this.isEdit = true;
            this.form = {
                id: product.id,
                name: product.name,
                description: product.description || "",
                fee_types: [...product.fee_types]
            };
            this.errors = { name: "", description: "", fee_types: "" };
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.form = { id: null, name: "", description: "", fee_types: [] };
            this.errors = { name: "", description: "", fee_types: "" };
        },
        validateForm() {
            this.errors = { name: "", description: "", fee_types: "" };
            let valid = true;

            if (!this.form.name) {
                this.errors.name = "请输入产品名称";
                valid = false;
            }

            if (this.form.description && this.form.description.length > 100) {
                this.errors.description = "产品描述最多100字";
                valid = false;
            }

            if (!this.form.fee_types || this.form.fee_types.length === 0) {
                this.errors.fee_types = "请至少选择一种收费类别";
                valid = false;
            }

            return valid;
        },
        async submitForm() {
            if (!this.validateForm()) return;

            this.submitting = true;

            try {
                const url = this.isEdit ? `/api/products/${this.form.id}` : "/api/products";
                const method = this.isEdit ? "PUT" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: this.form.name,
                        description: this.form.description,
                        fee_types: this.form.fee_types
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
                this.loadProducts();
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.submitting = false;
            }
        },
        async deleteProduct(product) {
            if (!confirm(`确定要删除产品"${product.name}"吗？`)) {
                return;
            }

            try {
                const res = await fetch(`/api/products/${product.id}`, {
                    method: "DELETE"
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    alert(data.message || "删除失败");
                    return;
                }

                alert("删除成功");
                this.loadProducts();
            } catch (e) {
                alert("删除失败，请稍后重试");
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadProducts();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadProducts();
        }
    }
};
