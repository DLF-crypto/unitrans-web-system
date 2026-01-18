// 通用占位页面组件
const PlaceholderPage = {
    template: `
        <div class="placeholder-card">
            <div>{{ message }}</div>
        </div>
    `,
    computed: {
        message() {
            return `"${this.$route.meta.title}" 页面内容待开发`;
        }
    }
};

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlaceholderPage };
}
