# 示例

这些示例通过当前 pnpm workspace 使用 `vite-plugin-loading`。

```bash
pnpm install
pnpm dev:vue
pnpm dev:react
```

每个项目只提供一个开发命令。页面会展示全部 8 种内置动画（`bars`、`flip`、`beat`、`dot`、`spinner`、`progress`、`ring`、`ripple`），预览使用插件真实生成的 HTML 与 CSS，而不是框架仿写的版本。

主题色会持久化到 `localStorage`，并在遮罩注入前由文档头部脚本恢复，用于演示首屏阶段的 CSS 变量动态主题。浅色、深色与跟随系统模式会同步更新应用和插件生成的遮罩渐变。
