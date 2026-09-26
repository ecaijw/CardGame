export type DialogIcon = 'crown' | 'fist'

type IconImage = ReturnType<typeof wx.createImage>

const cache: Partial<Record<DialogIcon, IconImage>> = {}

export function preloadIcons() {
  ;(['crown', 'fist'] as const).forEach((name) => {
    const img = wx.createImage()
    img.src = `icons/${name}.png`
    cache[name] = img
  })
}

export function getIcon(name: DialogIcon): IconImage | null {
  const img = cache[name]
  if (!img || !img.width) {
    return null
  }
  return img
}
