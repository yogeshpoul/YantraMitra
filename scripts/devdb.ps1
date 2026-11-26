# Project-local PostgreSQL + PostGIS for Windows machines without Docker.
# Copies an installed PostgreSQL 16 into .local\pgsql and overlays the official OSGeo PostGIS
# bundle. It never modifies the installed PostgreSQL or its service. DEVELOPMENT ONLY.
#
#   powershell -ExecutionPolicy Bypass -File scripts\devdb.ps1 setup|start|stop|status
param([Parameter(Mandatory = $true)][ValidateSet('setup', 'start', 'stop', 'status')][string]$Command)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$local = Join-Path $root '.local'
$pg = Join-Path $local 'pgsql'
$data = Join-Path $local 'pgdata'
$dl = Join-Path $local 'dl'
$port = if ($env:DEVDB_PORT) { $env:DEVDB_PORT } else { '55432' }
$source = if ($env:PG16_HOME) { $env:PG16_HOME } else { 'C:\Program Files\PostgreSQL\16' }
$bundle = 'postgis-bundle-pg16-3.6.2x64'
$md5 = '6730107131c29b7ff9a36702f736007b'
$urls = @("https://download.osgeo.org/postgis/windows/pg16/$bundle.zip",
          "https://download.osgeo.org/postgis/windows/pg16/archive/$bundle.zip")

function Invoke-Native([string]$exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "$exe failed with exit code $LASTEXITCODE" }
}

function Start-Db {
  # Started through Start-Process so the server does not hold this console's handles.
  Start-Process -FilePath "$pg\bin\pg_ctl.exe" -WindowStyle Hidden -Wait:$false -ArgumentList @(
    '-D', "`"$data`"", '-l', "`"$local\postgres.log`"", '-o', "`"-p $port -c listen_addresses=127.0.0.1`"", 'start')
  for ($i = 0; $i -lt 240; $i++) {
    & "$pg\bin\pg_isready.exe" -q -h 127.0.0.1 -p $port
    if ($LASTEXITCODE -eq 0) { Write-Output "Database ready on 127.0.0.1:$port"; return }
    Start-Sleep -Milliseconds 500
  }
  throw "Database did not start. See $local\postgres.log"
}

switch ($Command) {
  'setup' {
    New-Item -ItemType Directory -Force $dl, $pg | Out-Null
    if (-not (Test-Path "$pg\bin\postgres.exe")) {
      if (-not (Test-Path "$source\bin\postgres.exe")) { throw "PostgreSQL 16 not found at $source (set PG16_HOME)" }
      foreach ($d in 'bin', 'lib', 'share') { Copy-Item -Recurse -Force "$source\$d" $pg }
    }
    if (-not (Test-Path "$pg\share\extension\postgis.control")) {
      $zip = Join-Path $dl "$bundle.zip"
      if (-not (Test-Path $zip)) {
        $ok = $false
        foreach ($u in $urls) {
          try { Invoke-WebRequest -UseBasicParsing $u -OutFile $zip; $ok = $true; break } catch { Write-Output "Not at $u" }
        }
        if (-not $ok) { throw 'Could not download the PostGIS bundle' }
      }
      if ((Get-FileHash -Algorithm MD5 $zip).Hash.ToLower() -ne $md5) { throw 'PostGIS bundle checksum mismatch' }
      $out = Join-Path $dl 'postgis'
      Expand-Archive -Force $zip $out
      foreach ($d in 'bin', 'lib', 'share') { Copy-Item -Recurse -Force (Join-Path $out "$bundle\$d") $pg }
    }
    if (-not (Test-Path "$data\PG_VERSION")) {
      # Trust auth is restricted to loopback; this cluster is for local development only.
      Invoke-Native "$pg\bin\initdb.exe" @('-D', $data, '-U', 'yantramitra', '-A', 'trust', '-E', 'UTF8', '--locale=en-US')
    }
    Start-Db
    foreach ($db in 'yantramitra', 'yantramitra_test') {
      $exists = & "$pg\bin\psql.exe" -h 127.0.0.1 -p $port -U yantramitra -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
      if ($exists -ne '1') { Invoke-Native "$pg\bin\createdb.exe" @('-h', '127.0.0.1', '-p', $port, '-U', 'yantramitra', $db) }
      Invoke-Native "$pg\bin\psql.exe" @('-q', '-h', '127.0.0.1', '-p', $port, '-U', 'yantramitra', '-d', $db, '-c', 'CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_trgm;')
    }
  }
  'start' { Start-Db }
  'stop' { & "$pg\bin\pg_ctl.exe" -D $data -m fast stop }
  'status' { & "$pg\bin\pg_ctl.exe" -D $data status }
}
