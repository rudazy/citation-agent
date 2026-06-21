$p = Start-Process -FilePath 'C:\Users\Ludarep\.foundry\bin\forge.exe' `
  -ArgumentList 'build' `
  -WorkingDirectory 'C:\Users\Ludarep\citation-agent' `
  -Wait -PassThru -NoNewWindow `
  -RedirectStandardOutput 'C:\Users\Ludarep\citation-agent\stdout.txt' `
  -RedirectStandardError 'C:\Users\Ludarep\citation-agent\stderr.txt'
Write-Output "exit=$($p.ExitCode)"
if (Test-Path 'C:\Users\Ludarep\citation-agent\stderr.txt') { Get-Content 'C:\Users\Ludarep\citation-agent\stderr.txt' }
if (Test-Path 'C:\Users\Ludarep\citation-agent\stdout.txt') { Get-Content 'C:\Users\Ludarep\citation-agent\stdout.txt' }