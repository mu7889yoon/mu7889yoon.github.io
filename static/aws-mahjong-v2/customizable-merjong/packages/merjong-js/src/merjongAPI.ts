import themes from "./themes/index.js"

type ThemeConfig = {
  baseUrl?: string
  tileDesigns?: Partial<Record<string, string>>
}

type TileOrientType =
  | "upright"       // upright tile
  | "sideways"      // sideways tile
  | "sidewaysTop"   // top part of a stacked kan tile

type tileRenderProfile = {
  type: "tile"
  tileKey: string
  tileOrient: TileOrientType
}

type spaceRenderProfile = {
  type: "space"
}

type RenderProfile = tileRenderProfile | spaceRenderProfile

const genRenderProfiles = (mpsz: string): RenderProfile[] => {
  const result: (tileRenderProfile | spaceRenderProfile)[] = []
  const numQtBuffer: string[] = []  // e.g.,　0,1',2",X,Q'
  let qtBuffer: string[] = []  // e.g., `'`, `"`

  for (let i = 0;i < mpsz.length;i++) {
    const char = mpsz[i]

    if (/[0-9XQ]/.test(char)) {
      numQtBuffer.push(char)
    } else if (char === "'" || char === '"') {
      const lastNumQt = numQtBuffer.pop()
      numQtBuffer.push((lastNumQt || "Q") + char)
    } else if (/[mpszqx]/.test(char)) {

      if (numQtBuffer.length === 0) {
        result.push({
          type: "tile",
          tileKey: char === "x" ? "x" : "q",
          tileOrient: "upright"
        })
        continue
      }

      for (let j = 0;j < numQtBuffer.length;j++) {
        const numQt = numQtBuffer[j]
        const num = numQt[0]
        const qt = numQt.slice(1)

        let tileKey = ""

        if (num === "X" || num === "Q") {
          tileKey = num.toLowerCase()
        } else if (char === "x" || char === "q") {
          tileKey = char
        } else {
          tileKey = `${num}${char}`.toLowerCase()
        }

        if (!qt) {
          result.push({ type: "tile", tileKey, tileOrient: "upright" })
        } else if (qt === "'") {
          result.push({ type: "tile", tileKey, tileOrient: "sideways" })
        } else if (qt === "''") {
          result.push({ type: "tile", tileKey, tileOrient: "sidewaysTop" })
        } else if (qt === "\"") {
          result.push({ type: "tile", tileKey, tileOrient: "sideways" })
          result.push({ type: "tile", tileKey, tileOrient: "sidewaysTop" })
        } else { // written mpsz may not be correct.
          result.push({ type: "tile", tileKey, tileOrient: "upright" })
        }
      }
      numQtBuffer.length = 0

    } else if (char === "-") {
      result.push({ type: "space" })
    }
  }
  return result
}

const genSVG = (renderProfiles: RenderProfile[], config: RenderConfig) => {
  const { tileDesigns, tileWidth, tileHeight, tileGap, spaceWidth } = config
  
  const svgHeight = Math.max(tileHeight, tileWidth * 2 + tileGap)

  let svgInner = ""
  let xPosition = 0
  for (const entry of renderProfiles) {
    if (entry.type === "tile") {
      const tileKey = entry.tileKey
    
      switch (entry.tileOrient) {
        case "upright": {
          svgInner += `<image href="${tileDesigns["base"]}" x="${xPosition}" y="${svgHeight - tileHeight}" width="${tileWidth}" height="${tileHeight}" />` +
                      `<image href="${tileDesigns[tileKey]}" x="${xPosition}" y="${svgHeight - tileHeight}" width="${tileWidth}" height="${tileHeight}" />`
          xPosition += tileWidth + tileGap
          break
        }
    
        case "sideways": {
          svgInner += `<image href="${tileDesigns["base"]}" x="${-svgHeight}" y="${xPosition}" width="${tileWidth}" height="${tileHeight}" transform="rotate(-90)" />` +
                      `<image href="${tileDesigns[tileKey]}" x="${-svgHeight}" y="${xPosition}" width="${tileWidth}" height="${tileHeight}" transform="rotate(-90)" />`
          xPosition += tileHeight + tileGap
          break
        }
    
        case "sidewaysTop": {
          const xRotated = tileWidth - svgHeight + tileGap
          const yRotated = xPosition - tileHeight - tileGap
          svgInner += `<image href="${tileDesigns["base"]}" x="${xRotated}" y="${yRotated}" width="${tileWidth}" height="${tileHeight}" transform="rotate(-90)" />` +
                      `<image href="${tileDesigns[tileKey]}" x="${xRotated}" y="${yRotated}" width="${tileWidth}" height="${tileHeight}" transform="rotate(-90)" />`
          break
        }
      }
    } else if (entry.type === "space") {
      xPosition += spaceWidth
    }
  }
  
  return `<div style="background-color: green; padding: 0.375rem; border-radius: 6px;"><svg width="100%" height="${svgHeight}" style="display: block;">${svgInner}</svg></div>`

}

type RenderConfig = {
  tileDesigns: Record<string, string>
  tileWidth: number
  tileHeight: number
  tileGap: number
  spaceWidth: number
}

const resolveBaseUrl = (
  designs: Partial<Record<string, string>>,
  baseUrl?: string
): Partial<Record<string, string>> => {
  if (!baseUrl) return designs

  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'
  const resolved: Partial<Record<string, string>> = {}
  for (const [key, value] of Object.entries(designs)) {
    if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
      resolved[key] = normalizedBaseUrl + value
    } else {
      resolved[key] = value
    }
  }
  return resolved
}

const getRenderConfig = (customConfig?: ThemeConfig): RenderConfig => {
  const theme = themes.default.getThemeVariables()

  if (!customConfig) {
    return {
      tileDesigns: theme.tileDesigns,
      tileWidth: theme.tileWidth,
      tileHeight: theme.tileHeight,
      tileGap: theme.tileGap,
      spaceWidth: theme.spaceWidth,
    }
  }

  const resolvedDesigns = resolveBaseUrl(
    customConfig.tileDesigns || {},
    customConfig.baseUrl
  )

  return {
    tileDesigns: { ...theme.tileDesigns, ...resolvedDesigns } as Record<string, string>,
    tileWidth: theme.tileWidth,
    tileHeight: theme.tileHeight,
    tileGap: theme.tileGap,
    spaceWidth: theme.spaceWidth,
  }
}

const render = (mpsz: string, themeConfig?: ThemeConfig) => {
  const config = getRenderConfig(themeConfig)
  const svgProfiles = genRenderProfiles(mpsz)
  return genSVG(svgProfiles, config)
}


export const merjongAPI = Object.freeze({
  render
})

export default merjongAPI