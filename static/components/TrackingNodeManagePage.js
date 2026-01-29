const TrackingNodeManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">轨迹节点状态管理</h2>
                <button class="btn btn-primary" @click="openCreateModal">
                    + 新增状态
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>状态代码</th>
                            <th>状态说明</th>
                            <th>默认位置信息</th>
                            <th>创建时间</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="6" style="text-align: center; padding: 40px;">加载中...</td>
                        </tr>
                        <tr v-else-if="nodes.length === 0">
                            <td colspan="6" style="text-align: center; padding: 40px; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-else v-for="(node, index) in nodes" :key="node.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ node.status_code }}</td>
                            <td>{{ node.status_description }}</td>
                            <td>
                                <div v-if="node.default_city || node.default_country_code || node.default_airport_code" style="font-size: 13px; line-height: 1.6;">
                                    <span v-if="node.default_city" style="display: block;">城市：{{ node.default_city }}</span>
                                    <span v-if="node.default_country_code" style="display: block;">国家：{{ node.default_country_code }}</span>
                                    <span v-if="node.default_airport_code" style="display: block;">机场：{{ node.default_airport_code }}</span>
                                </div>
                                <span v-else style="color: #999;">-</span>
                            </td>
                            <td>{{ formatDateTime(node.created_at) }}</td>
                            <td>
                                <button class="btn-link" @click="openEditModal(node)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteNode(node)">删除</button>
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

            <!-- 创建/编辑模态框 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 550px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑状态' : '新增状态' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>状态代码 <span style="color: #e57373;">*</span></label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.status_code" 
                                placeholder="请输入状态代码"
                                maxlength="32"
                            />
                            <div v-if="errors.status_code" class="error-text">{{ errors.status_code }}</div>
                        </div>
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>状态说明 <span style="color: #e57373;">*</span></label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.status_description" 
                                placeholder="请输入状态说明"
                                maxlength="128"
                            />
                            <div v-if="errors.status_description" class="error-text">{{ errors.status_description }}</div>
                        </div>
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>默认城市</label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.default_city" 
                                placeholder="请输入默认城市（可选）"
                                maxlength="64"
                            />
                        </div>
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>默认国家代码</label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.default_country_code" 
                                placeholder="如：CN、US（可选）"
                                maxlength="3"
                            />
                        </div>
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>默认机场三字代码</label>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.default_airport_code" 
                                placeholder="如：PVG、LAX（可选）"
                                maxlength="3"
                            />
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
            nodes: [],
            loading: false,
            showModal: false,
            isEdit: false,
            submitting: false,
            form: {
                status_code: '',
                status_description: '',
                default_city: '',
                default_country_code: '',
                default_airport_code: ''
            },
            errors: {},
            pagination: {
                currentPage: 1,
                perPage: 20,
                total: 0,
                pages: 0
            }
        };
    },
    mounted() {
        this.loadNodes();
    },
    methods: {
        async loadNodes() {
            this.loading = true;
            try {
                const resp = await fetch(`/api/tracking-nodes?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await resp.json();
                if (data.success) {
                    this.nodes = data.nodes;
                    this.pagination.total = data.pagination.total;
                    this.pagination.pages = data.pagination.pages;
                    this.pagination.currentPage = data.pagination.current_page;
                    this.pagination.perPage = data.pagination.per_page;
                } else {
                    alert(data.message || '加载失败');
                }
            } catch (error) {
                console.error('加载失败:', error);
                alert('加载失败，请稍后重试');
            } finally {
                this.loading = false;
            }
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = {
                status_code: '',
                status_description: '',
                default_city: '',
                default_country_code: '',
                default_airport_code: ''
            };
            this.errors = {};
            this.showModal = true;
        },
        openEditModal(node) {
            this.isEdit = true;
            this.form = {
                id: node.id,
                status_code: node.status_code,
                status_description: node.status_description,
                default_city: node.default_city || '',
                default_country_code: node.default_country_code || '',
                default_airport_code: node.default_airport_code || ''
            };
            this.errors = {};
            this.showModal = true;
        },
        closeModal() {
            this.showModal = false;
            this.errors = {};
        },
        validateForm() {
            this.errors = {};
            let valid = true;

            if (!this.form.status_code) {
                this.errors.status_code = '状态代码不能为空';
                valid = false;
            }

            if (!this.form.status_description) {
                this.errors.status_description = '状态说明不能为空';
                valid = false;
            }

            return valid;
        },
        async submitForm() {
            if (!this.validateForm()) {
                return;
            }

            this.submitting = true;
            try {
                const url = this.isEdit ? `/api/tracking-nodes/${this.form.id}` : '/api/tracking-nodes';
                const method = this.isEdit ? 'PUT' : 'POST';
                
                const resp = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.form)
                });
                
                const data = await resp.json();
                if (data.success) {
                    alert(this.isEdit ? '修改成功' : '创建成功');
                    this.closeModal();
                    this.loadNodes();
                } else {
                    if (data.field && data.message) {
                        this.errors[data.field] = data.message;
                    } else {
                        alert(data.message || '操作失败');
                    }
                }
            } catch (error) {
                console.error('提交失败:', error);
                alert('操作失败，请稍后重试');
            } finally {
                this.submitting = false;
            }
        },
        async deleteNode(node) {
            if (!confirm(`确定要删除状态"${node.status_code}"吗？`)) {
                return;
            }

            try {
                const resp = await fetch(`/api/tracking-nodes/${node.id}`, {
                    method: 'DELETE'
                });
                const data = await resp.json();
                if (data.success) {
                    alert('删除成功');
                    this.loadNodes();
                } else {
                    alert(data.message || '删除失败');
                }
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请稍后重试');
            }
        },
        changePage(page) {
            if (page < 1 || page > this.pagination.pages) return;
            this.pagination.currentPage = page;
            this.loadNodes();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadNodes();
        },
        formatDateTime(dateTimeStr) {
            if (!dateTimeStr) return '';
            const dt = new Date(dateTimeStr);
            const year = dt.getFullYear();
            const month = String(dt.getMonth() + 1).padStart(2, '0');
            const day = String(dt.getDate()).padStart(2, '0');
            const hour = String(dt.getHours()).padStart(2, '0');
            const minute = String(dt.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hour}:${minute}`;
        }
    }
};
