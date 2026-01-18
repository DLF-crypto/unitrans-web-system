// 用户管理页面组件
const UserManagePage = {
    template: `
        <div class="page-container">
            <div class="page-header">
                <h2 class="page-title">用户管理</h2>
                <button class="btn btn-primary" @click="showModal = true">
                    <span>+ 新增用户</span>
                </button>
            </div>

            <div class="role-list-card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 80px;">序号</th>
                            <th>用户登录名</th>
                            <th>角色</th>
                            <th style="width: 200px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-if="loading">
                            <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-sub);">
                                加载中...
                            </td>
                        </tr>
                        <tr v-else-if="users.length === 0">
                            <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-sub);">
                                暂无用户数据，点击右上角"新增用户"创建
                            </td>
                        </tr>
                        <tr v-else v-for="(user, index) in users" :key="user.id">
                            <td>{{ (pagination.currentPage - 1) * pagination.perPage + index + 1 }}</td>
                            <td>{{ user.username }}</td>
                            <td>{{ user.role_name || '-' }}</td>
                            <td>
                                <button class="btn-link" @click="editUser(user)">编辑</button>
                                <button class="btn-link" @click="resetPassword(user)">重置密码</button>
                                <button class="btn-link btn-danger" @click="deleteUser(user)">删除</button>
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

            <!-- 新增/编辑用户弹窗 -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">{{ isEdit ? '编辑用户' : '新增用户' }}</h3>
                        <button class="modal-close" @click="closeModal">&times;</button>
                    </div>

                    <form @submit.prevent="submitUser" class="modal-body">
                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>登录名 <span style="color: #e57373;">*</span></label>
                            <input
                                type="text"
                                class="form-input"
                                v-model.trim="userForm.username"
                                placeholder="例如：zhangsan"
                                :disabled="isEdit"
                            />
                            <div v-if="userErrors.username" class="error-text">{{ userErrors.username }}</div>
                        </div>

                        <div class="form-field" style="margin-bottom: 16px;">
                            <label>选择角色 <span style="color: #e57373;">*</span></label>
                            <select class="form-input" v-model="userForm.role_id">
                                <option value="">请选择角色</option>
                                <option v-for="role in roles" :key="role.id" :value="role.id">
                                    {{ role.name }}
                                </option>
                            </select>
                            <div v-if="userErrors.role_id" class="error-text">{{ userErrors.role_id }}</div>
                        </div>

                        <div v-if="!isEdit" style="padding: 12px; background: #f5f5f5; border-radius: 6px; font-size: 13px; color: var(--text-sub); margin-bottom: 16px;">
                            <span style="color: var(--primary);">ℹ️</span> 新增用户默认密码为：<strong style="color: var(--text-main);">654321</strong>
                        </div>

                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" @click="closeModal">取消</button>
                            <button type="submit" class="btn btn-primary" :disabled="userSubmitting">
                                <span v-if="!userSubmitting">{{ isEdit ? '保存修改' : '立即创建' }}</span>
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
            users: [],
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
            userForm: { id: null, username: "", role_id: "" },
            userErrors: { username: "", role_id: "" },
            userSubmitting: false,
        };
    },
    mounted() {
        this.fetchUsers();
        this.fetchRoles();
    },
    methods: {
        async fetchUsers() {
            this.loading = true;
            try {
                const res = await fetch(`/api/users?page=${this.pagination.currentPage}&per_page=${this.pagination.perPage}`);
                const data = await res.json();
                if (data.success) {
                    this.users = data.users || [];
                    if (data.pagination) {
                        this.pagination.total = data.pagination.total;
                        this.pagination.pages = data.pagination.pages;
                        this.pagination.currentPage = data.pagination.current_page;
                        this.pagination.perPage = data.pagination.per_page;
                    }
                }
            } catch (e) {
                console.error("加载用户列表失败", e);
            } finally {
                this.loading = false;
            }
        },
        async fetchRoles() {
            try {
                const res = await fetch("/api/roles");
                const data = await res.json();
                if (data.success) {
                    this.roles = data.roles || [];
                }
            } catch (e) {
                console.error("加载角色列表失败", e);
            }
        },
        editUser(user) {
            this.isEdit = true;
            this.userForm.id = user.id;
            this.userForm.username = user.username;
            this.userForm.role_id = user.role_id;
            this.showModal = true;
        },
        async resetPassword(user) {
            if (!confirm(`确定要重置用户 "${user.username}" 的密码吗？\n\n重置后的密码为：654321`)) {
                return;
            }
            
            try {
                const res = await fetch(`/api/users/${user.id}/reset-password`, {
                    method: "POST",
                });
                const data = await res.json();
                
                if (data.success) {
                    alert("密码重置成功！新密码为：654321");
                } else {
                    alert(data.message || "密码重置失败");
                }
            } catch (e) {
                alert("密码重置失败，请稍后重试");
            }
        },
        async deleteUser(user) {
            if (!confirm(`确定要删除用户 "${user.username}" 吗？\n\n删除后将无法恢复！`)) {
                return;
            }
            
            try {
                const res = await fetch(`/api/users/${user.id}`, {
                    method: "DELETE",
                });
                const data = await res.json();
                
                if (data.success) {
                    alert("用户删除成功");
                    await this.fetchUsers();
                } else {
                    alert(data.message || "用户删除失败");
                }
            } catch (e) {
                alert("用户删除失败，请稍后重试");
            }
        },
        closeModal() {
            this.showModal = false;
            this.isEdit = false;
            this.userForm = { id: null, username: "", role_id: "" };
            this.userErrors = { username: "", role_id: "" };
        },
        validateForm() {
            this.userErrors = { username: "", role_id: "" };
            let isValid = true;
            
            if (!this.userForm.username) {
                this.userErrors.username = "请输入登录名";
                isValid = false;
            }
            
            if (!this.userForm.role_id) {
                this.userErrors.role_id = "请选择角色";
                isValid = false;
            }
            
            return isValid;
        },
        async submitUser() {
            if (!this.validateForm()) {
                return;
            }
            
            this.userSubmitting = true;
            
            try {
                const url = this.isEdit ? `/api/users/${this.userForm.id}` : "/api/users";
                const method = this.isEdit ? "PUT" : "POST";
                
                const res = await fetch(url, {
                    method: method,
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: this.userForm.username,
                        role_id: this.userForm.role_id,
                    }),
                });
                
                const data = await res.json();
                
                if (data.success) {
                    alert(this.isEdit ? "用户修改成功" : "用户创建成功，默认密码为：654321");
                    this.closeModal();
                    await this.fetchUsers();
                } else {
                    if (data.field && this.userErrors.hasOwnProperty(data.field)) {
                        this.userErrors[data.field] = data.message;
                    } else {
                        alert(data.message || "操作失败");
                    }
                }
            } catch (e) {
                alert("操作失败，请稍后重试");
            } finally {
                this.userSubmitting = false;
            }
        },
        changePage(page) {
            this.pagination.currentPage = page;
            this.fetchUsers();
        },
        handlePageSizeChange() {
            this.pagination.currentPage = 1;
            this.fetchUsers();
        },
    },
};
