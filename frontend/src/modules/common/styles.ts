// For AI Overview
export const MARKDOWN_STYLES_CLASS = `
  text-sm
  prose-black
  prose-h1:text-secondary prose-h1:text-[13px] prose-h1:uppercase prose-h1:font-medium prose-h1:tracking-wide
  prose-h1:mb-3 prose-h1:mt-8 [&>h1:first-of-type]:mt-4
  prose-h1:flex prose-h1:items-center prose-h1:gap-1

  [&>h1::after]:content-[''] [&>h1::after]:flex-1 [&>h1::after]:h-px [&>h1::after]:bg-border

  prose-h2:text-secondary prose-h2:text-[13px] prose-h2:uppercase prose-h2:font-medium prose-h2:tracking-wide
  prose-h2:mb-3 prose-h2:mt-8 [&>h2:first-of-type]:mt-4
  prose-h2:flex prose-h2:items-center prose-h2:gap-1

  prose-h3:text-secondary prose-h3:text-[13px] prose-h3:uppercase prose-h3:font-medium prose-h3:tracking-wide
  prose-h3:mb-3 prose-h3:mt-8 [&>h3:first-of-type]:mt-4
  prose-h3:flex prose-h3:items-center prose-h3:gap-1

  prose-pre:bg-secondary-foreground prose-pre:my-3
  prose-code:bg-secondary-foreground prose-code:px-1.5 prose-code:text-[11.5px]
  prose-code:font-normal prose-code:inline-block prose-code:text-primary

  prose-code:break-all prose-code:text-wrap

  prose-hr:my-4

  prose-p:mb-2 prose-p:mt-0
`

// For AI Chat
export const MARKDOWN_STYLES_CHAT = `
  text-sm
  prose-black prose-sm

  prose-h1:text-sm prose-h1:font-semibold prose-h1:mb-0 prose-h1:mt-3
  prose-h2:text-sm prose-h2:font-semibold prose-h2:mb-0 prose-h2:mt-3
  prose-h3:text-sm prose-h3:font-semibold prose-h3:mb-0 prose-h3:mt-3
  prose-h4:text-sm prose-h4:font-semibold prose-h4:mb-0 prose-h4:mt-3

  prose-p:my-0.5
  
  prose-pre:bg-[#f0edea] prose-pre:mx-2 prose-pre:my-3
  prose-code:bg-[#f0ebe6] prose-code:px-1.5 prose-code:rounded-xs
  prose-code:font-normal prose-code:inline-block prose-code:text-[12px]
  prose-code:break-all prose-code:text-wrap

  prose-li:mx-0 prose-li:px-0
  prose-ul:pl-5 prose-ol:pl-5

  prose-blockquote:not-italic

  prose-hr:my-4
`