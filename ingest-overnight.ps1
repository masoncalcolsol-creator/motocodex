# ingest-overnight.ps1
# Calls your ingest endpoint every 15 minutes until stopped

$Url = "http://localhost:3001/api/ingest/run?token=devtoken123"

Write-Host ""
Write-Host "MotoCODEX overnight ingest loop starting..."
Write-Host "URL: $Url"
Write-Host "Press CTRL+C to stop."
Write-Host ""

while ($true) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 60
        Write-Host "[$ts] OK  Status=$($resp.StatusCode)"
    }
    catch {
        Write-Host "[$ts] FAIL $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 900  # 15 minutes
}
