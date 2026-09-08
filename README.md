# Vercel Private DoH

一个可直接部署到 Vercel 的 RFC 8484 DoH 转发服务。

- 首页：社会主义核心价值观
- 私有 DoH 路径：由 `DOH_PATH` 环境变量控制
- 主上游：Google DoH
- 备用上游：Cloudflare DoH
- 支持 RFC 8484 GET / POST

## 环境变量

`DOH_PATH`

示例：

`/api/v3/8e491b786adca013bb57cf90564c927d`

不要使用默认值 `/api/v3/change-me`。

## 部署

导入 GitHub 仓库到 Vercel 后，在 Project Settings -> Environment Variables 添加 `DOH_PATH`，然后重新部署。
