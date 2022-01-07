const yamlHeaderParser = require('yaml-front-matter')
const tablemark = require('tablemark')
const { format } = require('date-fns')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const { en, zh } = require('./locales')

const localePath = {
  en: '../',
  zh: '../zh/',
}

const eipFiles = localePath =>
  fs
    .readdirSync(path.resolve(__dirname, localePath))
    .filter(file => file.includes('eip'))
    .map(file => path.resolve(__dirname, localePath, file))

const [enMetas, zhMetas] = [
  eipFiles(localePath.en),
  eipFiles(localePath.zh),
].map(files =>
  files.map(filePath => {
    const meta = yamlHeaderParser.loadFront(fs.readFileSync(filePath, 'utf8'))
    delete meta.__content
    const filename = path.parse(filePath).name
    return {
      ...meta,
      filename,
      // eip: `[${meta.eip}](./${filename})`,
      created: meta.created
        ? format(new Date(meta.created), 'yyyy-MM-dd')
        : '-',
    }
  })
)

const [EIP_STATUS_EN, EIP_STATUS_ZH] = [
  _.groupBy(enMetas, 'status'),
  _.groupBy(zhMetas, 'status'),
]
const [EIP_CATE_EN, EIP_CATE_ZH] = [
  _.groupBy(enMetas, 'category'),
  _.groupBy(zhMetas, 'category'),
]
const [EIP_TYPE_EN, EIP_TYPE_ZH] = [
  _.groupBy(enMetas, 'type'),
  _.groupBy(zhMetas, 'type'),
]

const getSummaryPath = (item, lang) => {
  let root
  if (typeof lang === 'undefined') {
    root = '/'
  } else {
    root = lang === 'en' ? '/' : `/${lang}/`
  }

  return `${root}summary/${item
    .split(' ')
    .join('-')
    .toLowerCase()}`
}

const getSidebarChildren = (arr, locale) => {
  return Object.keys(arr)
    .filter(k => k !== 'undefined')
    .map(item => [
      getSummaryPath(item, locale.language),
      `${locale[item]} (${arr[item].length})`,
    ])
}

const genSummary = (summary, locale) => {
  const keys = Object.keys(summary).filter(k => k !== 'undefined')

  keys.map(key => {
    const content = _.sortBy(summary[key], 'eip').map(s => {
      const filePath = path.join(
        '/',
        locale.language === 'en' ? '' : 'zh',
        s.filename
      )
      return {
        eip: `[${s.eip}](${filePath}.md)`,
        title: s.title,
        created: s.created,
        status: s.status,
        category: s.category,
        type: s.type,
      }
    })
    const tableJSON = tablemark(content)
    const markdown = `
# ${locale.summaryTitle}: ${locale[key]} (${content.length})
---
${tableJSON}
    `
    fs.writeFileSync(
      path.resolve(__dirname, `..${getSummaryPath(key, locale.language)}.md`),
      markdown
    )
  })
}
genSummary(EIP_STATUS_EN, en)
genSummary(EIP_STATUS_ZH, zh)
genSummary(EIP_TYPE_EN, en)
genSummary(EIP_TYPE_ZH, zh)
genSummary(EIP_CATE_EN, en)
genSummary(EIP_CATE_ZH, zh)

const getSidebar = locale => {
  return [
    {
      title: locale.allListSubTitle,
      path: locale.language === 'en' ? '/' : '/zh/',
      collapsable: false,
    },
    {
      title: locale.eipsByStatus,
      collapsable: false,
      children: getSidebarChildren(
        locale.language === 'zh' ? EIP_STATUS_ZH : EIP_STATUS_EN,
        locale
      ),
    },
    {
      title: locale.eipsByTypes,
      collapsable: false,
      children: getSidebarChildren(
        locale.language === 'zh' ? EIP_TYPE_ZH : EIP_TYPE_EN,
        locale
      ),
    },
    {
      title: locale.eipsByCategory,
      collapsable: false,
      children: getSidebarChildren(
        locale.language === 'zh' ? EIP_CATE_ZH : EIP_CATE_EN,
        locale
      ),
    },
  ]
}

var a = (module.exports = {
  locales: {
    '/': {
      lang: 'en-US', // 将会被设置为 <html> 的 lang 属性
      title: en.siteTitle,
      description: en.siteDescription,
    },
    '/zh/': {
      lang: 'zh-CN',
      title: zh.siteTitle,
      description: zh.siteDescription,
    },
  },
  ga: '',
  markdown: {
    lineNumbers: true,

    extractHeaders: ['h1', 'h2', 'h3', 'h4'],
  },

  plugins: {
    'fulltext-search': {},
    seo: {
      modifiedAt: $page => $page.lastUpdated && new Date($page.lastUpdated),
      title: $page => {
        const frontmatter = $page.frontmatter

        const { eip, title, home } = frontmatter
        if (!eip) return $page.title

        const pageHeader = home ? '' : `EIP${eip} - ${title}`
        return pageHeader
      },
      description: $page => {
        if (
          $page.path !== '/' &&
          $page.path !== '/zh' &&
          $page._strippedContent
        ) {
          return $page._strippedContent.substr(0, 200)
        }
        return $page.frontmatter.description
      },
    },
  },

  themeConfig: {
    repo: 'ethlibrary/EIPs',
    docsDir: 'EIPS',
    lastUpdated: true,
    editLinks: true,
    smoothScroll: true,
    algolia: {
      apiKey: '',
      indexName: '',
      debug: false,
    },
    locales: {
      '/': {
        label: 'English',
        selectText: 'Languages',
        ariaLabel: 'Select language',
        editLinkText: 'Edit this page on GitHub',
        lastUpdated: 'Last Updated',
        nav: [{ text: en.aboutUs, link: 'https://ethlibrary.io' }],
        sidebar: {
          '/': getSidebar(en),
        },
      },
      '/zh/': {
        label: '简体中文',
        selectText: '选择语言',
        ariaLabel: '选择语言',
        editLinkText: '在 GitHub 上帮助翻译此文档',
        lastUpdated: '上次更新',
        nav: [{ text: zh.aboutUs, link: 'https://ethlibrary.io' }],
        sidebar: {
          '/zh/': getSidebar(zh),
        },
      },
    },
  },
})
