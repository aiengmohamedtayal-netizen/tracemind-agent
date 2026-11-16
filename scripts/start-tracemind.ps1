param(
    [switch]$NoBrowser,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDirectory = Join-Path $projectRoot 'logs'
$apiOutputLog = Join-Path $logDirectory 'backend.stdout.log'
$apiErrorLog = Join-Path $logDirectory 'backend.stderr.log'
$webOutputLog = Join-Path $logDirectory 'frontend.stdout.log'
$webErrorLog = Join-Path $logDirectory 'frontend.stderr.log'

function Test-TcpPort {
    param([Parameter(Mandatory)][int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(300)) {
            return $false
        }
        $client.EndConnect($pending)
        return $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

function Get-HealthyApi {
    param([Parameter(Mandatory)][int]$Port)

    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2
        if ($health.status -eq 'ok' -and $health.models -contains 'IsolationForest') {
            return "http://127.0.0.1:$Port"
        }
    }
    catch {
        return $null
    }
    return $null
}

function Get-HealthyFrontend {
    param([Parameter(Mandatory)][int]$Port)

    try {
        $url = "http://127.0.0.1:$Port"
        $page = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        $health = Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2
        if ($page.StatusCode -eq 200 -and $page.Content.Contains('TraceMind') -and $health.status -eq 'ok') {
            return $url
        }
    }
    catch {
        return $null
    }
    return $null
}

function Wait-ForApi {
    param([Parameter(Mandatory)][int]$Port)

    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        $url = Get-HealthyApi -Port $Port
        if ($url) { return $url }
        Start-Sleep -Seconds 1
    }
    throw "FastAPI did not become healthy on port $Port. Check $apiErrorLog."
}

function Wait-ForFrontend {
    param([Parameter(Mandatory)][int]$Port)

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $url = Get-HealthyFrontend -Port $Port
        if ($url) { return $url }
        Start-Sleep -Seconds 1
    }
    throw "The Vite app did not become healthy on port $Port. Check $webErrorLog."
}

function Show-RecentLog {
    param([Parameter(Mandatory)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Write-Host "--- Recent output: $Path ---" -ForegroundColor DarkGray
        Get-Content -LiteralPath $Path -Tail 15
    }
}

try {
    Set-Location -LiteralPath $projectRoot
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $projectRoot 'data') -Force | Out-Null

    Write-Host 'Starting TraceMind local services...' -ForegroundColor Cyan

    $apiPort = $null
    $apiUrl = $null
    foreach ($candidate in @(8000, 8001, 8002, 8100)) {
        $healthyApi = Get-HealthyApi -Port $candidate
        if ($healthyApi) {
            $apiPort = $candidate
            $apiUrl = $healthyApi
            Write-Host "Reusing healthy TraceMind API on port $apiPort."
            break
        }
        if (-not (Test-TcpPort -Port $candidate)) {
            $apiPort = $candidate
            break
        }
    }

    if ($null -eq $apiPort) {
        throw 'No available local API port was found in 8000, 8001, 8002, or 8100.'
    }

    if (-not $apiUrl) {
        $pythonLauncher = (Get-Command 'py.exe' -ErrorAction Stop).Source
        $env:APP_ENV = 'development'
        $env:DATABASE_URL = 'sqlite:///./data/tracemind.db'
        $env:PYTHONPATH = Join-Path $projectRoot 'backend'
        if (-not $env:JWT_SECRET) {
            $env:JWT_SECRET = 'local-development-secret-change-before-deploy-32chars'
        }

        $requiredImports = 'import fastapi, uvicorn, sqlalchemy, pydantic_settings, multipart, numpy, sklearn, pwdlib, jwt, alembic, slowapi, email_validator, psycopg'
        & $pythonLauncher -c $requiredImports *> $null
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Installing FastAPI dependencies...' -ForegroundColor Yellow
            & $pythonLauncher -m pip install -r (Join-Path $projectRoot 'backend\requirements.txt')
            if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
        }

        Write-Host 'Applying local SQLite migrations...'
        & $pythonLauncher -m alembic -c (Join-Path $projectRoot 'backend\alembic.ini') upgrade head
        if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }

        $env:APP_PORT = [string]$apiPort
        $null = Start-Process `
            -FilePath $pythonLauncher `
            -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', [string]$apiPort) `
            -WorkingDirectory $projectRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $apiOutputLog `
            -RedirectStandardError $apiErrorLog
        $apiUrl = Wait-ForApi -Port $apiPort
        Write-Host "FastAPI is ready at $apiUrl."
    }

    $frontendPort = $null
    $frontendUrl = $null
    foreach ($candidate in (@(3000, 3001, 5173) + (3002..3010))) {
        $healthyFrontend = Get-HealthyFrontend -Port $candidate
        if ($healthyFrontend) {
            $frontendPort = $candidate
            $frontendUrl = $healthyFrontend
            Write-Host "Reusing healthy TraceMind web app on port $frontendPort."
            break
        }
        if (-not (Test-TcpPort -Port $candidate)) {
            $frontendPort = $candidate
            break
        }
    }

    if ($null -eq $frontendPort) {
        throw 'No available local web port was found between 3000 and 3010, or on 5173.'
    }

    if (-not $frontendUrl) {
        $nodeExecutable = (Get-Command 'node.exe' -ErrorAction Stop).Source
        $npmExecutable = (Get-Command 'npm.cmd' -ErrorAction Stop).Source
        $viteEntrypoint = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $viteEntrypoint)) {
            Write-Host 'Installing frontend dependencies...' -ForegroundColor Yellow
            if (Test-Path -LiteralPath (Join-Path $projectRoot 'package-lock.json')) {
                & $npmExecutable ci
            }
            else {
                & $npmExecutable install
            }
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        }

        $env:VITE_BACKEND_PROXY_TARGET = $apiUrl
        $quotedViteEntrypoint = '"' + $viteEntrypoint + '"'
        $null = Start-Process `
            -FilePath $nodeExecutable `
            -ArgumentList @($quotedViteEntrypoint, '--host', '127.0.0.1', '--port', [string]$frontendPort, '--strictPort') `
            -WorkingDirectory $projectRoot `
            -WindowStyle Hidden `
            -RedirectStandardOutput $webOutputLog `
            -RedirectStandardError $webErrorLog
        $frontendUrl = Wait-ForFrontend -Port $frontendPort
        Write-Host "Vite is ready at $frontendUrl."
    }

    Write-Host ''
    Write-Host 'TraceMind is ready.' -ForegroundColor Green
    Write-Host "Web app: $frontendUrl"
    Write-Host "API health: $apiUrl/api/health"
    Write-Host 'Database: local SQLite at data\tracemind.db'
    Write-Host "Service logs: $logDirectory"

    if (-not $NoBrowser) {
        Start-Process -FilePath $frontendUrl
    }
    if (-not $NoPause) {
        Read-Host 'Press Enter to close this window; TraceMind will keep running'
    }
    exit 0
}
catch {
    Write-Host ''
    Write-Host "TraceMind startup failed: $($_.Exception.Message)" -ForegroundColor Red
    Show-RecentLog -Path $apiErrorLog
    Show-RecentLog -Path $webErrorLog
    if (-not $NoPause) {
        Read-Host 'Press Enter to close this window'
    }
    exit 1
}
