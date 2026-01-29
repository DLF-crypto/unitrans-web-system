const LastmileStatusMappingPage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">尾程轨迹状态映射表</h2>
                <button class="btn btn-primary" @click="openCreateModal">
                    + 新增映射
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>尾程轨迹描述</th>
                            <th>尾程轨迹状态</th>
                            <th>系统状态代码</th>
                            <th>系统状态描述</th>
                            <th>创建时间</th>
                            <th style="width: 160px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="7" style="text-align: center; padding: 40px;">加载中...</td>
                        </tr>
                        <tr v-else-if="mappings.length === 0">
                            <td colspan="7" style="text-align: center; padding: 40px; color: #999;">暂无数据</td>
                        </tr>
                        <tr v-else v-for="(item, index) in mappings" :key="item.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ item.description }}</td>
                            <td>{{ item.sub_status }}</td>
                            <td>{{ item.system_status_code }}</td>
                            <td>{{ getStatusDescription(item.system_status_code) }}</td>
                            <td>{{ formatDateTime(item.created_at) }}</td>
                            <td>
                                <button class="btn-link" @click="openEditModal(item)">编辑</button>
                                <button class="btn-link btn-danger" @click="deleteMapping(item)">删除</button>
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
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑映射' : '新增映射' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitForm" class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>尾程轨迹描述</label>
                            <small style="color: #666;">对应尾程报文中的 "description" 字段值（非必填）</small>
                            <small style="color: #ff9800; display: block; margin-top: 4px;">
                                <strong>匹配规则：</strong>如填写此字段，系统优先匹配 description，匹配不到再匹配 sub_status；如不填写，直接使用 sub_status 匹配
                            </small>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.description" 
                                placeholder="请输入尾程轨迹描述（非必填）"
                                maxlength="255"
                            />
                            <div v-if="errors.description" class="error-text">{{ errors.description }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>尾程轨迹状态 <span style="color: #e57373;">*</span></label>
                            <small style="color: #666;">对应尾程报文中的 "sub_status" 字段值</small>
                            <input 
                                type="text" 
                                class="form-input" 
                                v-model.trim="form.sub_status" 
                                placeholder="请输入尾程轨迹状态"
                                maxlength="64"
                            />
                            <div v-if="errors.sub_status" class="error-text">{{ errors.sub_status }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>系统状态 <span style="color: #e57373;">*</span></label>
                            <small style="color: #666;">选择对应的系统轨迹节点状态</small>
                            <select class="form-input" v-model="form.system_status_code">
                                <option value="">请选择系统状态</option>
                                <option v-for="node in trackingNodes" :key="node.id" :value="node.status_code">
                                    {{ node.status_code }} - {{ node.status_description }}
                                </option>
                            </select>
                            <div v-if="errors.system_status_code" class="error-text">{{ errors.system_status_code }}</div>
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
            mappings: [],
            trackingNodes: [],
            loading: false,
            showModal: false,
            isEdit: false,
            submitting: false,
            form: {
                description: '',
                sub_status: '',
                system_status_code: ''
            },
            errors: {},
            pagination: {
                currentPage: 1,
                perPage: 50,
                total: 0,
                pages: 0
            }
        };
    },
    mounted() {
        this.loadMappings();
        this.loadTrackingNodes();
    },
    methods: {
        async loadMappings() {
            this.loading = true;
            try {
                const resp = await fetch(`/api/lastmile-status-mappings?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await resp.json();
                if (data.success) {
                    this.mappings = data.mappings;
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
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
        async loadTrackingNodes() {
            try {
                const resp = await fetch('/api/tracking-nodes?per_page=1000');
                const data = await resp.json();
                if (data.success) {
                    this.trackingNodes = data.nodes;
                }
            } catch (error) {
                console.error('加载轨迹节点失败:', error);
            }
        },
        getStatusDescription(statusCode) {
            const node = this.trackingNodes.find(n => n.status_code === statusCode);
            return node ? node.status_description : '';
        },
        openCreateModal() {
            this.isEdit = false;
            this.form = {
                description: '',
                sub_status: '',
                system_status_code: ''
            };
            this.errors = {};
            this.showModal = true;
        },
        openEditModal(item) {
            this.isEdit = true;
            this.form = {
                id: item.id,
                description: item.description,
                sub_status: item.sub_status,
                system_status_code: item.system_status_code
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

            // description 为非必填，不需要验证

            if (!this.form.sub_status) {
                this.errors.sub_status = '尾程轨迹状态不能为空';
                valid = false;
            }

            if (!this.form.system_status_code) {
                this.errors.system_status_code = '系统状态不能为空';
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
                const url = this.isEdit ? `/api/lastmile-status-mappings/${this.form.id}` : '/api/lastmile-status-mappings';
                const method = this.isEdit ? 'PUT' : 'POST';
                
                const resp = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: this.form.description,
                        sub_status: this.form.sub_status,
                        system_status_code: this.form.system_status_code
                    })
                });
                
                const data = await resp.json();
                if (data.success) {
                    alert(this.isEdit ? '修改成功' : '创建成功');
                    this.closeModal();
                    this.loadMappings();
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
        async deleteMapping(item) {
            if (!confirm(`确定要删除映射"${item.description} - ${item.sub_status}"吗？`)) {
                return;
            }

            try {
                const resp = await fetch(`/api/lastmile-status-mappings/${item.id}`, {
                    method: 'DELETE'
                });
                const data = await resp.json();
                if (data.success) {
                    alert('删除成功');
                    this.loadMappings();
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
            this.loadMappings();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.loadMappings();
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
