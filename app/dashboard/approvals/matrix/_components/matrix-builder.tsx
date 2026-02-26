"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveApprovalMatrixBuilder } from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MatrixUser = {
  id: string
  name: string
  email: string
  department: string | null
  jobTitle: string | null
}

type MatrixNode = {
  id: string
  parentNodeId: string | null
  userId: string | null
  nodeName: string
  department: string | null
  jobTitle: string | null
}

type MatrixStructure = {
  id: string
  name: string
  type: "enterprise" | "work" | "project"
  nodes: MatrixNode[]
  validation?: {
    isValid: boolean
    issues: string[]
    nodeCount: number
    rootCount: number
  }
}

type DraftNode = {
  tempId: string
  parentRef: string
  userId: string
  nodeName: string
  department: string
  jobTitle: string
  sortOrder: number
}

function makeTempId() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`
}

export function MatrixBuilder({ structures, users }: { structures: MatrixStructure[]; users: MatrixUser[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedStructureId, setSelectedStructureId] = useState(structures[0]?.id ?? "")
  const [draftNodes, setDraftNodes] = useState<DraftNode[]>([])

  const selectedStructure = useMemo(
    () => structures.find((structure) => structure.id === selectedStructureId) ?? null,
    [structures, selectedStructureId]
  )

  const parentOptions = useMemo(() => {
    if (!selectedStructure) {
      return [] as Array<{ id: string; label: string }>
    }

    const existing = selectedStructure.nodes.map((node) => ({
      id: node.id,
      label: node.nodeName,
    }))

    const drafts = draftNodes.map((node) => ({
      id: node.tempId,
      label: node.nodeName || `Draft ${node.tempId}`,
    }))

    return [...existing, ...drafts]
  }, [selectedStructure, draftNodes])

  const addDraftNode = () => {
    setDraftNodes((prev) => [
      ...prev,
      {
        tempId: makeTempId(),
        parentRef: "",
        userId: "",
        nodeName: "",
        department: "",
        jobTitle: "",
        sortOrder: prev.length + 1,
      },
    ])
  }

  const removeDraftNode = (tempId: string) => {
    setDraftNodes((prev) => prev.filter((node) => node.tempId !== tempId))
  }

  const updateDraftNode = (tempId: string, patch: Partial<DraftNode>) => {
    setDraftNodes((prev) =>
      prev.map((node) => {
        if (node.tempId !== tempId) {
          return node
        }

        const next = { ...node, ...patch }

        if (patch.userId !== undefined) {
          const selected = users.find((user) => user.id === patch.userId)
          if (selected) {
            next.nodeName = selected.name
            next.department = selected.department ?? ""
            next.jobTitle = selected.jobTitle ?? ""
          }
        }

        return next
      })
    )
  }

  const validateDraft = () => {
    if (!selectedStructureId) {
      return "Pilih struktur terlebih dahulu"
    }

    if (draftNodes.length === 0) {
      return "Tambahkan minimal 1 node draft"
    }

    for (const node of draftNodes) {
      if (!node.nodeName.trim() && !node.userId) {
        return "Node harus punya nama atau user"
      }
      if (node.parentRef && node.parentRef === node.tempId) {
        return "Node tidak boleh parent ke dirinya sendiri"
      }
    }

    return null
  }

  const handleSave = () => {
    const issue = validateDraft()
    if (issue) {
      toast.error(issue)
      return
    }

    const formData = new FormData()
    formData.set("structureId", selectedStructureId)
    formData.set(
      "nodes",
      JSON.stringify(
        draftNodes.map((node) => ({
          tempId: node.tempId,
          parentRef: node.parentRef || null,
          userId: node.userId || null,
          nodeName: node.nodeName,
          department: node.department || null,
          jobTitle: node.jobTitle || null,
          sortOrder: Number(node.sortOrder) || 0,
        }))
      )
    )

    startTransition(async () => {
      const result = await saveApprovalMatrixBuilder(formData)
      if (!result.success) {
        const details = Array.isArray((result as { issues?: string[] }).issues)
          ? (result as { issues?: string[] }).issues?.[0]
          : null
        toast.error(details || result.error || "Gagal menyimpan matrix")
        return
      }

      toast.success("Matrix berhasil disimpan")
      setDraftNodes([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Matrix Builder</p>
          <p className="text-sm text-muted-foreground">Pilih user dan susun parent-child sebelum disimpan ke struktur.</p>
        </div>
        {selectedStructure?.validation ? (
          <Badge variant={selectedStructure.validation.isValid ? "default" : "destructive"}>
            {selectedStructure.validation.isValid ? "Valid" : "Need Fix"}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="matrix-builder-structure">Struktur</Label>
          <select
            id="matrix-builder-structure"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={selectedStructureId}
            onChange={(event) => {
              setSelectedStructureId(event.target.value)
              setDraftNodes([])
            }}
          >
            {structures.map((structure) => (
              <option key={structure.id} value={structure.id}>{structure.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={addDraftNode}>Tambah Baris Node</Button>
        </div>
      </div>

      {draftNodes.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Belum ada node draft. Klik &quot;Tambah Baris Node&quot; untuk mulai builder.
        </div>
      ) : (
        <div className="space-y-3">
          {draftNodes.map((node) => (
            <div key={node.tempId} className="grid gap-3 rounded-md border p-3 md:grid-cols-7">
              <div className="space-y-1 md:col-span-2">
                <Label>User</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={node.userId}
                  onChange={(event) => updateDraftNode(node.tempId, { userId: event.target.value })}
                >
                  <option value="">Manual</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name} · {user.department ?? "-"}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Parent</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={node.parentRef}
                  onChange={(event) => updateDraftNode(node.tempId, { parentRef: event.target.value })}
                >
                  <option value="">Root</option>
                  {parentOptions
                    .filter((opt) => opt.id !== node.tempId)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-3">
                <Label>Node Name</Label>
                <Input value={node.nodeName} onChange={(event) => updateDraftNode(node.tempId, { nodeName: event.target.value })} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Jabatan</Label>
                <Input value={node.jobTitle} onChange={(event) => updateDraftNode(node.tempId, { jobTitle: event.target.value })} />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Department</Label>
                <Input value={node.department} onChange={(event) => updateDraftNode(node.tempId, { department: event.target.value })} />
              </div>

              <div className="space-y-1 md:col-span-1">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={node.sortOrder}
                  onChange={(event) => updateDraftNode(node.tempId, { sortOrder: Number(event.target.value || 0) })}
                />
              </div>

              <div className="flex items-end md:col-span-2">
                <Button type="button" variant="destructive" className="w-full" onClick={() => removeDraftNode(node.tempId)}>
                  Hapus
                </Button>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="button" disabled={isPending} onClick={handleSave}>Simpan Matrix</Button>
          </div>
        </div>
      )}
    </div>
  )
}
