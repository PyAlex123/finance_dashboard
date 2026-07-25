# Запуск демо «в одну кнопку»: определяет IP в текущей Wi-Fi сети,
# настраивает фронтенд на сервер, поднимает сервер и сайт, печатает ссылку.
# Запускать через start.bat (двойной клик) или: powershell -File start.ps1

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

function Get-LanIp {
  $cands = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
    $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown'
  }
  $wifi = $cands | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Wireless|Беспровод' } | Select-Object -First 1
  if ($wifi) { return $wifi.IPAddress }
  $any = $cands | Select-Object -First 1
  if ($any) { return $any.IPAddress }
  return $null
}

$ip = Get-LanIp
if (-not $ip) {
  Write-Host "Не удалось определить IP. Подключись к Wi-Fi и запусти снова." -ForegroundColor Red
  Read-Host "Enter — выход"; exit 1
}

# 1) Настроить фронтенд на этот сервер (перечитывается при старте dev-сервера).
Set-Content -Path (Join-Path $root '.env') -Value "VITE_API_URL=http://${ip}:8000" -Encoding utf8
Write-Host "IP в этой сети: $ip" -ForegroundColor Cyan

# 2) Один раз: окружение сервера.
$py = Join-Path $root 'server\.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Host "Готовлю сервер (один раз, ~минута)..." -ForegroundColor Yellow
  py -m venv (Join-Path $root 'server\.venv')
  & $py -m pip install --disable-pip-version-check -q -r (Join-Path $root 'server\requirements.txt')
}

# 3) Один раз: зависимости фронтенда.
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host "Ставлю зависимости сайта (один раз)..." -ForegroundColor Yellow
  npm install
}

# 4) Поднять сервер (окно «сервер») и сайт (окно «сайт»).
Start-Process -FilePath $py `
  -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8000' `
  -WorkingDirectory (Join-Path $root 'server') `
  -WindowStyle Minimized
Start-Process -FilePath 'powershell' `
  -ArgumentList '-NoExit','-NoProfile','-Command',"Set-Location `"$root`"; npm run dev"

Start-Sleep -Seconds 2
Start-Process "http://localhost:5173/"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  Кидай эту ссылку коллегам в Telegram:" -ForegroundColor Green
Write-Host "      http://${ip}:5173/" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Если Windows спросит про доступ в сеть — нажми «Разрешить»." -ForegroundColor Yellow
Write-Host "Закрыть демо: закрой оба окна (сервер и сайт)." -ForegroundColor DarkGray
Read-Host "Enter — закрыть это окно"
