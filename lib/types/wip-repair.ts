export type WipRepairRecord = {
  id_wo: string
  wo: string
  job_type: string
  status: string
  size: string | null
  brand: string | null
  pattern: string | null
  type: string | null
  nocargo: string | null
  tire_sn: string
  injury: string | null
  remark: string | null
  customer: string | null
  site: string | null
  store_loc: string | null
  inspect_date: string | null
  inspector: string | null
  createby: string | null
  wo_date: string | null
  received_date: string | null
  receiver: string | null
  po: string | null
  bast: string | null
  po_date: string | null
  bast_date: string | null
  invoice: string | null
  invoice_date: string | null
}

export type WipRepairApiResponse = {
  data: WipRepairRecord[]
}
