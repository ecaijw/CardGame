type MiniProgramAccount = {
  miniProgram?: {
    version?: string
    envVersion?: string
  }
}

function readMiniProgram(): MiniProgramAccount['miniProgram'] | null {
  try {
    const read = (wx as { getAccountInfoSync?: () => MiniProgramAccount }).getAccountInfoSync
    if (!read) {
      return null
    }
    return read().miniProgram ?? null
  } catch {
    return null
  }
}

export function gameVersion(): string {
  const mini = readMiniProgram()
  const version = mini?.version?.trim()
  if (version) {
    return version
  }
  if (mini?.envVersion === 'develop') {
    return '开发版'
  }
  if (mini?.envVersion === 'trial') {
    return '体验版'
  }
  if (mini?.envVersion === 'release') {
    return '正式版'
  }
  return '版本未知'
}

export function versionLabel(version = gameVersion()): string {
  return `版本号：${version}`
}
