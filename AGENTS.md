# AGENTS.md

## 项目约定

当前项目是南网 e 卡消息中心前端，技术栈为 Vue 3、Vite、TypeScript、Element Plus、Vue Router、Pinia、Axios、SCSS。

1. 使用 Vue 3 Composition API 和 script setup。
2. 使用 TypeScript，不随意使用 any。
3. 页面组件使用 PascalCase 命名。
4. 普通变量和方法使用 camelCase 命名。
5. 接口请求统一放在 src/api。
6. 类型定义统一放在 src/types。
7. 公共组件放在 src/components。
8. 页面放在 src/views 对应模块目录。
9. 路由统一在 src/router 管理。
10. Axios 请求和响应处理统一封装，不在页面中重复编写。
11. 页面优先使用 Element Plus，不重复开发已有基础组件。
12. 样式优先使用 SCSS，不在组件中堆积大量内联样式。
13. 页面必须处理加载中、空数据、请求失败和提交中状态。
14. 表单提交必须防止重复点击。
15. 接口字段以后端实际接口或 OpenAPI 文档为准，不自行修改字段含义。
16. 当前不开发登录、用户、角色、权限、组织机构和动态菜单功能。
17. 当前不引入完整若依项目。
18. 每次只实现用户明确要求的当前任务，不提前开发后续模块。
19. 不修改与当前任务无关的文件。
20. 不自动执行 Git 提交。
21. 修改完成后执行 npm run build。
22. 如果项目存在 lint 命令，同时执行 npm run lint。
23. 核心组件和复杂交互可添加简洁中文注释，不写无意义注释。
24. 不在代码中写死生产接口地址、账号、密码或密钥。
