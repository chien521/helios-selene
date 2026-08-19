$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$archivePath = Join-Path $projectRoot 'helios-selene-viverse.zip'
$indexPath = Join-Path $distPath 'index.html'

if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
  throw "Cannot package VIVERSE upload: '$indexPath' does not exist. Run the VIVERSE build first."
}

if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Archive the contents, not dist itself, so VIVERSE finds index.html at the ZIP root.
$archiveStream = [System.IO.File]::Open(
  $archivePath,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::Write,
  [System.IO.FileShare]::None
)
try {
  $zip = [System.IO.Compression.ZipArchive]::new(
    $archiveStream,
    [System.IO.Compression.ZipArchiveMode]::Create,
    $false
  )
  try {
    Get-ChildItem -LiteralPath $distPath -File -Recurse | ForEach-Object {
      # ZIP entry names must use "/" even on Windows. VIVERSE serves these names as URL paths.
      $entryName = $_.FullName.Substring($distPath.Length).TrimStart('\').Replace('\', '/')
      $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $source = [System.IO.File]::Open(
        $_.FullName,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
      )
      try {
        $destination = $entry.Open()
        try {
          $source.CopyTo($destination)
        } finally {
          $destination.Dispose()
        }
      } finally {
        $source.Dispose()
      }
    }
  } finally {
    $zip.Dispose()
  }
} finally {
  $archiveStream.Dispose()
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  if (-not ($archive.Entries.FullName -contains 'index.html')) {
    throw "VIVERSE archive validation failed: index.html is not at the ZIP root."
  }
  if (-not ($archive.Entries.FullName | Where-Object { $_.StartsWith('assets/') })) {
    throw "VIVERSE archive validation failed: assets are not stored with URL-compatible '/' paths."
  }
} finally {
  $archive.Dispose()
}

Write-Host "Created VIVERSE upload archive: $archivePath"
