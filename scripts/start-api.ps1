$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $repo '.env'
if (!(Test-Path -LiteralPath $envPath)) { & (Join-Path $PSScriptRoot 'setup-env.ps1') }
$values = @{}
Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $k,$v = $_ -split '=',2; $values[$k] = $v }
$env:ConnectionStrings__Database = "Host=127.0.0.1;Port=55432;Database=depored;Username=depored;Password=$($values.POSTGRES_PASSWORD)"
$env:Auth__SigningKey = $values.AUTH_SIGNING_KEY
$env:Sandbox__Password = $values.SANDBOX_PASSWORD
$env:Payments__Mode = 'Sandbox'
$env:Database__MigrateOnStartup = 'true'
$env:Sandbox__Seed = 'true'
$env:ASPNETCORE_URLS = 'http://127.0.0.1:5080'
$env:Security__KeyPath = Join-Path $repo '.local/keys'
dotnet run --project (Join-Path $repo 'backend/DepoRet.Api') --no-launch-profile
