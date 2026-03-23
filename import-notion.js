/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
const path = require("path")
const axios = require('axios')
const fs = require('fs')
const fsp = fs.promises
const crc32 = require('js-crc').crc32

const DEFAULT_NOTION_ID = '6b3a4ffc3bb146a7873e654f1209d979'
const POTION_API = 'https://potion.banklessacademy.com'

const args = process.argv
const NOTION_ID =
  args[2] && args[2].length === 32
    ? args[2]
    : DEFAULT_NOTION_ID

const log = {
  info: (message, meta) => console.log(message, meta ?? ''),
  warn: (message, meta) => console.warn(message, meta ?? ''),
  error: (message, meta) => console.error(message, meta ?? ''),
}

log.info('NOTION_ID', { NOTION_ID })

const KEY_MATCHING = {
  'Name': 'name',
  'Page': 'page',
  'Category': 'category',
  'Description': 'description',
  'Image': 'image',
  'Link': 'link',
}

const slugify = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/<[^>]*>?/gm, '') // remove tags
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-') // collapse dashes

const downloadImage = async (url, imagePath) => {
  const response = await axios({
    url,
    responseType: 'stream',
    timeout: 30_000,
    validateStatus: (status) => status >= 200 && status < 400,
  })

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(imagePath)
    response.data.pipe(writer)
    response.data.on('error', reject)
    writer.on('error', reject)
    writer.on('finish', resolve)
  })
}

const getImg = async (imageLink, slug, imageName) => {
  const [fileName] = String(imageLink ?? '').split('?')
  const match = fileName.match(/\.(png|svg|jpg|jpeg|webp|webm|mp4|gif)$/i)
  if (!match) {
    throw new Error(`Unsupported or missing image extension in: ${fileName}`)
  }

  const fileExtension = match[1].toLowerCase().replace('jpeg', 'jpg')
  const hash = crc32(fileName)
  const imageDir = `/images/${slug}/`
  const imagePath = `${imageDir}${slugify(imageName)}-${hash}.${fileExtension}`
  const localImagePath = `public${imagePath}`
  const dirname = path.dirname(localImagePath) + '/'

  if (!fs.existsSync(localImagePath)) {
    fs.mkdirSync(dirname, { recursive: true })

    for (const f of fs.readdirSync(dirname)) {
      if (!f.startsWith(slugify(imageName))) continue
      const toDelete = dirname + f
      log.info('delete previous image', { path: toDelete })
      fs.unlinkSync(toDelete)
    }

    log.info('downloading image', { path: localImagePath })
    await downloadImage(imageLink, localImagePath)
  }

  return imagePath
}

const main = async () => {
  const pages = []

  const response = await axios.get(`${POTION_API}/table?id=${NOTION_ID}`, {
    timeout: 30_000,
    validateStatus: (status) => status >= 200 && status < 400,
  })

  if (!Array.isArray(response.data)) {
    throw new Error('Potion API returned unexpected response shape')
  }

  for (const notion of response.data) {
    const page = Object.keys(KEY_MATCHING).reduce(
      (obj, k) =>
        Object.assign(obj, {
          [KEY_MATCHING[k]]: notion.fields?.[k],
        }),
      {}
    )

    const pageType = Array.isArray(page.page) ? page.page[0] : page.page
    const hasPageType = typeof pageType === 'string' && pageType.length > 0
    const hasImage = typeof page.image === 'string' && page.image.length > 0

    if (!hasPageType || !hasImage) {
      log.warn('Skipping row due to missing required fields', {
        name: page.name,
        page: page.page,
        image: page.image,
      })
      continue
    }

    page.page = pageType
    if (page.link === null) {
      delete page.link
    }

    try {
      page.image = await getImg(page.image, page.page, slugify(page.name))
    } catch (err) {
      log.warn('Skipping row due to image processing error', {
        name: page.name,
        page: page.page,
        error: err instanceof Error ? err.message : err,
      })
      continue
    }

    pages.push(page)
  }

  const departments = pages.filter(page => page.page === 'department')
  const guilds = pages.filter(page => page.page === 'guild')
  const projects = pages.filter(page => page.page === 'project')
  const workWithUs = pages.filter(page => page.page === 'work-with-us')

  log.info('export summary', {
    departments: departments.length,
    guilds: guilds.length,
    projects: projects.length,
    workWithUs: workWithUs.length,
  })

  const fileContent = `import { ProjectType } from 'entities/project'

export const DEPARTMENTS: ProjectType[] = ${JSON.stringify(departments, null, 2)}

export const GUILDS: ProjectType[] = ${JSON.stringify(guilds, null, 2)}

export const PROJECTS: ProjectType[] = ${JSON.stringify(projects, null, 2)}

export const WORK_WITH_US: ProjectType[] = ${JSON.stringify(workWithUs, null, 2)}
`

  const filePath = `constants/data.ts`
  await fsp.writeFile(filePath, fileContent)
  log.info('export done', { filePath })
}

main().catch((error) => {
  log.error('Notion import failed', {
    error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
  })
  process.exitCode = 1
})
