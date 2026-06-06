# Trigger RISC webhook manually (PowerShell)
# -------------------------------------------------
# 1. Replace <VERCEL_URL> with the URL you got after `vercel` deployment.
#    It looks like https://<your‑subdomain>.vercel.app/api/riscWebhook
# 2. Save this file as trigger_risc.ps1 in the project root (d:\Aulert).
# 3. Open PowerShell, navigate to the project folder and run:
#        .\trigger_risc.ps1 -UserId <Google_User_ID>
#    (You can also pass the whole JWT via -Jwt if you have it.)
# -------------------------------------------------
param(
    [Parameter(Mandatory = $true)]
    [string]$UserId,
    [string]$Jwt = $null,
    [string]$WebhookUrl = "https://aulert-cbq9sf7y9-poonyapat-aroonrueangsirlerts-projects.vercel.app"
)

function Send-Webhook {
    param(
        [string]$Url,
        [hashtable]$Body
    )
    $json = $Body | ConvertTo-Json -Depth 5
    try {
        $response = Invoke-RestMethod -Method Post -Uri $Url -Body $json -ContentType "application/json"
        Write-Host "✅ Webhook sent successfully. Response: $response" -ForegroundColor Green
    }
    catch {
        Write-Error "❌ Failed to send webhook: $_"
    }
}

# Build a minimal payload that mimics a RISC security event
$payload = @{
    sub    = $UserId
    events = @{
        "https://schemas.openid.net/secevent/risc/event-type/account-disabled" = $true
    }
}

if ($Jwt) {
    # If you have a full JWT, replace the payload with the token directly
    $payload = $Jwt
}

Send-Webhook -Url $WebhookUrl -Body $payload
