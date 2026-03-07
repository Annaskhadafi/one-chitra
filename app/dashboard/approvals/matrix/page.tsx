import { Building2, GitBranch, Network, Upload } from "lucide-react"
import type { ReactNode } from "react"

import {
    createApprovalOrgStructure,
    deleteApprovalOrgNode,
    deleteApprovalOrgStructure,
    getApprovalMatrixImports,
    getApprovalOrgStructures,
    getApprovalOrgUsers,
    importApprovalMatrix,
    seedApprovalOrgSampleData,
    updateApprovalOrgNode,
    updateApprovalOrgStructure,
} from "@/app/actions/approval"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MatrixBuilder } from "./_components/matrix-builder"

type OrgNode = {
    id: string
    structureId: string
    parentNodeId: string | null
    userId: string | null
    nodeName: string
    department: string | null
    jobTitle: string | null
    sortOrder: number
    user?: {
        id: string
        name: string
        email: string
        department: string | null
        jobTitle: string | null
    } | null
}

const typeMeta = {
    enterprise: {
        label: "Struktur Organisasi Besar",
        icon: Building2,
    },
    work: {
        label: "Struktur Organisasi Pekerjaan",
        icon: Network,
    },
    project: {
        label: "Struktur Organisasi Project",
        icon: GitBranch,
    },
} as const

function renderTree(
    parentId: string | null,
    nodeByParent: Map<string | null, OrgNode[]>,
    depth = 0
): ReactNode {
    const children = nodeByParent.get(parentId) ?? []

    if (children.length === 0) {
        return null
    }

    return (
        <div className={depth > 0 ? "ml-6 border-l pl-4" : "space-y-2"}>
            {children.map((node) => (
                <div key={node.id} className="space-y-2">
                    <div className="rounded-md border bg-card p-3 text-sm">
                        <p className="font-medium">{node.user?.name ?? node.nodeName}</p>
                        <p className="text-muted-foreground">{node.jobTitle ?? "No job title"} · {node.department ?? "No department"}</p>
                    </div>
                    {renderTree(node.id, nodeByParent, depth + 1)}
                </div>
            ))}
        </div>
    )
}

const matrixTemplateCsv = [
    "formKey,formName,modulePath,workflowName,description,status,stepOrder,stepName,approverType,approverRole,approverUserId,minApprovals",
    "quotations,Quotations,/dashboard/quotations,Quotation Approval,Approval quotation by level,active,1,Manager Approval,role,manager,,1",
    "quotations,Quotations,/dashboard/quotations,Quotation Approval,Approval quotation by level,active,2,Director Approval,role,director,,1",
].join("\n")

const matrixTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(matrixTemplateCsv)}`

async function createApprovalOrgStructureVoid(formData: FormData): Promise<void> {
    "use server"
    await createApprovalOrgStructure(formData)
}

async function seedApprovalOrgSampleDataVoid(): Promise<void> {
    "use server"
    await seedApprovalOrgSampleData()
}

async function importApprovalMatrixVoid(formData: FormData): Promise<void> {
    "use server"
    await importApprovalMatrix(formData)
}

async function updateApprovalOrgStructureVoid(formData: FormData): Promise<void> {
    "use server"
    await updateApprovalOrgStructure(formData)
}

async function deleteApprovalOrgStructureVoid(formData: FormData): Promise<void> {
    "use server"
    await deleteApprovalOrgStructure(formData)
}

async function updateApprovalOrgNodeVoid(formData: FormData): Promise<void> {
    "use server"
    await updateApprovalOrgNode(formData)
}

async function deleteApprovalOrgNodeVoid(formData: FormData): Promise<void> {
    "use server"
    await deleteApprovalOrgNode(formData)
}

export default async function ApprovalMatrixPage() {
    const [structuresRaw, usersRaw, importLogs] = await Promise.all([
        getApprovalOrgStructures(),
        getApprovalOrgUsers(),
        getApprovalMatrixImports(),
    ])

    // Plain-ify data for Client Component
    const structures = structuresRaw.map(s => ({
        ...s,
        validation: s.validation ? { ...s.validation, issues: s.validation.issues ? [...s.validation.issues] : [] } : null,
        nodes: s.nodes.map(n => ({
            ...n,
            user: n.user ? { ...n.user } : null
        }))
    }))
    const users = usersRaw.map(u => ({ ...u }))

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Approval Matrix & Organization Structure</h1>
                <p className="text-sm text-muted-foreground">
                    Kelola matrix approval terpisah dari workflow, lengkap dengan struktur organisasi enterprise, pekerjaan, dan project.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tambah Struktur Organisasi</CardTitle>
                        <CardDescription>
                            Buat struktur baru yang akan dipakai saat setting approval.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form action={createApprovalOrgStructureVoid} className="space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Nama Struktur</Label>
                                <Input id="name" name="name" placeholder="Contoh: Struktur Approver Project A" required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="type">Tipe Struktur</Label>
                                <select id="type" name="type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue="enterprise">
                                    <option value="enterprise">Struktur Organisasi Besar</option>
                                    <option value="work">Struktur Organisasi Pekerjaan</option>
                                    <option value="project">Struktur Organisasi Project</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea id="description" name="description" placeholder="Opsional" />
                            </div>
                            <Button type="submit">Simpan Struktur</Button>
                        </form>
                        <form action={seedApprovalOrgSampleDataVoid} className="mt-3">
                            <Button type="submit" variant="secondary">Generate Sample Data</Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Import Approval Matrix
                        </CardTitle>
                        <CardDescription>
                            Upload CSV/XLSX untuk generate workflow, step, dan approver massal.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <form action={importApprovalMatrixVoid} className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-1.5 md:col-span-2">
                                <Label htmlFor="matrixFile">Matrix File</Label>
                                <Input id="matrixFile" name="matrixFile" type="file" accept=".csv,.xlsx,.xls" required />
                            </div>
                            <div className="flex items-end">
                                <Button type="submit" className="w-full">Import Matrix</Button>
                            </div>
                        </form>

                        <Button asChild variant="outline" size="sm">
                            <a href={matrixTemplateHref} download="approval-matrix-template.csv">Export Template Import Matrix</a>
                        </Button>

                        <div className="space-y-2">
                            <h3 className="font-medium">Recent Import Logs</h3>
                            {importLogs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Belum ada riwayat import.</p>
                            ) : (
                                importLogs.map((log) => (
                                    <div key={log.id} className="rounded-md border p-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-medium">{log.fileName}</p>
                                            <Badge variant={log.status === "success" ? "default" : "destructive"}>{log.status}</Badge>
                                        </div>
                                        <p className="text-muted-foreground">{log.fileType.toUpperCase()} · {new Date(log.createdAt).toLocaleString("id-ID")}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <MatrixBuilder structures={structures} users={users} />


            <div className="space-y-4">
                {structures.length === 0 ? (
                    <Card>
                        <CardContent className="pt-6 text-sm text-muted-foreground">
                            Belum ada struktur organisasi. Tambahkan struktur terlebih dahulu.
                        </CardContent>
                    </Card>
                ) : (
                    structures.map((structure) => {
                        const meta = typeMeta[structure.type]
                        const Icon = meta.icon

                        const nodeByParent = new Map<string | null, OrgNode[]>()
                        const nodes = structure.nodes as OrgNode[]

                        for (const node of nodes) {
                            const key = node.parentNodeId ?? null
                            const bucket = nodeByParent.get(key) ?? []
                            bucket.push(node)
                            nodeByParent.set(key, bucket)
                        }

                        return (
                            <Card key={structure.id}>
                                <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                        <Icon className="h-5 w-5" />
                                        {structure.name}
                                        <Badge variant="outline">{meta.label}</Badge>
                                        <Badge variant="secondary">{nodes.length} node</Badge>
                                    </CardTitle>
                                    <CardDescription>{structure.description || "-"}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <form action={updateApprovalOrgStructureVoid} className="grid gap-3 rounded-md border p-3 md:grid-cols-6">
                                        <input type="hidden" name="structureId" value={structure.id} />
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label htmlFor={`structure-name-${structure.id}`}>Nama Struktur</Label>
                                            <Input id={`structure-name-${structure.id}`} name="name" defaultValue={structure.name} required />
                                        </div>
                                        <div className="space-y-1.5 md:col-span-1">
                                            <Label htmlFor={`structure-type-${structure.id}`}>Tipe</Label>
                                            <select
                                                id={`structure-type-${structure.id}`}
                                                name="type"
                                                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                defaultValue={structure.type}
                                            >
                                                <option value="enterprise">Enterprise</option>
                                                <option value="work">Work</option>
                                                <option value="project">Project</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5 md:col-span-2">
                                            <Label htmlFor={`structure-description-${structure.id}`}>Deskripsi</Label>
                                            <Input id={`structure-description-${structure.id}`} name="description" defaultValue={structure.description ?? ""} />
                                        </div>
                                        <div className="flex items-end gap-2 md:col-span-1">
                                            <Button type="submit" className="w-full">Edit</Button>
                                        </div>
                                    </form>

                                    <form action={deleteApprovalOrgStructureVoid}>
                                        <input type="hidden" name="structureId" value={structure.id} />
                                        <Button type="submit" variant="destructive">Delete Matrix</Button>
                                    </form>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={structure.validation?.isValid ? "default" : "destructive"}>
                                            {structure.validation?.isValid ? "Valid" : "Need Fix"}
                                        </Badge>
                                        <Badge variant="outline">Root: {structure.validation?.rootCount ?? 0}</Badge>
                                        <Badge variant="outline">Nodes: {structure.validation?.nodeCount ?? nodes.length}</Badge>
                                    </div>

                                    {structure.validation?.issues?.length ? (
                                        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                            {structure.validation.issues.map((issue) => (
                                                <p key={issue} className="text-destructive">• {issue}</p>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className="space-y-2 rounded-md border p-3">
                                        <p className="text-sm font-medium">Manage Nodes</p>
                                        {nodes.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Belum ada node untuk diedit.</p>
                                        ) : (
                                            nodes.map((node) => (
                                                <div key={node.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-8">
                                                    <form action={updateApprovalOrgNodeVoid} className="grid gap-2 md:col-span-7 md:grid-cols-7">
                                                        <input type="hidden" name="structureId" value={structure.id} />
                                                        <input type="hidden" name="nodeId" value={node.id} />

                                                        <Input name="nodeLabel" defaultValue={node.nodeName} placeholder="Node name" />

                                                        <select
                                                            name="userId"
                                                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                            defaultValue={node.userId ?? ""}
                                                        >
                                                            <option value="">Manual</option>
                                                            {users.map((u) => (
                                                                <option key={u.id} value={u.id}>{u.name}</option>
                                                            ))}
                                                        </select>

                                                        <select
                                                            name="parentNodeId"
                                                            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                                                            defaultValue={node.parentNodeId ?? ""}
                                                        >
                                                            <option value="">Root</option>
                                                            {nodes
                                                                .filter((opt) => opt.id !== node.id)
                                                                .map((opt) => (
                                                                    <option key={opt.id} value={opt.id}>{opt.user?.name ?? opt.nodeName}</option>
                                                                ))}
                                                        </select>

                                                        <Input name="jobTitle" defaultValue={node.jobTitle ?? ""} placeholder="Jabatan" />
                                                        <Input name="department" defaultValue={node.department ?? ""} placeholder="Department" />
                                                        <Input name="sortOrder" type="number" defaultValue={node.sortOrder} placeholder="Order" />
                                                        <Button type="submit">Edit</Button>
                                                    </form>

                                                    <form action={deleteApprovalOrgNodeVoid} className="md:col-span-1">
                                                        <input type="hidden" name="structureId" value={structure.id} />
                                                        <input type="hidden" name="nodeId" value={node.id} />
                                                        <Button type="submit" variant="destructive" className="w-full">Delete</Button>
                                                    </form>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="rounded-md border p-4">
                                        {nodes.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">Belum ada node pada struktur ini.</p>
                                        ) : (
                                            renderTree(null, nodeByParent)
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })
                )}
            </div>
        </div>
    )
}
