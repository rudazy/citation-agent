@echo off
setlocal
cd /d "%~dp0.."

if "%SUPABASE_ACCESS_TOKEN%"=="" (
  echo SUPABASE_ACCESS_TOKEN is required.
  exit /b 1
)

set PROJECT_REF=godzfxbhiixfhtxdwsxi

echo Logging in to Supabase CLI...
call npx --yes supabase login --token "%SUPABASE_ACCESS_TOKEN%"
if errorlevel 1 exit /b 1

echo Linking project %PROJECT_REF% (lepton-citation-agent)...
call npx --yes supabase link --project-ref %PROJECT_REF% --yes
if errorlevel 1 exit /b 1

echo Pushing migrations...
call npx --yes supabase db push --yes
exit /b %errorlevel%