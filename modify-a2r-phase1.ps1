$file = "app\actions\a2r-competition.ts"
$content = Get-Content $file -Raw

# 1. Add serialNumbers to cosmeticCustomerBuckets type
$content = $content -replace 
    '(cosmeticCustomerBuckets: Map<string, \{\s+customerName: string)',
    '$1`r`n        serialNumbers: Set<string>'

# 2. Add cosmeticSerialNumbers to SalesProductDetail type
$content = $content -replace 
    '(r49Points: number\s+cosmeticPoints: number\s+inventoryPoints)',
    'r49Points: number`r`n    cosmeticPoints: number`r`n    cosmeticSerialNumbers: string[]`r`n    inventoryPoints'

Set-Content $file -Value $content -Encoding UTF8 -NoNewline
Write-Host "Phase 1 completed"
