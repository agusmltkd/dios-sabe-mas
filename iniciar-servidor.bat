@echo off
REM iniciar-servidor.bat — sirve la PWA en local y la abre en el navegador.
REM Doble clic para arrancar. Cierra esta ventana para parar el servidor.

cd /d "%~dp0"
set PUERTO=8080

for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-?Fi|Ethernet' -and $_.InterfaceAlias -notmatch 'Virtual|VMware|VMnet' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)"') do set IP_LAN=%%i

echo Sirviendo "Dios sabe mas" en:
echo   - este ordenador:  http://localhost:%PUERTO%/
if defined IP_LAN echo   - otros dispositivos en la misma red (movil):  http://%IP_LAN%:%PUERTO%/
echo.
echo Si Windows pregunta por el Firewall, permite el acceso en redes privadas.
echo Cierra esta ventana para parar el servidor.
echo.

start "" http://localhost:%PUERTO%/
python -m http.server %PUERTO%

pause
