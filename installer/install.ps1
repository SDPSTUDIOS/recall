# Recall installer for Windows. Paste this into PowerShell (Start menu -> "PowerShell"):
#
#   irm https://github.com/SDPSTUDIOS/recall/releases/latest/download/install.ps1 | iex
#
# It installs Claude Code (if needed), signs you in, downloads Recall with its own
# copy of Node, adds Recall to your Desktop and Start menu and opens it. Nothing needs
# admin rights. Run it again any time to repair or update Recall; your PDFs and
# results are kept.
#
# A specific (e.g. pre-release) version:  $env:RECALL_TAG = 'v0.3.0'; irm ... | iex

& {
  $ErrorActionPreference = 'Stop'
  # Invoke-WebRequest's progress bar makes downloads many times slower in Windows PowerShell 5.1.
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $repo = 'SDPSTUDIOS/recall'
  $recallHome = if ($env:RECALL_HOME) { $env:RECALL_HOME } else { Join-Path $env:LOCALAPPDATA 'Recall' }
  $tag = $env:RECALL_TAG
  $base = if ($tag) { "https://github.com/$repo/releases/download/$tag" } else { "https://github.com/$repo/releases/latest/download" }

  function Step($text) { Write-Host ''; Write-Host $text -ForegroundColor White }
  function Info($text) { Write-Host "  $text" }
  function Ok($text) { Write-Host '  ' -NoNewline; Write-Host ([char]0x2713) -ForegroundColor Green -NoNewline; Write-Host " $text" }
  function Fail($text) {
    Write-Host ''
    Write-Host "Something went wrong: $text" -ForegroundColor Red
    Write-Host "If this keeps happening, open an issue at https://github.com/$repo/issues" -ForegroundColor DarkGray
    throw $text
  }
  function Download($url, $file) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $file }
  # Runs a program. Under 'Stop', Windows PowerShell 5.1 treats anything a program writes
  # to stderr as a fatal error, so programs run with 'Continue' and we check $LASTEXITCODE.
  function Run {
    $ErrorActionPreference = 'Continue'
    $exe = $args[0]
    $rest = @($args | Select-Object -Skip 1)
    & $exe @rest
  }

  Write-Host 'Installing Recall' -ForegroundColor White
  Write-Host 'Practice exams from your lecture PDFs, using your Claude subscription.' -ForegroundColor DarkGray

  # Windows on ARM runs the x64 build under emulation.
  $target = 'win32-x64'

  # --- 1. Find the release ------------------------------------------------------
  Step '1/4  Finding the latest version of Recall'
  try { $manifest = Invoke-RestMethod -UseBasicParsing -Uri "$base/manifest.json" }
  catch { Fail "Couldn't download Recall's release information. Check your internet connection and try again." }
  $asset = $manifest.assets.$target
  if (-not $asset) { Fail "Recall $($manifest.version) doesn't have a Windows build yet." }
  $nodeVersion = $asset.node
  Ok "Recall $($manifest.version)"

  # --- 2. Node, privately -------------------------------------------------------
  Step '2/4  Getting the tools Recall runs on'
  $nodeDir = Join-Path $recallHome "node\$nodeVersion"
  $nodeExe = Join-Path $nodeDir 'node.exe'
  if (Test-Path $nodeExe) {
    Ok "Node $nodeVersion (already downloaded)"
  } else {
    $name = "node-$nodeVersion-win-x64"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("recall-" + [Guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp 'node.zip'
    Info "Downloading Node $nodeVersion (about 30 MB)..."
    try { Download "https://nodejs.org/dist/$nodeVersion/$name.zip" $zip } catch { Fail "Couldn't download Node." }
    $sums = (Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/$nodeVersion/SHASUMS256.txt").Content
    $expected = ($sums -split "`n" | Where-Object { $_ -match "\s$([regex]::Escape("$name.zip"))$" } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
    $actual = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
    if (-not $expected -or $expected -ne $actual) { Fail 'The Node download was corrupted. Please try again.' }
    # Windows' tar.exe is much faster than Expand-Archive for Node's thousands of files.
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (Test-Path $tar) { Run $tar -xf $zip -C $tmp; if ($LASTEXITCODE) { Fail "Couldn't unpack Node." } }
    else { Expand-Archive -Path $zip -DestinationPath $tmp -Force }
    New-Item -ItemType Directory -Force -Path (Join-Path $recallHome 'node') | Out-Null
    if (Test-Path $nodeDir) { Remove-Item -Recurse -Force $nodeDir }
    Move-Item (Join-Path $tmp $name) $nodeDir
    Remove-Item -Recurse -Force $tmp
    Ok "Node $nodeVersion"
  }

  # --- 3. Claude Code -----------------------------------------------------------
  Step '3/4  Connecting Claude'
  $claude = $null
  $found = Get-Command claude -ErrorAction SilentlyContinue
  if ($found) { $claude = $found.Source }
  elseif (Test-Path "$env:USERPROFILE\.local\bin\claude.exe") { $claude = "$env:USERPROFILE\.local\bin\claude.exe" }

  if ($claude) {
    Ok 'Claude Code is installed'
  } else {
    Info "Installing Claude Code (Anthropic's official installer)..."
    try { & ([scriptblock]::Create((Invoke-RestMethod -UseBasicParsing -Uri 'https://claude.ai/install.ps1'))) | Out-Null }
    catch { Fail "Couldn't install Claude Code. See https://code.claude.com/docs/en/troubleshoot-install" }
    $claude = "$env:USERPROFILE\.local\bin\claude.exe"
    if (-not (Test-Path $claude)) { Fail "Claude Code installed, but it isn't where it was expected ($claude)." }
    Ok 'Claude Code installed'
  }

  $status = (Run $claude auth status 2>$null) -join "`n"
  if ($status -match '"loggedIn":\s*true') {
    Ok 'Signed in to Claude'
  } else {
    Info 'Your browser will open so you can sign in to your Claude account.'
    Write-Host "  Recall needs a Claude Pro or Max plan. The free plan doesn't include Claude Code." -ForegroundColor DarkGray
    Run $claude auth login
    if ($LASTEXITCODE -eq 0) { Ok 'Signed in to Claude' }
    else { Info "Sign-in didn't finish. You can do it later from Recall's Setup page." }
  }

  # --- 4. Recall ------------------------------------------------------------------
  Step '4/4  Installing Recall'
  New-Item -ItemType Directory -Force -Path $recallHome | Out-Null
  $launcher = Join-Path $recallHome 'launcher.mjs'
  try { Download "$base/launcher.mjs" "$launcher.download" } catch { Fail "Couldn't download Recall's launcher." }
  Move-Item -Force "$launcher.download" $launcher
  $launcherArgs = @('install')
  if ($tag) { $launcherArgs += @('--tag', $tag) }
  Run $nodeExe $launcher @launcherArgs
  if ($LASTEXITCODE) { Fail "Recall didn't install. Details are in $recallHome\logs\launcher.log" }

  Write-Host ''
  Write-Host 'Recall is ready.' -ForegroundColor Green
  Info 'Open it any time from the Recall icon on your Desktop or in the Start menu.'
  Write-Host "  It's opening in your browser now. You can close this window." -ForegroundColor DarkGray
}
