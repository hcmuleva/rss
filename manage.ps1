<#
.SYNOPSIS
  Unified Management Script for RSS Workspace (Auth, Karyakarini, and Expo Frontend)
.DESCRIPTION
  Allows starting, stopping, restarting, and checking the status of all frontend and backend services.
.EXAMPLE
  .\manage.ps1 start
  .\manage.ps1 stop
  .\manage.ps1 restart
  .\manage.ps1 status
  .\manage.ps1 start -Window    # Opens each service in a visible terminal window
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "run", "stop", "restart", "status", "help")]
    [string]$Action = "status",

    [Alias("w")]
    [switch]$Window,

    [string]$Service = "all"
)

$ErrorActionPreference = "Continue"

# Resolve directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path "$ScriptDir\rss\backend") {
    $BaseDir = "$ScriptDir\rss"
} elseif (Test-Path "$ScriptDir\backend") {
    $BaseDir = "$ScriptDir"
} else {
    $BaseDir = "$ScriptDir"
}

$AuthDir = "$BaseDir\backend\auth-service"
$KaryakariniDir = "$BaseDir\backend\karyakarini-service"
$AppDir = "$BaseDir\app"

# Find node and npx
$NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodeExe -and (Test-Path "C:\nvm4w\nodejs\node.exe")) {
    $NodeExe = "C:\nvm4w\nodejs\node.exe"
}
if (-not $NodeExe) { $NodeExe = "node.exe" }

$NpxCmd = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
if (-not $NpxCmd -and (Test-Path "C:\nvm4w\nodejs\npx.cmd")) {
    $NpxCmd = "C:\nvm4w\nodejs\npx.cmd"
}
if (-not $NpxCmd) { $NpxCmd = "npx.cmd" }

$Services = @(
    @{
        Name = "auth-service"
        Port = 4000
        Dir = $AuthDir
        Exe = $NodeExe
        Args = "src/server.js"
        Command = "node src/server.js"
        HealthUrl = "http://localhost:4000/health"
    },
    @{
        Name = "karyakarini-service"
        Port = 4014
        Dir = $KaryakariniDir
        Exe = $NodeExe
        Args = "src/server.js"
        Command = "node src/server.js"
        HealthUrl = "http://localhost:4014/health"
    },
    @{
        Name = "frontend-app"
        Port = 8081
        Dir = $AppDir
        Exe = $NpxCmd
        Args = "expo start --web"
        Command = "npx expo start --web"
        HealthUrl = "http://localhost:8081"
    }
)

function Get-PortProcessId {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if ($conns) {
        return ($conns | Select-Object -First 1).OwningProcess
    }
    return $null
}

function Stop-SingleService {
    param($svc)
    $pidToKill = Get-PortProcessId -Port $svc.Port
    if ($pidToKill) {
        try {
            taskkill /PID $pidToKill /T /F 2>$null | Out-Null
            Write-Host "  [STOPPED] $($svc.Name) (Port $($svc.Port), PID $pidToKill)" -ForegroundColor Yellow
        } catch {
            Write-Host "  [ERROR] Failed to stop $($svc.Name): $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  [INACTIVE] $($svc.Name) is not running on port $($svc.Port)" -ForegroundColor DarkGray
    }
}

function Start-SingleService {
    param($svc, [bool]$OpenWindow)
    $pidRunning = Get-PortProcessId -Port $svc.Port
    if ($pidRunning) {
        Write-Host "  [ALREADY RUNNING] $($svc.Name) is already running (Port $($svc.Port), PID $pidRunning)" -ForegroundColor Green
        return
    }

    Write-Host "  [STARTING] $($svc.Name) on port $($svc.Port)..." -ForegroundColor Cyan

    if ($OpenWindow) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$($svc.Dir)'; Write-Host 'Starting $($svc.Name)...' -ForegroundColor Cyan; $($svc.Command)"
    } else {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $svc.Exe
        $psi.Arguments = $svc.Args
        $psi.WorkingDirectory = $svc.Dir
        $psi.UseShellExecute = $true
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        [System.Diagnostics.Process]::Start($psi) | Out-Null
    }
}

function Show-Status {
    Write-Host "`n=== RSS Services Status ===" -ForegroundColor Cyan
    $statusList = @()
    foreach ($s in $Services) {
        $procId = Get-PortProcessId -Port $s.Port
        $status = if ($procId) { "RUNNING" } else { "STOPPED" }
        $statusList += [PSCustomObject]@{
            Service = $s.Name
            Port = $s.Port
            Status = $status
            PID = if ($procId) { $procId } else { "-" }
            URL = $s.HealthUrl
        }
    }
    $statusList | Format-Table -AutoSize
}

switch ($Action.ToLower()) {
    { $_ -in @("stop") } {
        Write-Host "`nStopping all RSS services..." -ForegroundColor Magenta
        foreach ($s in $Services) {
            if ($Service -eq "all" -or $Service -eq $s.Name) {
                Stop-SingleService $s
            }
        }
        Start-Sleep -Seconds 1
        Show-Status
    }

    { $_ -in @("start", "run") } {
        Write-Host "`nStarting RSS services..." -ForegroundColor Magenta
        foreach ($s in $Services) {
            if ($Service -eq "all" -or $Service -eq $s.Name) {
                Start-SingleService -svc $s -OpenWindow $Window
            }
        }
        Write-Host "Waiting 5 seconds for services to initialize..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
        Show-Status
    }

    { $_ -in @("restart") } {
        Write-Host "`nRestarting all RSS services..." -ForegroundColor Magenta
        foreach ($s in $Services) {
            if ($Service -eq "all" -or $Service -eq $s.Name) {
                Stop-SingleService $s
            }
        }
        Start-Sleep -Seconds 2
        Write-Host "`nStarting up services..." -ForegroundColor Magenta
        foreach ($s in $Services) {
            if ($Service -eq "all" -or $Service -eq $s.Name) {
                Start-SingleService -svc $s -OpenWindow $Window
            }
        }
        Write-Host "Waiting 5 seconds for services to initialize..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
        Show-Status
    }

    { $_ -in @("status") } {
        Show-Status
    }

    default {
        Write-Host "Usage: .\manage.ps1 [start|stop|restart|status] [-Window]"
    }
}
