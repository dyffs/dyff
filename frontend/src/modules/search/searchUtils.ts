import { getFileIcon } from '@/utils/fileIcons'

export function getFileIconClass (fileName: string): string {
  return getFileIcon(fileName)
}

export function escapeHtml (text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function escapeRegex (str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getLinePrefix (type: 'context' | 'addition' | 'deletion'): string {
  switch (type) {
    case 'addition':
      return '+'
    case 'deletion':
      return '-'
    default:
      return ' '
  }
}
