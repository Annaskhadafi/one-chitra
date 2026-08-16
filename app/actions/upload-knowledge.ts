"use server"

import { revalidatePath } from "next/cache"
import {
    chatWithRag,
    deleteRagDocument,
    getRagDocumentChunks,
    getRagInfo,
    ingestDocumentToRag,
    listRagDocuments,
    searchRagKnowledge,
    type RagChatResult,
    type RagDocument,
    type RagDocumentChunksResult,
    type RagInfoResult,
    type RagIngestResult,
    type RagSearchResult,
} from "@/lib/raray-rag"

/**
 * Server Action: Mengunggah file ke RAG Knowledge Base & pgvector
 */
export async function uploadToKnowledgeBase(formData: FormData): Promise<RagIngestResult> {
    try {
        const file = formData.get("file")
        if (!file || (typeof file === "object" && !(file instanceof Blob))) {
            return {
                status: "error",
                message: "File dokumen wajib disertakan",
            }
        }

        const result = await ingestDocumentToRag(formData)
        revalidatePath("/dashboard/chitra-knowledge")
        return result
    } catch (error) {
        console.error("[uploadToKnowledgeBase] Error:", error)
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Gagal mengunggah dokumen ke Knowledge Base",
        }
    }
}

/**
 * Server Action: Mengambil daftar dokumen di Knowledge Base
 */
export async function getKnowledgeDocumentsAction(): Promise<{
    status: "success" | "error"
    total_documents: number
    total_chunks: number
    documents: RagDocument[]
    message?: string
}> {
    try {
        const res = await listRagDocuments()
        return {
            status: res.status,
            total_documents: res.total_documents || 0,
            total_chunks: res.total_chunks || 0,
            documents: res.documents || [],
        }
    } catch (error) {
        console.error("[getKnowledgeDocumentsAction] Error:", error)
        return {
            status: "error",
            total_documents: 0,
            total_chunks: 0,
            documents: [],
            message: error instanceof Error ? error.message : "Gagal mengambil daftar dokumen",
        }
    }
}

/**
 * Server Action: Mengambil chunk vektor dari dokumen tertentu
 */
export async function getKnowledgeDocumentChunksAction(documentId: string): Promise<RagDocumentChunksResult> {
    try {
        return await getRagDocumentChunks(documentId)
    } catch (error) {
        console.error(`[getKnowledgeDocumentChunksAction] Error for ${documentId}:`, error)
        return {
            status: "error",
            document_id: documentId,
            filename: "",
            total_chunks: 0,
            chunks: [],
            detail: error instanceof Error ? error.message : "Gagal mengambil chunks dokumen",
        }
    }
}

/**
 * Server Action: Menghapus dokumen dari RAG Knowledge Base & pgvector
 */
export async function deleteKnowledgeDocumentAction(documentId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const result = await deleteRagDocument(documentId)
        revalidatePath("/dashboard/chitra-knowledge")
        return result
    } catch (error) {
        console.error(`[deleteKnowledgeDocumentAction] Error for ${documentId}:`, error)
        return {
            success: false,
            message: error instanceof Error ? error.message : "Gagal menghapus dokumen",
        }
    }
}

/**
 * Server Action: Menguji Semantic Vector Search pada pgvector
 */
export async function searchKnowledgeBaseAction(query: string, topK = 4): Promise<RagSearchResult> {
    try {
        return await searchRagKnowledge(query, topK)
    } catch (error) {
        console.error("[searchKnowledgeBaseAction] Error:", error)
        return {
            status: "error",
            detail: error instanceof Error ? error.message : "Gagal mencari dokumen di Knowledge Base",
        }
    }
}

/**
 * Server Action: Menguji Chatbot RAG langsung
 */
export async function chatKnowledgeBaseAction(query: string, topK = 4): Promise<RagChatResult> {
    try {
        return await chatWithRag(query, topK)
    } catch (error) {
        console.error("[chatKnowledgeBaseAction] Error:", error)
        return {
            status: "error",
            error: error instanceof Error ? error.message : "Gagal berkomunikasi dengan RAG Chatbot",
        }
    }
}

/**
 * Server Action: Mengambil status RAG Engine
 */
export async function getKnowledgeEngineInfoAction(): Promise<RagInfoResult> {
    try {
        return await getRagInfo()
    } catch (error) {
        console.error("[getKnowledgeEngineInfoAction] Error:", error)
        return {
            status: "error",
            detail: error instanceof Error ? error.message : "Gagal mengambil info RAG engine",
        }
    }
}
