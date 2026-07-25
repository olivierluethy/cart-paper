import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
  Subscript as SubIcon,
  Superscript as SupIcon,
  Underline as UnderlineIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { promptForLink } from '@/features/editor/linkPrompt'
import { useModal } from '@/lib/modal'

type BlockOption = {
  label: string
  isActive: (editor: Editor) => boolean
  apply: (editor: Editor) => void
}

const BLOCKS: BlockOption[] = [
  {
    label: 'Body text',
    isActive: (e) => e.isActive('paragraph') && !e.isActive('paragraph', { blockStyle: 'callout' }) &&
      !e.isActive('paragraph', { blockStyle: 'epigraph' }) && !e.isActive('paragraph', { blockStyle: 'verse' }),
    apply: (e) => e.chain().focus().setParagraph().setBlockStyle(null).run(),
  },
  { label: 'Heading 1', isActive: (e) => e.isActive('heading', { level: 1 }), apply: (e) => e.chain().focus().setNode('heading', { level: 1 }).run() },
  { label: 'Heading 2', isActive: (e) => e.isActive('heading', { level: 2 }), apply: (e) => e.chain().focus().setNode('heading', { level: 2 }).run() },
  { label: 'Heading 3', isActive: (e) => e.isActive('heading', { level: 3 }), apply: (e) => e.chain().focus().setNode('heading', { level: 3 }).run() },
  { label: 'Heading 4', isActive: (e) => e.isActive('heading', { level: 4 }), apply: (e) => e.chain().focus().setNode('heading', { level: 4 }).run() },
  { label: 'Quote', isActive: (e) => e.isActive('blockquote'), apply: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code block', isActive: (e) => e.isActive('codeBlock'), apply: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Callout', isActive: (e) => e.isActive('paragraph', { blockStyle: 'callout' }), apply: (e) => e.chain().focus().setParagraph().setBlockStyle('callout').run() },
  { label: 'Epigraph', isActive: (e) => e.isActive('paragraph', { blockStyle: 'epigraph' }), apply: (e) => e.chain().focus().setParagraph().setBlockStyle('epigraph').run() },
  { label: 'Verse', isActive: (e) => e.isActive('paragraph', { blockStyle: 'verse' }), apply: (e) => e.chain().focus().setParagraph().setBlockStyle('verse').run() },
]

export function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-grid h-8 w-8 place-items-center rounded transition-colors',
        active ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:bg-ink-line/60 hover:text-ink-text',
        disabled && 'cursor-not-allowed opacity-35 hover:bg-transparent',
      )}
    >
      <Icon size={15} />
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-ink-line" aria-hidden />
}

export function EditorToolbar({ editor, extra }: { editor: Editor; extra?: React.ReactNode }) {
  const { open } = useModal()
  const currentBlock = BLOCKS.find((block) => block.isActive(editor)) ?? BLOCKS[0]!
  const scale = (editor.getAttributes('textStyle').scale as string | undefined) ?? 'm'

  return (
    <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-0.5 border-b border-ink-line bg-ink-bg/92 px-1 py-1.5 backdrop-blur">
      <select
        aria-label="Block type"
        value={currentBlock.label}
        onChange={(event) => BLOCKS.find((b) => b.label === event.target.value)?.apply(editor)}
        className="h-8 rounded border border-ink-line bg-ink-raised px-2 text-xs text-ink-text outline-none focus:border-amber/60"
      >
        {BLOCKS.map((block) => (
          <option key={block.label} value={block.label}>
            {block.label}
          </option>
        ))}
      </select>

      <Divider />

      <ToolButton icon={Bold} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton icon={Italic} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton icon={UnderlineIcon} label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
      <ToolButton icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
      <ToolButton icon={Code} label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />

      <Divider />

      <div className="flex items-center rounded border border-ink-line" role="group" aria-label="Text size">
        {(['s', 'm', 'l'] as const).map((step) => (
          <button
            key={step}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().setFontScale(step === 'm' ? null : step).run()}
            aria-pressed={scale === step}
            title={`Size ${step.toUpperCase()}`}
            className={cn(
              'h-8 w-7 text-xs uppercase transition-colors',
              scale === step ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
            )}
          >
            {step}
          </button>
        ))}
      </div>

      <ToolButton icon={SupIcon} label="Superscript" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()} />
      <ToolButton icon={SubIcon} label="Subscript" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()} />

      <Divider />

      <ToolButton icon={List} label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <ToolButton icon={ListChecks} label="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
      <ToolButton icon={Quote} label="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />

      <Divider />

      <ToolButton icon={AlignLeft} label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
      <ToolButton icon={AlignCenter} label="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
      <ToolButton icon={AlignRight} label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />

      <Divider />

      <ToolButton
        icon={Link2}
        label="Link"
        active={editor.isActive('link')}
        onClick={() => void promptForLink(editor, open)}
      />
      <ToolButton icon={Minus} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()} />

      {extra}

      <span className="ml-auto hidden pr-1 text-2xs tabular-nums text-ink-faint sm:block">
        {editor.storage.characterCount.words()} words
      </span>
    </div>
  )
}
