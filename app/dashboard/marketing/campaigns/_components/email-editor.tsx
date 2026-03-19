"use client"

import { useState, useCallback, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Image from "@tiptap/extension-image"
import Underline from "@tiptap/extension-underline"
import { Color } from "@tiptap/extension-color"
import {
    Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon,
    AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
    Code, Code2, Eye, EyeOff, Image as ImageIcon, Upload, Loader2
} from "lucide-react"
import { uploadFile } from "@/app/actions/upload"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

interface Props {
    value: string
    onChange: (html: string) => void
}

export function EmailEditor({ value, onChange }: Props) {
    const [isHtmlMode, setIsHtmlMode] = useState(false)
    const [htmlValue, setHtmlValue] = useState(value)

    const [imageUploading, setImageUploading] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            TextStyle,
            Color,
            Underline,
            Image.configure({
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg shadow-sm my-4',
                },
            }),
        ],
        content: value,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML()
            setHtmlValue(html)
            onChange(html)
        },
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[260px] p-4",
            },
        },
    })

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value)
            setHtmlValue(value)
        }
    }, [value, editor])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !editor) return

        setImageUploading(true)
        const formData = new FormData()
        formData.append("file", file)

        const res = await uploadFile(formData)
        if (res.success && res.url) {
            editor.chain().focus().setImage({ src: res.url }).run()
            toast.success("Gambar berhasil disisipkan")
        } else {
            toast.error("Gagal mengunggah gambar")
        }
        setImageUploading(false)
        e.target.value = ""
    }

    const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const html = e.target.value
        setHtmlValue(html)
        onChange(html)
        editor?.commands.setContent(html) // Fix lint TS!
    }

    const toggleHtmlMode = () => {
        if (!isHtmlMode && editor) {
            setHtmlValue(editor.getHTML())
        }
        setIsHtmlMode(!isHtmlMode)
    }

    const setLink = useCallback(() => {
        if (!editor) return
        const prev = editor.getAttributes("link").href
        const url = window.prompt("URL Link:", prev)
        if (url === null) return
        if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }, [editor])

    if (!editor || !mounted) return <div className="min-h-[290px] border rounded animate-pulse bg-muted/20" /> // SSR fallback

    return (
        <div className="rounded-md border overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-muted/50 border-b">
                <Toggle
                    size="sm" pressed={editor.isActive("bold")}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                    size="sm" pressed={editor.isActive("italic")}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="h-3.5 w-3.5" />
                </Toggle>
                <Separator orientation="vertical" className="h-5 mx-0.5" />
                <Toggle
                    size="sm" pressed={editor.isActive({ textAlign: "left" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}
                >
                    <AlignLeft className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                    size="sm" pressed={editor.isActive({ textAlign: "center" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}
                >
                    <AlignCenter className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                    size="sm" pressed={editor.isActive({ textAlign: "right" })}
                    onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}
                >
                    <AlignRight className="h-3.5 w-3.5" />
                </Toggle>
                <Separator orientation="vertical" className="h-5 mx-0.5" />
                <Toggle
                    size="sm" pressed={editor.isActive("bulletList")}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                    size="sm" pressed={editor.isActive("orderedList")}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                </Toggle>
                <Toggle
                    size="sm" pressed={editor.isActive("codeBlock")}
                    onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
                >
                    <Code2 className="h-3.5 w-3.5" />
                </Toggle>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={setLink}>
                    <LinkIcon className="h-3.5 w-3.5" />
                </Button>
                
                <Separator orientation="vertical" className="h-5 mx-0.5" />
                
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2 gap-1.5" 
                    disabled={imageUploading}
                    onClick={() => document.getElementById('editor-image-upload')?.click()}
                >
                    {imageUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                    <span className="text-[10px] hidden sm:inline">Gambar</span>
                </Button>
                <input 
                    id="editor-image-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload} 
                />

                <div className="ml-auto">
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={toggleHtmlMode}>
                        {isHtmlMode ? <><Eye className="h-3.5 w-3.5" />Visual</> : <><Code className="h-3.5 w-3.5" />HTML</>}
                    </Button>
                </div>
            </div>

            {/* Editor Area */}
            {isHtmlMode ? (
                <Textarea
                    value={htmlValue}
                    onChange={handleHtmlChange}
                    className="min-h-[280px] font-mono text-xs border-none rounded-none resize-none focus-visible:ring-0"
                    placeholder="<h1>Halo {{name}}!</h1><p>Penawaran spesial untuk Anda...</p>"
                />
            ) : (
                <EditorContent editor={editor} />
            )}
        </div>
    )
}
