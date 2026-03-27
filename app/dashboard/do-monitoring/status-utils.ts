export type DoMonitoringStatus = "Pending" | "Return" | "Lost"

export function getDoMonitoringStatus(input: {
    doStatus?: string | null
    scanDoDocument?: string | null
}): DoMonitoringStatus {
    if (input.doStatus === "Lost") {
        return "Lost"
    }

    if (input.scanDoDocument || input.doStatus === "Returned" || input.doStatus === "Return") {
        return "Return"
    }

    return "Pending"
}

export function getStoredDoStatus(status: string): string {
    if (status === "Return") {
        return "Returned"
    }

    return status
}
