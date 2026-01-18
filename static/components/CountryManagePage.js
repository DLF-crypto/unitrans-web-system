const CountryManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">目的国管理</h2>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" @click="showImportModal = true">
                        📥 导入
                    </button>
                    <button class="btn btn-primary" @click="openCreateModal">
                        + 新增目的国
                    </button>
                </div>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>国家名称</th>
                            <th>国家二字代码</th>
                            <th>创建时间</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="countries.length === 0">
                            <td colspan="5" style="text-align: center; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-for="(country, index) in countries" :key="country.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ country.name }}</td>
                            <td><strong>{{ country.code }}</strong></td>
                            <td>{{ formatDate(country.created_at) }}</td>
                            <td>
                                <button class="btn-link" @click="openEditModal(country)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteCountry(country)">删除</button>
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
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑目的国' : '新增目的国' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>国家名称 <span style="color: #e57373;">*</span></label>
                            <input
                                type="text"
                                class="form-input"
                                v-model.trim="form.name"
                                placeholder="请输入国家名称"
                            />
                            <div v-if="errors.name" class="error-text">{{ errors.name }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>国家二字代码 <span style="color: #e57373;">*</span></label>
                            <input
                                type="text"
                                class="form-input"
                                v-model.trim="form.code"
                                placeholder="请输入2位国家代码（如：CN）"
                                maxlength="2"
                                style="text-transform: uppercase;"
                            />
                            <div v-if="errors.code" class="error-text">{{ errors.code }}</div>
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

            <!-- 导入弹窗 -->
            <div v-if="showImportModal" class="modal-overlay" @click.self="showImportModal = false">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">导入目的国数据</h3>
                        <button class="modal-close" @click="showImportModal = false">&times;</button>
                    </div>

                    <div class="modal-body">
                        <div style="margin-bottom: 20px; padding: 12px; background: #e5f4ef; border-radius: 8px; font-size: 13px; color: #3a8c76;">
                            <div style="font-weight: 500; margin-bottom: 8px;">📋 导入要求：</div>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li>支持格式：xls、xlsx、csv</li>
                                <li>必须包含表头：<strong>国家</strong>、<strong>国家二字代码</strong></li>
                                <li>国家代码必须是2个字符</li>
                                <li>已存在的国家代码将被跳过</li>
                            </ul>
                        </div>

                        <div class="form-field">
                            <label>选择文件 <span style="color: #e57373;">*</span></label>
                            <input
                                type="file"
                                class="form-input"
                                @change="handleFileSelect"
                                accept=".xls,.xlsx,.csv"
                            />
                        </div>

                        <div v-if="importResult" style="margin-top: 16px; padding: 12px; border-radius: 8px;"
                             :style="{ background: importResult.success ? '#e5f4ef' : '#fce4e4', color: importResult.success ? '#3a8c76' : '#e57373' }">
                            <div style="font-weight: 500; margin-bottom: 4px;">{{ importResult.message }}</div>
                            <div v-if="importResult.errors && importResult.errors.length > 0" style="font-size: 12px; margin-top: 8px;">
                                <div>错误详情：</div>
                                <ul style="margin: 4px 0; padding-left: 20px;">
                                    <li v-for="(error, index) in importResult.errors" :key="index">{{ error }}</li>
                                </ul>
                            </div>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="showImportModal = false">取消</button>
                            <button type="button" class="btn btn-primary" @click="submitImport" :disabled="!selectedFile || importing">
                                <span v-if="!importing">确认导入</span>
                                <span v-else>导入中...</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            countries: [],
            pagination: {
                total: 0,
                pages: 0,
                currentPage: 1,
                perPage: 20
            },
            showModal: false,
            showImportModal: false,
            isEdit: false,
            form: {
                id: null,
                name: "",
                code: ""
            },
            errors: {
                name: "",
                code: ""
            },
            submitting: false,
            selectedFile: null,
            importing: false,
            importResult: null
        };
    },
    mounted() {
        this.loadCountries();
    },
    methods: {
        async loadCountries() {
            try {
                const res = await fetch(`/api/countries?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await res.json();
                if (data.success) {
                    this.countries = data.countries;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载目的国列表失败", e);
            }
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = { id: null, name: "", code: "" };
            this.errors = { name: "", code: "" };
            this.showModal = true;
        },
        openEditModal(country) {
            this.isEdit = true;
            this.form = {
                id: country.id,
                name: country.name,
                code: country.code
            };
            this.errors = { name: "", code: "" };
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.form = { id: null, name: "", code: "" };
            this.errors = { name: "", code: "" };
        },
        validateForm() {
            this.errors = { name: "", code: "" };
            let valid = true;

            if (!this.form.name) {
                this.errors.name = "请输入国家名称";
                valid = false;
            }

            if (!this.form.code) {
                this.errors.code = "请输入国家代码";
                valid = false;
            } else if (this.form.code.length !== 2) {
                this.errors.code = "国家代码必须是2个字符";
                valid = false;
            }

            return valid;
        },
        async submitForm() {
            if (!this.validateForm()) return;

            this.submitting = true;

            try {
                const url = this.isEdit ? `/api/countries/${this.form.id}` : "/api/countries";
                const method = this.isEdit ? "PUT" : "POST";

                const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: this.form.name,
                        code: this.form.code
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
                this.loadCountries();
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.submitting = false;
            }
        },
        async deleteCountry(country) {
            if (!confirm(`确定要删除目的国"${country.name} (${country.code})"吗？`)) {
                return;
            }

            try {
                const res = await fetch(`/api/countries/${country.id}`, {
                    method: "DELETE"
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    alert(data.message || "删除失败");
                    return;
                }

                alert("删除成功");
                this.loadCountries();
            } catch (e) {
                alert("删除失败，请稍后重试");
            }
        },
        handleFileSelect(event) {
            this.selectedFile = event.target.files[0];
            this.importResult = null;
        },
        async submitImport() {
            if (!this.selectedFile) {
                alert("请选择文件");
                return;
            }

            this.importing = true;
            this.importResult = null;

            try {
                const formData = new FormData();
                formData.append("file", this.selectedFile);

                const res = await fetch("/api/countries/import", {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();
                this.importResult = data;

                if (data.success) {
                    this.loadCountries();
                    // 清空文件选择
                    this.selectedFile = null;
                    const fileInput = document.querySelector('input[type="file"]');
                    if (fileInput) fileInput.value = "";
                }
            } catch (e) {
                this.importResult = {
                    success: false,
                    message: "导入失败，请稍后重试"
                };
            } finally {
                this.importing = false;
            }
        },
        formatDate(dateStr) {
            if (!dateStr) return "-";
            const date = new Date(dateStr);
            return date.toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.loadCountries();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadCountries();
        }
    }
};
