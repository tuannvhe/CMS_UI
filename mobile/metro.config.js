/* 2026-11-23 [Truong] - Mobile app: share CMS_UI/src (api, i18n) with the web app */
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const webSrc = path.resolve(projectRoot, '../src')
const webClient = path.join(webSrc, 'api', 'client.ts')
const mobileClient = path.join(projectRoot, 'src', 'api', 'client.ts')

const config = getDefaultConfig(projectRoot)

// Code của web (CMS_UI/src) nằm ngoài thư mục app
config.watchFolders = [webSrc]

const isBare = (m) => !m.startsWith('.') && !path.isAbsolute(m)
const fromApp = path.join(projectRoot, 'package.json')   // điểm gốc giả để tra gói từ node_modules của app

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // File của web import gói (react, axios, i18next…): tra như thể import từ app, không dùng nhầm React 18 của web (CMS_UI/node_modules)
  const fromWeb = path.resolve(context.originModulePath).startsWith(webSrc + path.sep)
  const ctx = fromWeb && isBare(moduleName) ? { ...context, originModulePath: fromApp } : context
  const res = ctx.resolveRequest(ctx, moduleName, platform)
  // Module API của web import './client' (axios dùng cookie trình duyệt) → dùng client của app (Bearer token + tự làm mới)
  if (res.type === 'sourceFile' && path.resolve(res.filePath) === webClient) return { type: 'sourceFile', filePath: mobileClient }
  return res
}

module.exports = config
