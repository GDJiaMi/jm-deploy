# jm-deploy

基于 Git 仓库的前端资源部署的发布端命令

## Install

```
npm i -g jm-deploy
```

## Usage

### 初始化项目

```
jm-deploy init
```

命令会提交输入`远程版本库的地址`以及前端编译后的`静态资源的目录`. 并在项目根目录下创建`jm-deploy.json`配置文件.支持以下配置项:

```json
{
  "dist": "当前项目需要提交的静态文件, 默认为dist",
  "target": "拷贝到部署仓库的目录，默认是/",
  "remote": "部署仓库, 支持使用${ENV}内嵌环境变量"
}
```

示例:

```json
{
  "dist": "build",
  "target": "awesome-project",
  "remote": "http://gitlab-ci-token:${CI_BUILD_TOKEN}@code.ejiahe.com:82/gq-li/test-deploy.git"
}
```

### 发布

> 只在进行交付的情况下调用该命令。不要每个提交都进行调用

```
jm-deploy deploy
# verbose 模式
jm-deploy -v deploy
```

将指定的前端资源目录下的文件提交到远程版本库。大概会经历一下步骤:

1. 初始化或更新远程部署版本库.
2. 创建或更新分支. 策略如下:

   - 推送了携带 tag 的提交，例如 v1.0.0, 会将构建推送到部署版本库的 master 分支
   - tag 提交为 v1.0.0@6.6 形式。这是正式发布 tag。jm-deploy 会从 master 分支 checkout 出一个 release/6.6 分支, 将静态资源推送到这个分支
   - release/6.6 形式的分支更新。同上

3. 清空版本库文件/或指定目录(由 target 指定)，并将新的资源文件拷贝到部署版本库
4. 提交，并根据`package.json`的 verison 字段生成 tag，例如`appName/1.1.8`

所以部署版本库大致有两种类型的分支:

- master 分支: 在这个分支始终可以获取到最新的代码
- release/\* 分支: 获取指定工作包版本的代码. 例如`release/6.6`

## License

MIT
