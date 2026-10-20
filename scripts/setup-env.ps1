$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $repo '.env'
if (Test-Path -LiteralPath $envPath) { Write-Host '.env ya existe; no se modifica.'; exit 0 }
function New-Secret([int]$count) {
  $bytes = New-Object byte[] $count
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToHexString($bytes)
}
$dbSecret = New-Secret 24
$signingSecret = New-Secret 48
$demoSecret = 'DepoRed.' + (New-Secret 8) + '!'
@("POSTGRES_PASSWORD=$dbSecret", "AUTH_SIGNING_KEY=$signingSecret", "SANDBOX_PASSWORD=$demoSecret") | Set-Content -LiteralPath $envPath -Encoding utf8
Write-Host 'Archivo .env creado con secretos aleatorios. Consulta SANDBOX_PASSWORD localmente para ingresar.'
