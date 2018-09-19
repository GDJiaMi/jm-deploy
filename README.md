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

命令会提交输入`远程版本库的地址`以及前端编译后的`静态资源的目录`. 并在项目根目录下创建`jm-deploy.json`配置文件

### 发布

```
jm-deploy deploy
# verbose 模式
jm-deploy -v deploy
```

将指定的前端资源目录下的文件提交到远程版本库。大概会经历一下步骤:

1. 初始化远程版本库，创建或更新分支. 分支名称使用`package.json`的name字段
2. 清空版本库文件，并将新的资源文件拷贝到版本库
3. 提交，并根据`package.json`的verison字段生成tag，例如`name/1.1.8`和`name/1.1.x`

## 约定

1. 前后端大版本强制绑定(待实践)
2. 提交信息要说明发布情况。deploy命令有提供模板

[更多信息](spec.md)

## License

MIT
