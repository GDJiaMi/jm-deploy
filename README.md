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

```
jm-deploy deploy
# verbose 模式
jm-deploy -v deploy
```

将指定的前端资源目录下的文件提交到远程版本库。大概会经历一下步骤:

1. 初始化远程部署版本库，创建或更新分支. 分支名称与当前源代码仓库的当前分支保持一致
2. 清空版本库文件/或指定目录(由target指定)，并将新的资源文件拷贝到部署版本库
3. 提交，并根据`package.json`的 verison 字段生成 tag，例如`appName/1.1.8`

## License

MIT
