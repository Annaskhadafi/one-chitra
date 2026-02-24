import { notFound } from "next/navigation"
import { getStockOpnameSession } from "@/app/actions/stock-opname"

interface Props {
    params: Promise<{ id: string }>
}

export default async function PrintChecklistPage({ params }: Props) {
    const { id } = await params
    const sessionId = parseInt(id)

    if (isNaN(sessionId)) notFound()

    const session = await getStockOpnameSession(sessionId)
    
    if (!session) {
        notFound()
    }

    const items = session.items ?? []
    const signatures = session.signatures ?? []

    return (
        <html>
            <head>
                <title>Checklist Stock Opname - {session.name}</title>
                <style dangerouslySetInnerHTML={{ __html: `
                    @page {
                        size: A4;
                        margin: 15mm;
                    }
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 10pt;
                        line-height: 1.4;
                        color: #000;
                    }
                    
                    .page-header {
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                        margin-bottom: 15px;
                    }
                    
                    .company-name {
                        font-size: 16pt;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }
                    
                    .document-title {
                        font-size: 14pt;
                        font-weight: bold;
                        text-align: center;
                        margin: 15px 0 10px 0;
                        text-transform: uppercase;
                    }
                    
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                        margin-bottom: 15px;
                        font-size: 9pt;
                    }
                    
                    .info-item {
                        display: flex;
                    }
                    
                    .info-label {
                        font-weight: bold;
                        min-width: 120px;
                    }
                    
                    .info-value {
                        flex: 1;
                    }
                    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                        font-size: 9pt;
                    }
                    
                    th, td {
                        border: 1px solid #000;
                        padding: 6px 4px;
                        text-align: left;
                    }
                    
                    th {
                        background-color: #e0e0e0;
                        font-weight: bold;
                        text-align: center;
                    }
                    
                    .col-no { width: 30px; text-align: center; }
                    .col-material { width: 100px; }
                    .col-desc { width: auto; }
                    .col-category { width: 80px; }
                    .col-qty { width: 60px; text-align: right; }
                    .col-counted { width: 80px; }
                    .col-notes { width: 100px; }
                    
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    
                    .signature-section {
                        margin-top: 30px;
                        page-break-inside: avoid;
                    }
                    
                    .signature-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    
                    .signature-table td {
                        border: 1px solid transparent;
                        padding: 10px;
                        vertical-align: top;
                        width: 20%;
                    }
                    
                    .sig-label {
                        text-align: center;
                        font-weight: bold;
                        font-size: 9pt;
                        margin-bottom: 10px;
                    }
                    
                    .sig-line {
                        height: 60px;
                        border-bottom: 1px solid #000;
                        margin: 10px 0;
                    }
                    
                    .sig-name {
                        text-align: center;
                        font-weight: bold;
                        font-size: 9pt;
                        margin-top: 5px;
                    }
                    
                    .footer-note {
                        margin-top: 15px;
                        font-size: 8pt;
                        color: #666;
                        font-style: italic;
                    }
                    
                    @media print {
                        body {
                            print-color-adjust: exact;
                            -webkit-print-color-adjust: exact;
                        }
                        
                        table {
                            page-break-inside: auto;
                        }
                        
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                        
                        thead {
                            display: table-header-group;
                        }
                    }
                `}} />
            </head>
            <body>
                <div className="page-header">
                    <div>
                        <div className="company-name">PT. CHITRA PARATAMA</div>
                        <div style={{ fontSize: '9pt' }}>Stock Opname Checklist</div>
                    </div>
                </div>

                <div className="document-title">
                    CHECKLIST STOCK OPNAME
                </div>

                <div className="info-grid">
                    <div className="info-item">
                        <span className="info-label">Nama Sesi:</span>
                        <span className="info-value">{session.name}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Warehouse:</span>
                        <span className="info-value">{session.warehouse?.sloc ?? '-'} - {session.warehouse?.description ?? '-'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Tanggal Opname:</span>
                        <span className="info-value">
                            {session.opnameDate ? new Date(session.opnameDate).toLocaleDateString('id-ID', { 
                                day: '2-digit', 
                                month: 'long', 
                                year: 'numeric' 
                            }) : '-'}
                        </span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Waktu:</span>
                        <span className="info-value">{session.opnameTime ?? '-'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Lokasi:</span>
                        <span className="info-value">{session.location ?? '-'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Dibuat Oleh:</span>
                        <span className="info-value">{session.createdBy?.name ?? '-'}</span>
                    </div>
                </div>

                {session.notes && (
                    <div style={{ marginBottom: '15px', fontSize: '9pt' }}>
                        <strong>Catatan:</strong> {session.notes}
                    </div>
                )}

                <table>
                    <thead>
                        <tr>
                            <th className="col-no">No</th>
                            <th className="col-material">Material No.</th>
                            <th className="col-desc">Deskripsi Material</th>
                            <th className="col-category">Kategori</th>
                            <th className="col-qty">Qty Sistem</th>
                            <th className="col-counted">Qty Fisik</th>
                            <th className="col-notes">Catatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={item.id}>
                                <td className="text-center">{index + 1}</td>
                                <td>{item.product?.materialNumber ?? '-'}</td>
                                <td>{item.product?.materialDescription ?? '-'}</td>
                                <td className="text-center">{item.product?.category ?? '-'}</td>
                                <td className="text-right">{item.systemQty}</td>
                                <td></td>
                                <td></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="signature-section">
                    <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '10pt' }}>
                        Diperiksa Oleh:
                    </div>
                    {signatures.length > 0 ? (
                        <table className="signature-table">
                            <tbody>
                                {Array.from({ length: Math.ceil(signatures.length / 5) }, (_, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {Array.from({ length: 5 }, (_, colIndex) => {
                                            const sigIndex = rowIndex * 5 + colIndex
                                            const sig = signatures[sigIndex]
                                            
                                            if (!sig) {
                                                return <td key={colIndex}></td>
                                            }
                                            
                                            return (
                                                <td key={colIndex}>
                                                    <div className="sig-label">Diperiksa</div>
                                                    <div className="sig-line"></div>
                                                    <div className="sig-name">{sig.name}</div>
                                                    <div style={{ textAlign: 'center', fontSize: '8pt', color: '#666', marginTop: '3px' }}>
                                                        {sig.position}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ fontSize: '9pt', color: '#666', fontStyle: 'italic' }}>
                            Tidak ada peserta yang terdaftar
                        </div>
                    )}
                </div>

                <div className="footer-note">
                    Dokumen ini dicetak pada {new Date().toLocaleDateString('id-ID', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>

                <script dangerouslySetInnerHTML={{ __html: `
                    window.onload = function() {
                        window.print();
                    }
                `}} />
            </body>
        </html>
    )
}
