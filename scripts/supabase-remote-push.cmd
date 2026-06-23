@echo off
setlocal
cd /d "%~dp0.."

if "%SUPABASE_ACCESS_TOKEN%"=="" (
  echo SUPABASE_ACCESS_TOKEN is required.
  exit /b 1
)

if "%SUPABASE_PROJECT_REF%"=="" (
  echo SUPABASE_PROJECT_REF is required.
  exit /b 1
)

echo Logging in to Supabase CLI...
call npx --yes supabase login --token "%SUPABASE_ACCESS_TOKEN%"
if errorlevel 1 exit /b 1

echo Linking project %SUPABASE_PROJECT_REF%...
call npx --yes supabase link --project-ref %SUPABASE_PROJECT_REF% --yes
if errorlevel 1 exit /b 1

echo Pushing migrations...
call npx --yes supabase db push --yes
exit /b %errorlevel%