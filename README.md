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

命令会提交输入`远程版本库的地址`以及前端编译后的`静态资源的目录`. 并在项目根目录下创建`jm-deploy.json`配置文件.

### 发布

```
jm-deploy deploy
# verbose 模式
jm-deploy -v deploy
```

将指定的前端资源目录下的文件提交到远程版本库。大概会经历一下步骤:

1. 初始化远程版本库，创建或更新分支. 分支名称使用`package.json`的 name 字段
2. 清空版本库文件，并将新的资源文件拷贝到版本库
3. 提交，并根据`package.json`的 verison 字段生成 tag，例如`appName/1.1.8`和`appName/1.1.x`
4. 生成`group/groupname/appName` 标签，这个标签总是指向最新的版本。这个机制是为了让同一个分组的应用，大版本总能
   保持一致

**设置提交信息**
当 jm-deploy 准备提交时会显示最近的提交信息列表供选择，然后根据你的选择生成一个提交信息模板。这个模板会通过
编辑器打开，以供二次编辑。编辑器依赖于`EDITOR`环境变量，在 Mac 或 Linux 下面默认为`Vim`, 在 Windows 下面默认为`记事本`.
经过测试，在 Windows 下面推荐使用`Notepad++`, 以避免信息丢失和乱码.

## 约定

1. 前后端大版本强制绑定(待实践)
2. 提交信息要说明发布情况。deploy 命令有提供模板

[更多信息](spec.md)

## License

MIT
